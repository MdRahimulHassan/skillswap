package handlers

import (
	"encoding/json"
	"log"
	"main/db"
	"net/http"
	"strconv"
	"strings"
)

type SkillRequest struct {
	UserID    int    `json:"user_id"`
	Skill     string `json:"skill"`
	SkillType string `json:"skill_type"` // "have" or "want"
}

type SkillResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type SkillSearchResult struct {
	UserID       int    `json:"user_id"`
	Username     string `json:"username"`
	Name         string `json:"name"`
	ProfilePhoto string `json:"profile_photo"`
	Skill        string `json:"skill"`
	SkillType    string `json:"skill_type"`
}

// Add skill to user's profile
func AddSkill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate skill type
	if req.SkillType != "have" && req.SkillType != "want" {
		http.Error(w, "Invalid skill type. Must be 'have' or 'want'", http.StatusBadRequest)
		return
	}

	// Trim and validate skill
	skill := strings.TrimSpace(req.Skill)
	if skill == "" {
		http.Error(w, "Skill cannot be empty", http.StatusBadRequest)
		return
	}

	// Get current user's skills
	var currentSkills string
	var columnName string
	if req.SkillType == "have" {
		columnName = "skills_have"
	} else {
		columnName = "skills_want"
	}

	// Validate column name to prevent SQL injection
	if columnName != "skills_have" && columnName != "skills_want" {
		http.Error(w, "Invalid skill type", http.StatusBadRequest)
		return
	}

	var currentSkillsPtr *string
	err := db.DB.QueryRow(`SELECT `+columnName+` FROM users WHERE id = $1`, req.UserID).Scan(&currentSkillsPtr)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if currentSkillsPtr != nil {
		currentSkills = *currentSkillsPtr
	} else {
		currentSkills = ""
	}

	// Parse existing skills
	skills := []string{}
	if currentSkills != "" {
		skills = strings.Split(currentSkills, ",")
		for i, s := range skills {
			skills[i] = strings.TrimSpace(s)
		}
	}

	// Check if skill already exists
	for _, existingSkill := range skills {
		if strings.EqualFold(existingSkill, skill) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(SkillResponse{
				Success: false,
				Message: "Skill already exists",
			})
			return
		}
	}

	// Add new skill
	skills = append(skills, skill)
	updatedSkills := strings.Join(skills, ", ")

	// Update database
	_, err = db.DB.Exec(`UPDATE users SET `+columnName+` = $1 WHERE id = $2`, updatedSkills, req.UserID)
	if err != nil {
		http.Error(w, "Failed to update skills", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SkillResponse{
		Success: true,
		Message: "Skill added successfully",
	})
}

// Remove skill from user's profile
func RemoveSkill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate skill type
	if req.SkillType != "have" && req.SkillType != "want" {
		http.Error(w, "Invalid skill type. Must be 'have' or 'want'", http.StatusBadRequest)
		return
	}

	// Trim and validate skill
	skill := strings.TrimSpace(req.Skill)
	if skill == "" {
		http.Error(w, "Skill cannot be empty", http.StatusBadRequest)
		return
	}

	// Get current user's skills
	var currentSkills string
	var columnName string
	if req.SkillType == "have" {
		columnName = "skills_have"
	} else {
		columnName = "skills_want"
	}

	// Validate column name to prevent SQL injection
	if columnName != "skills_have" && columnName != "skills_want" {
		http.Error(w, "Invalid skill type", http.StatusBadRequest)
		return
	}

	var currentSkillsPtr *string
	err := db.DB.QueryRow(`SELECT `+columnName+` FROM users WHERE id = $1`, req.UserID).Scan(&currentSkillsPtr)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if currentSkillsPtr != nil {
		currentSkills = *currentSkillsPtr
	} else {
		currentSkills = ""
	}

	// Parse existing skills
	skills := []string{}
	if currentSkills != "" {
		skills = strings.Split(currentSkills, ",")
		for i, s := range skills {
			skills[i] = strings.TrimSpace(s)
		}
	}

	// Remove skill
	found := false
	newSkills := []string{}
	for _, existingSkill := range skills {
		if !strings.EqualFold(existingSkill, skill) {
			newSkills = append(newSkills, existingSkill)
		} else {
			found = true
		}
	}

	if !found {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(SkillResponse{
			Success: false,
			Message: "Skill not found",
		})
		return
	}

	updatedSkills := strings.Join(newSkills, ", ")

	// Update database
	_, err = db.DB.Exec(`UPDATE users SET `+columnName+` = $1 WHERE id = $2`, updatedSkills, req.UserID)
	if err != nil {
		http.Error(w, "Failed to update skills", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SkillResponse{
		Success: true,
		Message: "Skill removed successfully",
	})
}

// Search skills across all users
func SearchSkills(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	// Search in both skills_have and skills_want columns
	rows, err := db.DB.Query(`
		SELECT id, username, name, profile_photo, skills_have, skills_want
		FROM users 
		WHERE skills_have ILIKE $1 OR skills_want ILIKE $1
		ORDER BY username
	`, "%"+query+"%")
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []SkillSearchResult
	for rows.Next() {
		var userID int
		var username string
		var name *string
		var profilePhoto *string
		var skillsHavePtr, skillsWantPtr *string
		err := rows.Scan(&userID, &username, &name, &profilePhoto, &skillsHavePtr, &skillsWantPtr)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}

		// Handle NULL name and profile_photo fields
		var nameStr, profilePhotoStr string
		if name != nil {
			nameStr = *name
		} else {
			nameStr = username
		}
		if profilePhoto != nil {
			profilePhotoStr = *profilePhoto
		} else {
			profilePhotoStr = ""
		}

		var skillsHave, skillsWant string
		if skillsHavePtr != nil {
			skillsHave = *skillsHavePtr
		}
		if skillsWantPtr != nil {
			skillsWant = *skillsWantPtr
		}

		// Parse skills and add matching ones to results
		if skillsHave != "" {
			haveSkills := strings.Split(skillsHave, ",")
			for _, haveSkill := range haveSkills {
				trimmedSkill := strings.TrimSpace(haveSkill)
				if strings.Contains(strings.ToLower(trimmedSkill), strings.ToLower(query)) {
					results = append(results, SkillSearchResult{
						UserID:       userID,
						Username:     username,
						Name:         nameStr,
						ProfilePhoto: profilePhotoStr,
						Skill:        trimmedSkill,
						SkillType:    "have",
					})
				}
			}
		}

		if skillsWant != "" {
			wantSkills := strings.Split(skillsWant, ",")
			for _, wantSkill := range wantSkills {
				trimmedSkill := strings.TrimSpace(wantSkill)
				if strings.Contains(strings.ToLower(trimmedSkill), strings.ToLower(query)) {
					results = append(results, SkillSearchResult{
						UserID:       userID,
						Username:     username,
						Name:         nameStr,
						ProfilePhoto: profilePhotoStr,
						Skill:        trimmedSkill,
						SkillType:    "want",
					})
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if results == nil {
		results = []SkillSearchResult{}
	}
	json.NewEncoder(w).Encode(results)
}

// Get user's skills
func GetUserSkills(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	var skillsHavePtr, skillsWantPtr *string
	err = db.DB.QueryRow(`
		SELECT skills_have, skills_want 
		FROM users 
		WHERE id = $1
	`, userID).Scan(&skillsHavePtr, &skillsWantPtr)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Parse skills into arrays
	haveSkills := []string{}
	if skillsHavePtr != nil && *skillsHavePtr != "" {
		haveSkills = strings.Split(*skillsHavePtr, ",")
		for i, skill := range haveSkills {
			haveSkills[i] = strings.TrimSpace(skill)
		}
	}

	wantSkills := []string{}
	if skillsWantPtr != nil && *skillsWantPtr != "" {
		wantSkills = strings.Split(*skillsWantPtr, ",")
		for i, skill := range wantSkills {
			wantSkills[i] = strings.TrimSpace(skill)
		}
	}

	response := map[string]interface{}{
		"skills_have": haveSkills,
		"skills_want": wantSkills,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

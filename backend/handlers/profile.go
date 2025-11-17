package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"main/db"
	"main/models"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Helper functions to handle NULL values
func nullStringToString(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func nullTimeToString(nt sql.NullTime) string {
	if nt.Valid {
		return nt.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	return ""
}

func GetProfile(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get and validate user ID
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var userDB models.UserDB
	err = db.DB.QueryRow(`
        SELECT id, username, email, name, profile_photo, skills_have, skills_want, created_at, bio, location, availability, linkedin, github
        FROM users WHERE id = $1
    `, id).Scan(
		&userDB.ID,
		&userDB.Username,
		&userDB.Email,
		&userDB.Name,
		&userDB.ProfilePhoto,
		&userDB.SkillsHave,
		&userDB.SkillsWant,
		&userDB.CreatedAt,
		&userDB.Bio,
		&userDB.Location,
		&userDB.Availability,
		&userDB.LinkedIn,
		&userDB.Github,
	)

	// Convert to User model (handling NULL values)
	user := models.User{
		ID:           userDB.ID,
		Username:     userDB.Username,
		Email:        userDB.Email,
		Name:         nullStringToString(userDB.Name),
		ProfilePhoto: nullStringToString(userDB.ProfilePhoto),
		SkillsHave:   nullStringToString(userDB.SkillsHave),
		SkillsWant:   nullStringToString(userDB.SkillsWant),
		CreatedAt:    nullTimeToString(userDB.CreatedAt),
		Bio:          nullStringToString(userDB.Bio),
		Location:     nullStringToString(userDB.Location),
		Availability: nullStringToString(userDB.Availability),
		LinkedIn:     nullStringToString(userDB.LinkedIn),
		Github:       nullStringToString(userDB.Github),
	}

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
		} else {
			log.Printf("Database error getting profile: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	if err := json.NewEncoder(w).Encode(user); err != nil {
		log.Printf("Error encoding profile response: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse form data
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	// Get and validate user ID
	idStr := r.FormValue("id")
	if idStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get form values
	name := r.FormValue("name")
	photo := r.FormValue("profile_photo")
	skillsHave := r.FormValue("skills_have")
	skillsWant := r.FormValue("skills_want")
	bio := r.FormValue("bio")
	location := r.FormValue("location")
	availability := r.FormValue("availability")
	linkedin := r.FormValue("linkedin")
	github := r.FormValue("github")

	// Execute update query
	result, err := db.DB.Exec(`
        UPDATE users SET 
            name=$1, 
            profile_photo=$2,
            skills_have=$3,
            skills_want=$4,
            bio=$5,
            location=$6,
            availability=$7,
            linkedin=$8,
            github=$9
        WHERE id=$10
    `, name, photo, skillsHave, skillsWant, bio, location, availability, linkedin, github, id)

	if err != nil {
		log.Printf("Database error updating profile: %v", err)
		http.Error(w, "Failed to update profile", http.StatusInternalServerError)
		return
	}

	// Check if any rows were affected
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Error getting rows affected: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{"status": "success", "message": "Profile updated successfully"}
	json.NewEncoder(w).Encode(response)
}

func UploadProfilePhoto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (max 32MB)
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "Failed to parse form data", http.StatusBadRequest)
		return
	}

	// Get user ID from form
	userIDStr := r.FormValue("user_id")
	if userIDStr == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get uploaded file
	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type (only images)
	contentType := header.Header.Get("Content-Type")
	if !isValidImageType(contentType) {
		http.Error(w, "Invalid file type. Only JPEG, PNG, and GIF are allowed", http.StatusBadRequest)
		return
	}

	// Validate file size (max 5MB)
	if header.Size > 5*1024*1024 {
		http.Error(w, "File too large. Maximum size is 5MB", http.StatusBadRequest)
		return
	}

	// Generate unique filename
	ext := getFileExtension(header.Filename)
	filename := fmt.Sprintf("profile_%d_%d%s", userID, time.Now().Unix(), ext)

	// Save file to uploads directory
	uploadsDir := "./uploads/profiles"
	os.MkdirAll(uploadsDir, 0755)

	filePath := filepath.Join(uploadsDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Error creating file: %v", err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		log.Printf("Error saving file: %v", err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Update user's profile_photo in database
	photoURL := fmt.Sprintf("/uploads/profiles/%s", filename)
	_, err = db.DB.Exec("UPDATE users SET profile_photo = $1 WHERE id = $2", photoURL, userID)
	if err != nil {
		log.Printf("Error updating profile photo in database: %v", err)
		http.Error(w, "Failed to update profile", http.StatusInternalServerError)
		return
	}

	// Return success response with photo URL
	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{
		"status":    "success",
		"message":   "Profile photo updated successfully",
		"photo_url": photoURL,
	}
	json.NewEncoder(w).Encode(response)
}

// Helper function to get user's skills with resources
func GetUserSkillsWithResources(w http.ResponseWriter, r *http.Request) {
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
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	// Get user's skills and associated resources
	type SkillWithResources struct {
		SkillName string                   `json:"skill_name"`
		SkillType string                   `json:"skill_type"`
		Resources []map[string]interface{} `json:"resources,omitempty"`
	}

	var skills []SkillWithResources

	// Get skills_have
	var skillsHaveStr string
	err = db.DB.QueryRow("SELECT skills_have FROM users WHERE id = $1", userID).Scan(&skillsHaveStr)
	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if skillsHaveStr != "" {
		haveSkills := strings.Split(skillsHaveStr, ",")
		for _, skill := range haveSkills {
			skill = strings.TrimSpace(skill)
			if skill != "" {
				// Get resources for this skill
				resources := []map[string]interface{}{}
				rows, err := db.DB.Query(`
					SELECT r.id, r.title, r.file_size, r.difficulty_level, r.rating, r.download_count
					FROM skill_resources sr
					JOIN resources r ON sr.resource_id = r.id
					WHERE sr.skill_name = $1 AND sr.owner_id = $2
					ORDER BY r.created_at DESC
				`, skill, userID)
				if err == nil {
					defer rows.Close()
					for rows.Next() {
						var resource map[string]interface{}
						var id, title string
						var fileSize int64
						var difficultyLevel string
						var rating float64
						var downloadCount int

						err := rows.Scan(&id, &title, &fileSize, &difficultyLevel, &rating, &downloadCount)
						if err == nil {
							resource["id"] = id
							resource["title"] = title
							resource["file_size"] = fileSize
							resource["difficulty_level"] = difficultyLevel
							resource["rating"] = rating
							resource["download_count"] = downloadCount
						}
						resources = append(resources, resource)
					}
				}

				skills = append(skills, SkillWithResources{
					SkillName: skill,
					SkillType: "have",
					Resources: resources,
				})
			}
		}
	}

	// Get skills_want
	var skillsWantStr string
	err = db.DB.QueryRow("SELECT skills_want FROM users WHERE id = $1", userID).Scan(&skillsWantStr)
	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if skillsWantStr != "" {
		wantSkills := strings.Split(skillsWantStr, ",")
		for _, skill := range wantSkills {
			skill = strings.TrimSpace(skill)
			if skill != "" {
				// Get resources for this skill from other users
				resources := []map[string]interface{}{}
				rows, err := db.DB.Query(`
					SELECT r.id, r.title, r.file_size, r.difficulty_level, r.rating, r.download_count, u.username, u.name
					FROM skill_resources sr
					JOIN resources r ON sr.resource_id = r.id
					JOIN users u ON sr.owner_id = u.id
					WHERE sr.skill_name = $1 AND sr.is_public = true AND sr.owner_id != $2
					ORDER BY r.created_at DESC
					LIMIT 5
				`, skill, userID)
				if err == nil {
					defer rows.Close()
					for rows.Next() {
						var resource map[string]interface{}
						var id, title string
						var fileSize int64
						var difficultyLevel string
						var rating float64
						var downloadCount int
						var username, ownerName string

						err := rows.Scan(&id, &title, &fileSize, &difficultyLevel, &rating, &downloadCount, &username, &ownerName)
						if err == nil {
							resource["id"] = id
							resource["title"] = title
							resource["file_size"] = fileSize
							resource["difficulty_level"] = difficultyLevel
							resource["rating"] = rating
							resource["download_count"] = downloadCount
							resource["owner_username"] = username
							resource["owner_name"] = ownerName
						}
						resources = append(resources, resource)
					}
				}

				skills = append(skills, SkillWithResources{
					SkillName: skill,
					SkillType: "want",
					Resources: resources,
				})
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"skills_have":           skillsHaveStr,
		"skills_want":           skillsWantStr,
		"skills_with_resources": skills,
	}
	json.NewEncoder(w).Encode(response)
}

func isValidImageType(contentType string) bool {
	validTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
	}

	for _, validType := range validTypes {
		if contentType == validType {
			return true
		}
	}
	return false
}

func getFileExtension(filename string) string {
	ext := filepath.Ext(filename)
	if ext == "" {
		return ".jpg" // default extension
	}
	return ext
}

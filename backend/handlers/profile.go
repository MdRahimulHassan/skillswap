package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"main/db"
	"main/models"
	"net/http"
	"strconv"
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
        SELECT id, username, email, name, profile_photo, skills_have, skills_want, created_at
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

	// Execute update query
	result, err := db.DB.Exec(`
        UPDATE users SET 
            name=$1, 
            profile_photo=$2,
            skills_have=$3,
            skills_want=$4
        WHERE id=$5
    `, name, photo, skillsHave, skillsWant, id)

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

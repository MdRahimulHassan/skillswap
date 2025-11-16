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

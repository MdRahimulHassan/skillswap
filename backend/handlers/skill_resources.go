package handlers

import (
	"encoding/json"
	"main/db"
	"net/http"
	"strconv"
)

// Skill Resource Management
type SkillResourceRequest struct {
	UserID      int    `json:"user_id"`
	SkillName   string `json:"skill_name"`
	ResourceID  int    `json:"resource_id"`
	IsPublic    bool   `json:"is_public"`
	AutoApprove bool   `json:"auto_approve"`
}

type SkillResource struct {
	ID              int     `json:"id"`
	SkillName       string  `json:"skill_name"`
	OwnerID         int     `json:"owner_id"`
	ResourceID      int     `json:"resource_id"`
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	FileSize        int64   `json:"file_size"`
	MimeType        string  `json:"mime_type"`
	DifficultyLevel string  `json:"difficulty_level"`
	Rating          float64 `json:"rating"`
	DownloadCount   int     `json:"download_count"`
	CreatedAt       string  `json:"created_at"`
	OwnerUsername   string  `json:"owner_username"`
	OwnerName       string  `json:"owner_name"`
	OwnerPhoto      string  `json:"owner_photo"`
	IsPublic        bool    `json:"is_public"`
	AutoApprove     bool    `json:"auto_approve"`
}

// Add resource under skill
func AddSkillResource(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SkillResourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.UserID == 0 || req.SkillName == "" || req.ResourceID == 0 {
		http.Error(w, "user_id, skill_name, and resource_id are required", http.StatusBadRequest)
		return
	}

	// Check if user owns the resource
	var ownerID int
	err := db.DB.QueryRow("SELECT uploader_id FROM resources WHERE id = $1", req.ResourceID).Scan(&ownerID)
	if err != nil {
		http.Error(w, "Resource not found", http.StatusNotFound)
		return
	}

	if ownerID != req.UserID {
		http.Error(w, "You can only add resources to your own skills", http.StatusForbidden)
		return
	}

	// Check if resource already exists under this skill for this user
	var existingCount int
	err = db.DB.QueryRow(`
		SELECT COUNT(*) FROM skill_resources 
		WHERE skill_name = $1 AND owner_id = $2 AND resource_id = $3
	`, req.SkillName, req.UserID, req.ResourceID).Scan(&existingCount)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if existingCount > 0 {
		http.Error(w, "Resource already exists under this skill", http.StatusConflict)
		return
	}

	// Add to skill_resources table
	_, err = db.DB.Exec(`
		INSERT INTO skill_resources(skill_name, owner_id, resource_id, is_public, auto_approve)
		VALUES($1, $2, $3, $4, $5)
		ON CONFLICT (skill_name, owner_id, resource_id) DO NOTHING
	`, req.SkillName, req.UserID, req.ResourceID, req.IsPublic, req.AutoApprove)

	if err != nil {
		http.Error(w, "Failed to add skill resource", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{
		"status":  "success",
		"message": "Resource added to skill successfully",
	}
	json.NewEncoder(w).Encode(response)
}

// Get resources for a specific skill
func GetSkillResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	skillName := r.URL.Query().Get("skill_name")
	userIDStr := r.URL.Query().Get("user_id")

	if skillName == "" || userIDStr == "" {
		http.Error(w, "skill_name and user_id are required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	// Get resources for user's skill (both owned and public)
	query := `
		SELECT sr.id, r.title, r.description, r.file_size, r.mime_type, r.difficulty_level, r.rating, r.download_count, r.created_at,
			   u.username as owner_username, u.name as owner_name, u.profile_photo as owner_photo,
			   sr.is_public, sr.auto_approve
		FROM skill_resources sr
		JOIN resources r ON sr.resource_id = r.id
			LEFT JOIN users u ON sr.owner_id = u.id
		WHERE (sr.owner_id = $1 OR (sr.is_public = true AND sr.owner_id != $1))
			AND sr.skill_name = $2
		ORDER BY r.created_at DESC
	`

	rows, err := db.DB.Query(query, userID, skillName)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	defer rows.Close()

	var resources []SkillResource
	for rows.Next() {
		var resource SkillResource
		err := rows.Scan(
			&resource.ID, &resource.Title, &resource.Description, &resource.FileSize,
			&resource.MimeType, &resource.DifficultyLevel, &resource.Rating,
			&resource.DownloadCount, &resource.CreatedAt,
			&resource.OwnerUsername, &resource.OwnerName, &resource.OwnerPhoto,
			&resource.IsPublic, &resource.AutoApprove,
		)
		if err != nil {
			continue
		}
		resources = append(resources, resource)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}

// Get all skill resources for a user
func GetAllSkillResources(w http.ResponseWriter, r *http.Request) {
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

	query := `
		SELECT sr.skill_name, COUNT(*) as resource_count
		FROM skill_resources 
		WHERE owner_id = $1
		GROUP BY sr.skill_name
		ORDER BY sr.skill_name
	`

	rows, err := db.DB.Query(query, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	type SkillResourceCount struct {
		SkillName     string `json:"skill_name"`
		ResourceCount int    `json:"resource_count"`
	}

	var skillCounts []SkillResourceCount
	for rows.Next() {
		var count SkillResourceCount
		err := rows.Scan(&count.SkillName, &count.ResourceCount)
		if err != nil {
			continue
		}
		skillCounts = append(skillCounts, count)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(skillCounts)
}

package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"main/db"
	"net/http"
	"strconv"
	"time"
)

// P2P Connection Request/Response structures
type P2PConnectionRequest struct {
	RequesterID  int    `json:"requester_id"`
	TargetUserID int    `json:"target_user_id"`
	Skill        string `json:"skill"`
	Message      string `json:"message,omitempty"`
	ResourceIDs  []int  `json:"resource_ids,omitempty"`
}

type P2PConnectionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type P2PConnection struct {
	ID           int       `json:"id"`
	RequesterID  int       `json:"requester_id"`
	TargetUserID int       `json:"target_user_id"`
	SkillName    string    `json:"skill_name"`
	Status       string    `json:"status"` // pending, approved, rejected, cancelled
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// Additional fields for response
	RequesterName string `json:"requester_name,omitempty"`
	TargetName    string `json:"target_name,omitempty"`
}

type SkillConnection struct {
	SkillName    string                   `json:"skill_name"`
	OwnerID      int                      `json:"owner_id"`
	OwnerName    string                   `json:"owner_name"`
	OwnerPhoto   string                   `json:"owner_photo"`
	IsConnected  bool                     `json:"is_connected"`
	ConnectionID *int                     `json:"connection_id,omitempty"`
	Status       string                   `json:"status,omitempty"`
	Resources    []map[string]interface{} `json:"resources,omitempty"`
}

// Create P2P connection request
func CreateP2PConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req P2PConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.RequesterID == 0 || req.TargetUserID == 0 || req.Skill == "" {
		http.Error(w, "requester_id, target_user_id, and skill are required", http.StatusBadRequest)
		return
	}

	// Check if user is requesting from themselves
	if req.RequesterID == req.TargetUserID {
		http.Error(w, "Cannot request connection from yourself", http.StatusBadRequest)
		return
	}

	// Check if there's already a pending request
	var existingRequestID int
	err := db.DB.QueryRow(`
		SELECT id FROM p2p_connections 
		WHERE requester_id = $1 AND target_user_id = $2 AND skill_name = $3 AND status = 'pending'
	`, req.RequesterID, req.TargetUserID, req.Skill).Scan(&existingRequestID)

	if err == nil && existingRequestID > 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(P2PConnectionResponse{
			Success: false,
			Message: "You already have a pending connection request for this skill",
		})
		return
	}

	// Create connection request
	var requestID int
	err = db.DB.QueryRow(`
		INSERT INTO p2p_connections(requester_id, target_user_id, skill_name, message, status, created_at, updated_at)
		VALUES($1, $2, $3, $4, 'pending', NOW(), NOW())
		RETURNING id
	`, req.RequesterID, req.TargetUserID, req.Skill, req.Message).Scan(&requestID)

	if err != nil {
		http.Error(w, "Failed to create connection request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get user details for notification
	var requesterName, targetName string
	db.DB.QueryRow("SELECT username FROM users WHERE id = $1", req.RequesterID).Scan(&requesterName)
	db.DB.QueryRow("SELECT username FROM users WHERE id = $1", req.TargetUserID).Scan(&targetName)

	// Send notification to target user (this would be handled by WebSocket or notification system)
	log.Printf("P2P connection request created: %d -> %d for skill '%s'", req.RequesterID, req.TargetUserID, req.Skill)

	w.Header().Set("Content-Type", "application/json")
	response := P2PConnectionResponse{
		Success: true,
		Message: fmt.Sprintf("Connection request sent to %s for %s skill", targetName, req.Skill),
	}
	json.NewEncoder(w).Encode(response)
}

// Get P2P connection requests
func GetP2PConnections(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id parameter is required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	requestType := r.URL.Query().Get("type") // "sent" or "received"
	if requestType == "" {
		requestType = "received" // default
	}

	var query string
	var args []interface{}

	if requestType == "sent" {
		query = `
			SELECT pc.id, pc.requester_id, pc.target_user_id, pc.skill_name, pc.status, pc.message, 
				   pc.created_at, pc.updated_at,
				   req_user.username as requester_username, target_user.username as target_username
			FROM p2p_connections pc
			JOIN users req_user ON pc.requester_id = req_user.id
			JOIN users target_user ON pc.target_user_id = target_user.id
			WHERE pc.requester_id = $1
			ORDER BY pc.created_at DESC
		`
		args = []interface{}{userID}
	} else {
		query = `
			SELECT pc.id, pc.requester_id, pc.target_user_id, pc.skill_name, pc.status, pc.message, 
				   pc.created_at, pc.updated_at,
				   req_user.username as requester_username, target_user.username as target_username
			FROM p2p_connections pc
			JOIN users req_user ON pc.requester_id = req_user.id
			JOIN users target_user ON pc.target_user_id = target_user.id
			WHERE pc.target_user_id = $1
			ORDER BY pc.created_at DESC
		`
		args = []interface{}{userID}
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var connections []P2PConnection
	for rows.Next() {
		var conn P2PConnection
		err := rows.Scan(
			&conn.ID, &conn.RequesterID, &conn.TargetUserID, &conn.SkillName, &conn.Status,
			&conn.Message, &conn.CreatedAt, &conn.UpdatedAt,
			&conn.RequesterName, &conn.TargetName,
		)
		if err != nil {
			continue
		}
		connections = append(connections, conn)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(connections)
}

// Respond to P2P connection request
func RespondP2PConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RequestID   int    `json:"request_id"`
		UserID      int    `json:"user_id"`
		Response    string `json:"response"` // "approve" or "reject"
		ResourceIDs []int  `json:"resource_ids,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.RequestID == 0 || req.UserID == 0 || (req.Response != "approve" && req.Response != "reject") {
		http.Error(w, "Invalid request parameters", http.StatusBadRequest)
		return
	}

	// Check if user owns this request (is the target)
	var targetUserID int
	err := db.DB.QueryRow("SELECT target_user_id FROM p2p_connections WHERE id = $1", req.RequestID).Scan(&targetUserID)
	if err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	if targetUserID != req.UserID {
		http.Error(w, "You can only respond to requests sent to you", http.StatusForbidden)
		return
	}

	// Update request status
	newStatus := "rejected"
	if req.Response == "approve" {
		newStatus = "approved"
	}

	_, err = db.DB.Exec(`
		UPDATE p2p_connections 
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`, newStatus, req.RequestID)

	if err != nil {
		http.Error(w, "Failed to update request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get request details for response
	var requesterID int
	var skillName, message string
	db.DB.QueryRow("SELECT requester_id, skill_name, message FROM p2p_connections WHERE id = $1", req.RequestID).Scan(&requesterID, &skillName, &message)

	// If approved, create skill_resources entries for any resource_ids
	if req.Response == "approve" && len(req.ResourceIDs) > 0 {
		for _, resourceID := range req.ResourceIDs {
			// Check if resource exists and belongs to target user
			var ownerID int
			err := db.DB.QueryRow("SELECT uploader_id FROM resources WHERE id = $1", resourceID).Scan(&ownerID)
			if err == nil && ownerID == req.UserID {
				// Add to skill_resources if user owns the resource
				_, err = db.DB.Exec(`
					INSERT INTO skill_resources(skill_name, owner_id, resource_id, is_public, auto_approve)
					VALUES($1, $2, $3, true, true)
					ON CONFLICT (skill_name, owner_id, resource_id) DO NOTHING
				`, skillName, req.UserID, resourceID)
				if err != nil {
					log.Printf("Warning: Failed to add resource %d to skill_resources: %v", resourceID, err)
				}
			}
		}
	}

	// Get user names for notification
	var requesterName, targetName string
	db.DB.QueryRow("SELECT username FROM users WHERE id = $1", requesterID).Scan(&requesterName)
	db.DB.QueryRow("SELECT username FROM users WHERE id = $1", req.UserID).Scan(&targetName)

	responseMessage := fmt.Sprintf("Your connection request for %s skill has been %s", skillName, newStatus)
	if req.Response == "approve" {
		responseMessage = fmt.Sprintf("Connection approved! You can now access %s's resources", skillName)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(P2PConnectionResponse{
		Success: true,
		Message: responseMessage,
	})
}

// Get skill connections for a user
func GetSkillConnections(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id parameter is required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	// Get all skills the user has connections for (approved)
	query := `
		SELECT DISTINCT skill_name, 
			   CASE WHEN status = 'approved' THEN true ELSE false END as is_connected,
			   MIN(id) as connection_id
		FROM p2p_connections 
		WHERE (requester_id = $1 OR target_user_id = $1) AND status = 'approved'
		GROUP BY skill_name
		ORDER BY skill_name
	`

	rows, err := db.DB.Query(query, userID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var connections []SkillConnection
	for rows.Next() {
		var conn SkillConnection
		err := rows.Scan(
			&conn.SkillName, &conn.IsConnected, &conn.ConnectionID,
		)
		if err != nil {
			continue
		}
		connections = append(connections, conn)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(connections)
}

// Check if user has approved connection for a skill
func HasSkillConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	skillName := r.URL.Query().Get("skill_name")

	if userIDStr == "" || skillName == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"has_connection": false})
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	var hasConnection bool
	err = db.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM p2p_connections 
			WHERE (requester_id = $1 OR target_user_id = $1) 
			AND skill_name = $2 
			AND status = 'approved'
		)
	`, userID, skillName).Scan(&hasConnection)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"has_connection": hasConnection})
}

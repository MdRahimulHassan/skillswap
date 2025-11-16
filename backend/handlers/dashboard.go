package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"main/db"
	"net/http"
	"strconv"
	"strings"
)

type DashboardStats struct {
	SkillsOffered   int `json:"skills_offered"`
	SkillsRequested int `json:"skills_requested"`
	Messages        int `json:"messages"`
	Exchanges       int `json:"exchanges"`
}

func GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from query parameter
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

	stats := DashboardStats{}

	// Get skills offered (count of skills_have)
	var skillsHave sql.NullString
	err = db.DB.QueryRow("SELECT skills_have FROM users WHERE id = $1", userID).Scan(&skillsHave)
	if err != nil {
		log.Printf("Error getting user skills: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if skillsHave.Valid && skillsHave.String != "" {
		// Count skills by splitting on comma
		skillsList := parseSkills(skillsHave.String)
		stats.SkillsOffered = len(skillsList)
	}

	// Get skills requested (count of skills_want)
	var skillsWant sql.NullString
	err = db.DB.QueryRow("SELECT skills_want FROM users WHERE id = $1", userID).Scan(&skillsWant)
	if err != nil {
		log.Printf("Error getting user skills: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if skillsWant.Valid && skillsWant.String != "" {
		// Count skills by splitting on comma
		skillsList := parseSkills(skillsWant.String)
		stats.SkillsRequested = len(skillsList)
	}

	// Get messages count (sent and received)
	err = db.DB.QueryRow(`
		SELECT COUNT(*) FROM messages 
		WHERE sender_id = $1 OR receiver_id = $1
	`, userID).Scan(&stats.Messages)
	if err != nil {
		log.Printf("Error getting message count: %v", err)
		stats.Messages = 0
	}

	// Get exchanges count (unique conversations)
	err = db.DB.QueryRow(`
		SELECT COUNT(DISTINCT CASE 
			WHEN sender_id = $1 THEN receiver_id 
			ELSE sender_id 
		END) FROM messages 
		WHERE sender_id = $1 OR receiver_id = $1
	`, userID).Scan(&stats.Exchanges)
	if err != nil {
		log.Printf("Error getting exchange count: %v", err)
		stats.Exchanges = 0
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(stats); err != nil {
		log.Printf("Error encoding dashboard stats: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

// Helper function to parse skills from comma-separated string
func parseSkills(skills string) []string {
	if skills == "" {
		return []string{}
	}

	result := []string{}
	for _, skill := range strings.Split(skills, ",") {
		trimmed := strings.TrimSpace(skill)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

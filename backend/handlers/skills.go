package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"skillswap-backend/models"
	"skillswap-backend/utils"
)

func GetSkillsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id,name FROM skills")
		if err != nil {
			http.Error(w, "Error fetching skills", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var skills []models.Skill
		for rows.Next() {
			var s models.Skill
			rows.Scan(&s.ID, &s.Name)
			skills = append(skills, s)
		}
		json.NewEncoder(w).Encode(skills)
	}
}

func AddSkillHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Name == "" {
			http.Error(w, "Skill name is required", http.StatusBadRequest)
			return
		}
		// Check if skill already exists
		var existingID int
		err := db.QueryRow("SELECT id FROM skills WHERE name = $1", req.Name).Scan(&existingID)
		if err == nil {
			// Skill exists, return it
			json.NewEncoder(w).Encode(map[string]interface{}{"id": existingID, "name": req.Name})
			return
		}
		// Insert new skill
		var newID int
		err = db.QueryRow("INSERT INTO skills (name) VALUES ($1) RETURNING id", req.Name).Scan(&newID)
		if err != nil {
			http.Error(w, "Error adding skill", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"id": newID, "name": req.Name})
	}
}

func AddUserSkillHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("user_id")
		var us models.UserSkill
		json.NewDecoder(r.Body).Decode(&us)
		us.UserID = utils.ParseInt(userID)
		_, err := db.Exec(
			"INSERT INTO user_skills (user_id, skill_id, skill_type) VALUES ($1,$2,$3)",
			us.UserID, us.SkillID, us.SkillType,
		)
		if err != nil {
			http.Error(w, "Error adding skill", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}
}

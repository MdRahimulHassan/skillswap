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

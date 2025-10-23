package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func GetMatchesHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("user_id")
		query := `
SELECT DISTINCT u.id,u.name,u.bio,s1.name AS teach_skill,s2.name AS learn_skill
FROM users u
JOIN user_skills us1 ON u.id=us1.user_id AND us1.skill_type='teach'
JOIN user_skills us2 ON u.id=us2.user_id AND us2.skill_type='learn'
JOIN skills s1 ON us1.skill_id=s1.id
JOIN skills s2 ON us2.skill_id=s2.id
WHERE u.id != $1
AND EXISTS (SELECT 1 FROM user_skills WHERE user_id=$1 AND skill_id=us1.skill_id AND skill_type='learn')
AND EXISTS (SELECT 1 FROM user_skills WHERE user_id=$1 AND skill_id=us2.skill_id AND skill_type='teach')
LIMIT 10
`
		rows, err := db.Query(query, userID)
		if err != nil {
			http.Error(w, "Error fetching matches", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var matches []map[string]interface{}
		for rows.Next() {
			var id int
			var name, bio, teachSkill, learnSkill string
			rows.Scan(&id, &name, &bio, &teachSkill, &learnSkill)
			matches = append(matches, map[string]interface{}{
				"user_id":     id,
				"name":        name,
				"bio":         bio,
				"teach_skill": teachSkill,
				"learn_skill": learnSkill,
			})
		}
		json.NewEncoder(w).Encode(matches)
	}
}

func AcceptMatchHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}
}

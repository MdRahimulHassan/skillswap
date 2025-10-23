package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"skillswap-backend/models"
)

func GetUsersHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id,email,name,is_admin FROM users")
		if err != nil {
			http.Error(w, "Error fetching users", http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var users []models.User
		for rows.Next() {
			var u models.User
			rows.Scan(&u.ID, &u.Email, &u.Name, &u.IsAdmin)
			users = append(users, u)
		}
		json.NewEncoder(w).Encode(users)
	}
}

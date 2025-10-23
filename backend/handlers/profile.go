package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"skillswap-backend/models"
)

func GetProfileHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("user_id")
		var user models.User
		err := db.QueryRow(
			"SELECT id,email,name,bio,is_admin FROM users WHERE id=$1",
			userID,
		).Scan(&user.ID, &user.Email, &user.Name, &user.Bio, &user.IsAdmin)
		if err != nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(user)
	}
}

func UpdateProfileHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("user_id")
		var user models.User
		json.NewDecoder(r.Body).Decode(&user)
		_, err := db.Exec(
			"UPDATE users SET name=$1,bio=$2 WHERE id=$3",
			user.Name, user.Bio, userID,
		)
		if err != nil {
			http.Error(w, "Error updating profile", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

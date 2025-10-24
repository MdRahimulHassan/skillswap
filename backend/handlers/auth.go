package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"skillswap-backend/models"

	"golang.org/x/crypto/bcrypt"
	"github.com/golang-jwt/jwt/v4"
	"skillswap-backend/config"
)

func RegisterHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			models.User
			Password string `json:"password"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		_, err := db.Exec(
			"INSERT INTO users (email,password_hash,name,bio) VALUES ($1,$2,$3,$4)",
			req.Email, string(hashedPassword), req.Name, req.Bio,
		)
		if err != nil {
			http.Error(w, "User already exists", http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"message": "User registered"})
	}
}

func LoginHandler(db *sql.DB, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var creds struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		json.NewDecoder(r.Body).Decode(&creds)

		var id int
		var hash string
		err := db.QueryRow("SELECT id,password_hash FROM users WHERE email=$1", creds.Email).Scan(&id, &hash)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(creds.Password)) != nil {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": id,
		})
		tokenString, _ := token.SignedString([]byte(cfg.JWTSecret))
		json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
	}
}

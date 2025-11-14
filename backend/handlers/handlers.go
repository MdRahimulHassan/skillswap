package handlers

import (
	"encoding/json"
	"main/db"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	json.NewDecoder(r.Body).Decode(&req)

	var storedHash string
	var username string

	err := db.DB.QueryRow("SELECT username, password_hash FROM users WHERE email=$1", req.Email).
		Scan(&username, &storedHash)

	if err != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password)) != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:  "session",
		Value: username,
		Path:  "/",
	})

	w.Write([]byte("Login successful"))
}

package handlers

import (
	"encoding/json"
	"main/db"
	"net/http"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

type SignupRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendErrorResponse(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if len(req.Username) < 3 {
		sendErrorResponse(w, "Username must be at least 3 characters", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		sendErrorResponse(w, "Password must be at least 8 characters", http.StatusBadRequest)
		return
	}
	if !isValidEmail(req.Email) {
		sendErrorResponse(w, "Invalid email address", http.StatusBadRequest)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		sendErrorResponse(w, "Error processing password", http.StatusInternalServerError)
		return
	}

	_, err = db.DB.Exec(
		"INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)",
		req.Username, req.Email, string(hashed),
	)

	if err != nil {
		sendErrorResponse(w, "User already exists", http.StatusConflict)
		return
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{"status": "success", "message": "Account created successfully"}
	json.NewEncoder(w).Encode(response)
}

func isValidEmail(email string) bool {
	emailRegex := `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
	matched, _ := regexp.MatchString(emailRegex, email)
	return matched
}

func sendErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	response := map[string]string{"status": "error", "message": message}
	json.NewEncoder(w).Encode(response)
}

package handlers

import (
	"encoding/json"
	"main/db"
	"main/models"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
}

func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var userID int
	var username string
	var storedHash string

	err := db.DB.QueryRow(`
        SELECT id, username, password_hash
        FROM users
        WHERE email=$1
    `, req.Email).Scan(&userID, &username, &storedHash)

	if err != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password)) != nil {
		http.Error(w, "Invalid email or password", 401)
		return
	}

	// (Optional) Session cookie
	http.SetCookie(w, &http.Cookie{
		Name:  "session_user",
		Value: username,
		Path:  "/",
	})

	// Return JSON with user_id for WebSocket
	res := LoginResponse{
		UserID:   userID,
		Username: username,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// GET /api/users/search?q=query - Search for users
func SearchUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		// Return all users if no query
		query = ""
	}

	// Get current user ID to exclude from results
	currentUserID := r.URL.Query().Get("exclude")

	var sqlQuery string
	var args []interface{}

	if query != "" {
		sqlQuery = `
            SELECT id, username, email, name, profile_photo, skills_have, skills_want
            FROM users 
            WHERE (username ILIKE $1 OR name ILIKE $1 OR skills_have ILIKE $1 OR skills_want ILIKE $1)
        `
		args = append(args, "%"+query+"%")

		if currentUserID != "" {
			sqlQuery += " AND id != $" + strconv.Itoa(len(args)+1)
			args = append(args, currentUserID)
		}
	} else {
		sqlQuery = `
            SELECT id, username, email, name, profile_photo, skills_have, skills_want
            FROM users
        `
		if currentUserID != "" {
			sqlQuery += " WHERE id != $1"
			args = append(args, currentUserID)
		}
	}

	sqlQuery += " ORDER BY username LIMIT 20"

	rows, err := db.DB.Query(sqlQuery, args...)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Email,
			&user.Name,
			&user.ProfilePhoto,
			&user.SkillsHave,
			&user.SkillsWant,
		)
		if err != nil {
			continue
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

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
		sendErrorResponse(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, "Invalid request body", http.StatusBadRequest)
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
		sendErrorResponse(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password)) != nil {
		sendErrorResponse(w, "Invalid email or password", http.StatusUnauthorized)
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

	// Convert exclude to int if provided
	var excludeUserID int
	if currentUserID != "" {
		if id, err := strconv.Atoi(currentUserID); err == nil {
			excludeUserID = id
		}
	}

	var sqlQuery string
	var args []interface{}

	if query != "" {
		sqlQuery = `
            SELECT id, username, email, name, profile_photo, skills_have, skills_want
            FROM users 
            WHERE (username ILIKE $1 OR name ILIKE $1 OR skills_have ILIKE $1 OR skills_want ILIKE $1)
        `
		args = append(args, "%"+query+"%")

		if excludeUserID > 0 {
			sqlQuery += " AND id != $" + strconv.Itoa(len(args)+1)
			args = append(args, excludeUserID)
		}
	} else {
		sqlQuery = `
            SELECT id, username, email, name, profile_photo, skills_have, skills_want
            FROM users
        `
		if excludeUserID > 0 {
			sqlQuery += " WHERE id != $1"
			args = append(args, excludeUserID)
		}
	}

	sqlQuery += " ORDER BY username LIMIT 20"

	rows, err := db.DB.Query(sqlQuery, args...)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var userDB models.UserDB
		err := rows.Scan(
			&userDB.ID,
			&userDB.Username,
			&userDB.Email,
			&userDB.Name,
			&userDB.ProfilePhoto,
			&userDB.SkillsHave,
			&userDB.SkillsWant,
		)
		if err != nil {
			continue
		}

		// Convert to User model
		user := models.User{
			ID:           userDB.ID,
			Username:     userDB.Username,
			Email:        userDB.Email,
			Name:         userDB.Name.String,
			ProfilePhoto: userDB.ProfilePhoto.String,
			SkillsHave:   userDB.SkillsHave.String,
			SkillsWant:   userDB.SkillsWant.String,
		}

		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

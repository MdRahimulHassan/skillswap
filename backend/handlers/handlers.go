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
    json.NewDecoder(r.Body).Decode(&req)

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

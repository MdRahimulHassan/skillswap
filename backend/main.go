package main

import (
	"log"
	"main/db"
	"main/handlers"
	"net/http"
)

func main() {
	db.Connect()

	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./frontend/static")))))


	http.HandleFunc("/api/signup", cors(handlers.Signup))
	http.HandleFunc("/api/login", cors(handlers.Login))
	http.HandleFunc("/api/ws", cors(handlers.HandleWebSocket))
http.HandleFunc("/api/chats", cors(handlers.GetChatList))
http.HandleFunc("/api/history", cors(handlers.GetHistory))
http.HandleFunc("/api/upload", cors(handlers.UploadFile))
http.HandleFunc("/api/file", cors(handlers.FileInfo))
http.HandleFunc("/api/profile", cors(handlers.GetProfile))
http.HandleFunc("/api/profile/update", cors(handlers.UpdateProfile))

// Serve HTML pages
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    if r.URL.Path == "/" {
        http.ServeFile(w, r, "./frontend/login.html")
        return
    }
    if r.URL.Path == "/login" {
        http.ServeFile(w, r, "./frontend/login.html")
        return
    }
    if r.URL.Path == "/signup" {
        http.ServeFile(w, r, "./frontend/signup.html")
        return
    }
    if r.URL.Path == "/dashboard" {
        http.ServeFile(w, r, "./frontend/dashboard.html")
        return
    }
    if r.URL.Path == "/profile" {
        http.ServeFile(w, r, "./frontend/profile.html")
        return
    }
    if r.URL.Path == "/chat" {
        http.ServeFile(w, r, "./frontend/chat.html")
        return
    }
    http.NotFound(w, r)
})


// Serve files
http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))


	log.Println("Backend running on http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		
		// Allow multiple origins for development
		allowedOrigins := []string{
			"http://127.0.0.1:5500",
			"http://localhost:5500",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}
		
		// Check if origin is allowed
		isAllowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				isAllowed = true
				break
			}
		}
		
		if isAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" { // Preflight
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

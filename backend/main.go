package main

import (
	"log"
	"main/db"
	"main/handlers"
	"net/http"
)

func main() {
	db.Connect()

	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))


	http.HandleFunc("/api/signup", cors(handlers.Signup))
	http.HandleFunc("/api/login", cors(handlers.Login))
	http.HandleFunc("/api/ws", cors(handlers.HandleWebSocket))
http.HandleFunc("/api/chats", cors(handlers.GetChatList))
http.HandleFunc("/api/history", cors(handlers.GetHistory))
http.HandleFunc("/api/upload", cors(handlers.UploadFile))
http.HandleFunc("/api/file", cors(handlers.FileInfo))
http.HandleFunc("/api/profile", cors(handlers.GetProfile))
http.HandleFunc("/api/profile/update", cors(handlers.UpdateProfile))

// Serve profile page
http.HandleFunc("/profile", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "./profile.html")
})


// Serve files
http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))


	log.Println("Backend running on http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5500")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" { // Preflight
			return
		}

		next(w, r)
	}
}

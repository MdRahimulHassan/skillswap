package main

import (
	"log"
	"main/db"
	"main/handlers"
	"net/http"
)

func main() {
	db.Connect()

	http.HandleFunc("/api/signup", cors(handlers.Signup))
	http.HandleFunc("/api/login", cors(handlers.Login))

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

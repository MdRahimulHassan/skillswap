package main

import (
	"log"
	"net/http"
	"os"
	"skillswap-backend/config"
	"skillswap-backend/database"
	"skillswap-backend/handlers"
	"skillswap-backend/middleware"

	gorillaHandlers "github.com/gorilla/handlers" // alias to avoid conflict
	"github.com/gorilla/mux"
)

func main() {
	// Load config and connect to DB
	cfg := config.Load()
	db := database.Connect()
	defer db.Close()

	// Create tables
	if err := database.CreateTables(db); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	// Router
	r := mux.NewRouter()

	// Public routes
	r.HandleFunc("/register", handlers.RegisterHandler(db)).Methods("POST")
	r.HandleFunc("/login", handlers.LoginHandler(db, cfg)).Methods("POST")

	// Protected routes
	api := r.PathPrefix("/api").Subrouter()
	api.Use(middleware.JWTMiddleware(cfg))
	api.HandleFunc("/profile", handlers.GetProfileHandler(db)).Methods("GET")
	api.HandleFunc("/profile", handlers.UpdateProfileHandler(db)).Methods("PUT")
	api.HandleFunc("/skills", handlers.GetSkillsHandler(db)).Methods("GET")
	api.HandleFunc("/user-skills", handlers.AddUserSkillHandler(db)).Methods("POST")
	api.HandleFunc("/matches", handlers.GetMatchesHandler(db)).Methods("GET")
	api.HandleFunc("/matches/{id}/accept", handlers.AcceptMatchHandler(db)).Methods("POST")
	api.HandleFunc("/messages/{matchId}", handlers.GetMessagesHandler(db)).Methods("GET")
	api.HandleFunc("/messages", handlers.SendMessageHandler(db)).Methods("POST")

	// Admin routes
	admin := api.PathPrefix("/admin").Subrouter()
	admin.Use(middleware.AdminMiddleware(db))
	admin.HandleFunc("/users", handlers.GetUsersHandler(db)).Methods("GET")

	// CORS
	cors := gorillaHandlers.CORS(
		gorillaHandlers.AllowedOrigins([]string{"http://localhost:3000"}),
		gorillaHandlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE"}),
		gorillaHandlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("Server starting on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors(r)))
}

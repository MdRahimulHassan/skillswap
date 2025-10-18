package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	_ "github.com/lib/pq"
	"github.com/golang-jwt/jwt/v4"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// --------------------- Models ---------------------

type User struct {
	ID      int    `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Bio     string `json:"bio"`
	IsAdmin bool   `json:"is_admin"`
}

type Skill struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type UserSkill struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	SkillID   int    `json:"skill_id"`
	SkillType string `json:"skill_type"`
}

type Match struct {
	ID       int    `json:"id"`
	User1ID  int    `json:"user1_id"`
	User2ID  int    `json:"user2_id"`
	Skill1ID int    `json:"skill1_id"`
	Skill2ID int    `json:"skill2_id"`
	Status   string `json:"status"`
}

type Message struct {
	ID       int    `json:"id"`
	MatchID  int    `json:"match_id"`
	SenderID int    `json:"sender_id"`
	Content  string `json:"content"`
	SentAt   string `json:"sent_at"`
}

// --------------------- Globals ---------------------

var db *sql.DB
var jwtSecret []byte

// --------------------- Init ---------------------

func init() {
	// Load .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not loaded")
	}

	// Load JWT secret
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET must be set in .env")
	}
	jwtSecret = []byte(secret)
}

// --------------------- Main ---------------------

func main() {
	var err error

	// Build DB connection string from env
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
	)

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("DB connection error:", err)
	}
	defer db.Close()

	// Test connection
	err = db.Ping()
	if err != nil {
		log.Fatal("DB ping failed:", err)
	}

	// Create tables
	err = createTables()
	if err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	// Router
	r := mux.NewRouter()

	// Public routes
	r.HandleFunc("/register", registerHandler).Methods("POST")
	r.HandleFunc("/login", loginHandler).Methods("POST")

	// Protected routes
	protected := r.PathPrefix("/api").Subrouter()
	protected.Use(jwtMiddleware)
	protected.HandleFunc("/profile", getProfileHandler).Methods("GET")
	protected.HandleFunc("/profile", updateProfileHandler).Methods("PUT")
	protected.HandleFunc("/skills", getSkillsHandler).Methods("GET")
	protected.HandleFunc("/user-skills", addUserSkillHandler).Methods("POST")
	protected.HandleFunc("/matches", getMatchesHandler).Methods("GET")
	protected.HandleFunc("/matches/{id}/accept", acceptMatchHandler).Methods("POST")
	protected.HandleFunc("/messages/{matchId}", getMessagesHandler).Methods("GET")
	protected.HandleFunc("/messages", sendMessageHandler).Methods("POST")

	// Admin routes
	admin := protected.PathPrefix("/admin").Subrouter()
	admin.Use(adminMiddleware)
	admin.HandleFunc("/users", getUsersHandler).Methods("GET")

	// CORS
	corsObj := handlers.CORS(
		handlers.AllowedOrigins([]string{"http://localhost:3000"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("Server starting on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, corsObj(r)))
}

// --------------------- Table Creation ---------------------

func createTables() error {
	schema := `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS user_skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    skill_type VARCHAR(10) CHECK (skill_type IN ('teach', 'learn')),
    UNIQUE(user_id, skill_id, skill_type)
);

CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    skill1_id INTEGER REFERENCES skills(id),
    skill2_id INTEGER REFERENCES skills(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id, skill1_id, skill2_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swap_requests (
    id SERIAL PRIMARY KEY,
    from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    requested_skill_id INTEGER REFERENCES skills(id),
    offered_skill_id INTEGER REFERENCES skills(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("error creating tables: %w", err)
	}

	// Insert sample skills
	_, err = db.Exec("INSERT INTO skills (name) VALUES ('Programming'),('Cooking'),('Music'),('Languages') ON CONFLICT (name) DO NOTHING")
	if err != nil {
		log.Println("Warning: could not insert sample skills:", err)
	}

	return nil
}

// --------------------- Middleware ---------------------

func jwtMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing token", http.StatusUnauthorized)
			return
		}
		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			r.Header.Set("user_id", fmt.Sprintf("%.0f", claims["user_id"]))
		}
		next.ServeHTTP(w, r)
	})
}

func adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("user_id")
		var isAdmin bool
		err := db.QueryRow("SELECT is_admin FROM users WHERE id = $1", userID).Scan(&isAdmin)
		if err != nil || !isAdmin {
			http.Error(w, "Admin access required", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --------------------- Handlers ---------------------

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		User
		Password string `json:"password"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	_, err := db.Exec("INSERT INTO users (email, password_hash, name, bio) VALUES ($1,$2,$3,$4)", req.Email, string(hashedPassword), req.Name, req.Bio)
	if err != nil {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"message": "User registered"})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	json.NewDecoder(r.Body).Decode(&creds)
	var id int
	var hash string
	err := db.QueryRow("SELECT id, password_hash FROM users WHERE email=$1", creds.Email).Scan(&id, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(creds.Password)) != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": id})
	tokenString, _ := token.SignedString(jwtSecret)
	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}

func getProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("user_id")
	var user User
	err := db.QueryRow("SELECT id,email,name,bio,is_admin FROM users WHERE id=$1", userID).Scan(&user.ID, &user.Email, &user.Name, &user.Bio, &user.IsAdmin)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(user)
}

func updateProfileHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("user_id")
	var user User
	json.NewDecoder(r.Body).Decode(&user)
	_, err := db.Exec("UPDATE users SET name=$1,bio=$2 WHERE id=$3", user.Name, user.Bio, userID)
	if err != nil {
		http.Error(w, "Error updating profile", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func getSkillsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id,name FROM skills")
	if err != nil {
		http.Error(w, "Error fetching skills", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var skills []Skill
	for rows.Next() {
		var s Skill
		rows.Scan(&s.ID, &s.Name)
		skills = append(skills, s)
	}
	json.NewEncoder(w).Encode(skills)
}

func addUserSkillHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("user_id")
	var us UserSkill
	json.NewDecoder(r.Body).Decode(&us)
	us.UserID = parseInt(userID)
	_, err := db.Exec("INSERT INTO user_skills (user_id, skill_id, skill_type) VALUES ($1,$2,$3)", us.UserID, us.SkillID, us.SkillType)
	if err != nil {
		http.Error(w, "Error adding skill", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func getMatchesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("user_id")
	query := `
SELECT DISTINCT u.id,u.name,u.bio,s1.name AS teach_skill,s2.name AS learn_skill
FROM users u
JOIN user_skills us1 ON u.id=us1.user_id AND us1.skill_type='teach'
JOIN user_skills us2 ON u.id=us2.user_id AND us2.skill_type='learn'
JOIN skills s1 ON us1.skill_id=s1.id
JOIN skills s2 ON us2.skill_id=s2.id
WHERE u.id != $1
AND EXISTS (SELECT 1 FROM user_skills WHERE user_id=$1 AND skill_id=us1.skill_id AND skill_type='learn')
AND EXISTS (SELECT 1 FROM user_skills WHERE user_id=$1 AND skill_id=us2.skill_id AND skill_type='teach')
LIMIT 10
`
	rows, err := db.Query(query, userID)
	if err != nil {
		http.Error(w, "Error fetching matches", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var matches []map[string]interface{}
	for rows.Next() {
		var id int
		var name, bio, teachSkill, learnSkill string
		rows.Scan(&id, &name, &bio, &teachSkill, &learnSkill)
		matches = append(matches, map[string]interface{}{
			"user_id":     id,
			"name":        name,
			"bio":         bio,
			"teach_skill": teachSkill,
			"learn_skill": learnSkill,
		})
	}
	json.NewEncoder(w).Encode(matches)
}

func acceptMatchHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func getMessagesHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode([]Message{})
}

func sendMessageHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusCreated)
}

func getUsersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id,email,name,is_admin FROM users")
	if err != nil {
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		rows.Scan(&u.ID, &u.Email, &u.Name, &u.IsAdmin)
		users = append(users, u)
	}
	json.NewEncoder(w).Encode(users)
}

// --------------------- Helpers ---------------------

func parseInt(s string) int {
	var i int
	fmt.Sscanf(s, "%d", &i)
	return i
}

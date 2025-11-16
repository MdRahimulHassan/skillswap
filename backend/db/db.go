package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var DB *sql.DB

func Connect() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found:", err)
	}

	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "postgres")
	dbname := getEnv("DB_NAME", "skillswap")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	// Configure connection pool
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	if err = DB.Ping(); err != nil {
		log.Fatal("DB connection failed:", err)
	}

	log.Println("Connected to PostgreSQL successfully")

	// Run migrations
	if err := runMigrations(); err != nil {
		log.Println("Failed to run migrations:", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func runMigrations() error {
	log.Println("Running database migrations...")

	// Create users table
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			username VARCHAR(255) UNIQUE NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			name VARCHAR(255),
			profile_photo TEXT,
			skills_have TEXT,
			skills_want TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create users table: %v", err)
	}

	// Create messages table
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id SERIAL PRIMARY KEY,
			sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content TEXT,
			is_file BOOLEAN DEFAULT FALSE,
			file_id INT,
			delivered BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create messages table: %v", err)
	}

	// Create files table
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS files (
			id SERIAL PRIMARY KEY,
			filename TEXT NOT NULL,
			stored_name TEXT NOT NULL,
			size BIGINT NOT NULL,
			mime_type TEXT,
			uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create files table: %v", err)
	}

	// Create index
	_, err = DB.Exec(`
		CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (sender_id, receiver_id, created_at)
	`)
	if err != nil {
		return fmt.Errorf("failed to create index: %v", err)
	}

	log.Println("Database migrations completed")
	return nil
}

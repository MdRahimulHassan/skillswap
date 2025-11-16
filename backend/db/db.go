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
		log.Fatal("Failed to run migrations:", err)
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

	// Check if migration table exists
	var exists bool
	err := DB.QueryRow(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'schema_migrations'
        )
    `).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to check migration table: %v", err)
	}

	// Create migration table if it doesn't exist
	if !exists {
		_, err := DB.Exec(`
            CREATE TABLE schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP DEFAULT NOW()
            )
        `)
		if err != nil {
			return fmt.Errorf("failed to create migration table: %v", err)
		}
	}

	// Run migrations here if needed
	log.Println("Database migrations completed")
	return nil
}

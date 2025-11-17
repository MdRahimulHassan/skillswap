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

func runP2PMigration() error {
	log.Println("Running P2P migration...")

	// P2P Resources table
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS resources (
			id SERIAL PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			skill_category VARCHAR(100),
			file_hash VARCHAR(64) UNIQUE,
			file_name VARCHAR(255),
			file_size BIGINT NOT NULL,
			mime_type VARCHAR(100),
			uploader_id INT REFERENCES users(id) ON DELETE CASCADE,
			piece_count INTEGER NOT NULL,
			piece_size INTEGER DEFAULT 1048576,
			pieces_hash TEXT NOT NULL,
			tags TEXT[],
			difficulty_level VARCHAR(20) DEFAULT 'intermediate',
			rating DECIMAL(3,2) DEFAULT 0.0,
			download_count INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create resources table: %v", err)
	}

	// P2P swarm tracking
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS swarms (
			resource_id INT REFERENCES resources(id) ON DELETE CASCADE PRIMARY KEY,
			total_seeders INTEGER DEFAULT 0,
			total_leechers INTEGER DEFAULT 0,
			total_completed INTEGER DEFAULT 0,
			last_activity TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create swarms table: %v", err)
	}

	// Peer participation tracking
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS peer_participation (
			id SERIAL PRIMARY KEY,
			user_id INT REFERENCES users(id) ON DELETE CASCADE,
			resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
			status VARCHAR(20) DEFAULT 'leeching',
			progress DECIMAL(5,2) DEFAULT 0.0,
			pieces_have TEXT[],
			upload_speed BIGINT DEFAULT 0,
			download_speed BIGINT DEFAULT 0,
			uploaded_total BIGINT DEFAULT 0,
			downloaded_total BIGINT DEFAULT 0,
			last_announce TIMESTAMP DEFAULT NOW(),
			UNIQUE(user_id, resource_id)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create peer_participation table: %v", err)
	}

	// Torrent metadata
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS torrents (
			resource_id INT REFERENCES resources(id) ON DELETE CASCADE PRIMARY KEY,
			announce_url VARCHAR(255),
			piece_hashes TEXT[],
			created_by INT REFERENCES users(id),
			created_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create torrents table: %v", err)
	}

	// Resource ratings and feedback
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS resource_ratings (
			id SERIAL PRIMARY KEY,
			resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
			user_id INT REFERENCES users(id) ON DELETE CASCADE,
			rating INTEGER CHECK (rating >= 1 AND rating <= 5),
			review TEXT,
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(resource_id, user_id)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create resource_ratings table: %v", err)
	}

	// Create indexes for P2P tables
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(skill_category)",
		"CREATE INDEX IF NOT EXISTS idx_resources_tags ON resources USING GIN(tags)",
		"CREATE INDEX IF NOT EXISTS idx_resources_hash ON resources(file_hash)",
		"CREATE INDEX IF NOT EXISTS idx_peer_participation_user ON peer_participation(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_peer_participation_resource ON peer_participation(resource_id)",
		"CREATE INDEX IF NOT EXISTS idx_peer_participation_status ON peer_participation(status)",
	}

	for _, idx := range indexes {
		_, err = DB.Exec(idx)
		if err != nil {
			return fmt.Errorf("failed to create index: %v", err)
		}
	}

	log.Println("P2P migration completed successfully")
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func runSkillConnectionsMigration() error {
	log.Println("Running skill connections migration...")

	// Create skill_resources table to link resources to specific skills
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS skill_resources (
			id SERIAL PRIMARY KEY,
			skill_name VARCHAR(255) NOT NULL,
			owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
			is_public BOOLEAN DEFAULT true,
			auto_approve BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(skill_name, owner_id, resource_id)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create skill_resources table: %v", err)
	}

	// Create p2p_connections table to manage connection requests and approvals
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS p2p_connections (
			id SERIAL PRIMARY KEY,
			requester_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			resource_owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			skill_name VARCHAR(255) NOT NULL,
			status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
			message TEXT,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create p2p_connections table: %v", err)
	}

	// Add connection_status column to peer_participation if it doesn't exist
	_, err = DB.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
						   WHERE table_name='peer_participation' AND column_name='connection_status') THEN
				ALTER TABLE peer_participation ADD COLUMN connection_status VARCHAR(20) DEFAULT 'none';
			END IF;
		END $$
	`)
	if err != nil {
		return fmt.Errorf("failed to add connection_status column: %v", err)
	}

	// Create indexes for better performance
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_skill_resources_skill_name ON skill_resources(skill_name)",
		"CREATE INDEX IF NOT EXISTS idx_skill_resources_owner ON skill_resources(owner_id)",
		"CREATE INDEX IF NOT EXISTS idx_skill_resources_resource ON skill_resources(resource_id)",
		"CREATE INDEX IF NOT EXISTS idx_p2p_connections_requester ON p2p_connections(requester_id)",
		"CREATE INDEX IF NOT EXISTS idx_p2p_connections_owner ON p2p_connections(resource_owner_id)",
		"CREATE INDEX IF NOT EXISTS idx_p2p_connections_status ON p2p_connections(status)",
		"CREATE INDEX IF NOT EXISTS idx_p2p_connections_skill ON p2p_connections(skill_name)",
	}

	for _, idx := range indexes {
		_, err = DB.Exec(idx)
		if err != nil {
			return fmt.Errorf("failed to create index: %v", err)
		}
	}

	// Create function to check if user has approved connection for a skill
	_, err = DB.Exec(`
		CREATE OR REPLACE FUNCTION has_approved_connection(
			user_id INT,
			skill_name VARCHAR
		) RETURNS BOOLEAN AS $$
		BEGIN
			RETURN EXISTS (
				SELECT 1 FROM p2p_connections 
				WHERE requester_id = user_id 
				AND skill_name = has_approved_connection.skill_name
				AND status = 'approved'
			);
		END;
		$$ LANGUAGE plpgsql
	`)
	if err != nil {
		return fmt.Errorf("failed to create has_approved_connection function: %v", err)
	}

	// Migrate existing resources to skill_resources if they have skill_category
	_, err = DB.Exec(`
		INSERT INTO skill_resources (skill_name, owner_id, resource_id, is_public)
		SELECT 
			r.skill_category,
			r.uploader_id,
			r.id,
			true
		FROM resources r
		WHERE r.skill_category IS NOT NULL
		ON CONFLICT (skill_name, owner_id, resource_id) DO NOTHING
	`)
	if err != nil {
		log.Printf("Warning: Failed to migrate existing resources: %v", err)
	}

	log.Println("Skill connections migration completed successfully")
	return nil
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

	// Run P2P migration
	if err := runP2PMigration(); err != nil {
		return fmt.Errorf("failed to run P2P migration: %v", err)
	}

	// Run skill connections migration
	if err := runSkillConnectionsMigration(); err != nil {
		return fmt.Errorf("failed to run skill connections migration: %v", err)
	}

	log.Println("Database migrations completed")
	return nil
}

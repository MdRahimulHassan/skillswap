package database

import (
	"database/sql"
	"fmt"
	"log"
)

func CreateTables(db *sql.DB) error {
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

	_, err = db.Exec("INSERT INTO skills (name) VALUES ('Programming'),('Cooking'),('Music'),('Languages') ON CONFLICT (name) DO NOTHING")
	if err != nil {
		log.Println("Warning: could not insert sample skills:", err)
	}

	return nil
}

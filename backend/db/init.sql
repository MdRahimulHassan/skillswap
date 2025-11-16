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
);

-- messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  is_file BOOLEAN DEFAULT FALSE,
  file_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- files table
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT,
  uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (sender_id, receiver_id, created_at);



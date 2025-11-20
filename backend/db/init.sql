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
  delivered BOOLEAN DEFAULT FALSE,
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

-- P2P Resources table for decentralized sharing
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    skill_category VARCHAR(100),
    file_hash VARCHAR(64) UNIQUE, -- SHA-256 for P2P identification
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    uploader_id INT REFERENCES users(id) ON DELETE CASCADE,
    piece_count INTEGER NOT NULL,
    piece_size INTEGER DEFAULT 1048576, -- 1MB pieces
    pieces_hash TEXT NOT NULL, -- Concatenated hash of all pieces
    tags TEXT[], -- PostgreSQL array for searchable tags
    difficulty_level VARCHAR(20) DEFAULT 'intermediate',
    rating DECIMAL(3,2) DEFAULT 0.0,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- P2P swarm tracking
CREATE TABLE IF NOT EXISTS swarms (
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE PRIMARY KEY,
    total_seeders INTEGER DEFAULT 0,
    total_leechers INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT NOW()
);

-- Peer participation tracking
CREATE TABLE IF NOT EXISTS peer_participation (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'leeching', -- seeding, leeching, completed, paused
    progress DECIMAL(5,2) DEFAULT 0.0, -- Download completion percentage
    pieces_have TEXT[], -- Array of piece indices user has
    upload_speed BIGINT DEFAULT 0, -- bytes per second
    download_speed BIGINT DEFAULT 0, -- bytes per second
    uploaded_total BIGINT DEFAULT 0,
    downloaded_total BIGINT DEFAULT 0,
    last_announce TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, resource_id)
);

-- Torrent metadata
CREATE TABLE IF NOT EXISTS torrents (
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE PRIMARY KEY,
    announce_url VARCHAR(255),
    piece_hashes TEXT[], -- Individual hash for each piece
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Resource ratings and feedback
CREATE TABLE IF NOT EXISTS resource_ratings (
    id SERIAL PRIMARY KEY,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource_id, user_id)
);

CREATE TABLE IF NOT EXISTS activity_log(
    id SERIAL PRIMARY KEY,
    log_time TIMESTAMP DEFAULT NOW(),
    activity_type VARCHAR(30),
    descr VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(skill_category);
CREATE INDEX IF NOT EXISTS idx_resources_tags ON resources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_resources_hash ON resources(file_hash);
CREATE INDEX IF NOT EXISTS idx_peer_participation_user ON peer_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_peer_participation_resource ON peer_participation(resource_id);
CREATE INDEX IF NOT EXISTS idx_peer_participation_status ON peer_participation(status);



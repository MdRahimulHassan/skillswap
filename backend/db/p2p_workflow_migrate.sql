-- SkillSwap P2P Workflow Schema Updates
-- Adds tables for skill resource requests and approval workflow

-- Skill Resources table - links skills to P2P resources
CREATE TABLE IF NOT EXISTS skill_resources (
    id SERIAL PRIMARY KEY,
    skill_name VARCHAR(255) NOT NULL,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
    owner_id INT REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true, -- Publicly discoverable or request-only
    auto_approve BOOLEAN DEFAULT false, -- Auto-approve download requests
    difficulty_level VARCHAR(20) DEFAULT 'intermediate',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(skill_name, resource_id, owner_id)
);

-- P2P Download Requests table
CREATE TABLE IF NOT EXISTS download_requests (
    id SERIAL PRIMARY KEY,
    skill_resource_id INT REFERENCES skill_resources(id) ON DELETE CASCADE,
    requester_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    message TEXT, -- Request message from requester
    response_message TEXT, -- Owner's response
    requested_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    expires_at TIMESTAMP, -- Request expiration
    UNIQUE(skill_resource_id, requester_id)
);

-- P2P Transfer Sessions table - tracks active transfers
CREATE TABLE IF NOT EXISTS transfer_sessions (
    id SERIAL PRIMARY KEY,
    download_request_id INT REFERENCES download_requests(id) ON DELETE CASCADE,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
    requester_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'initializing', -- initializing, downloading, completed, failed, paused
    progress DECIMAL(5,2) DEFAULT 0.0,
    download_speed BIGINT DEFAULT 0,
    pieces_completed TEXT[], -- Array of completed piece indices
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    last_activity TIMESTAMP DEFAULT NOW(),
    UNIQUE(download_request_id)
);

-- Learning Progress table - tracks skill acquisition through P2P
CREATE TABLE IF NOT EXISTS learning_progress (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, mastered
    completion_percentage DECIMAL(5,2) DEFAULT 0.0,
    time_spent INTERVAL DEFAULT '0 minutes',
    last_accessed TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    notes TEXT,
    UNIQUE(user_id, skill_name, resource_id)
);

-- Resource Chat Rooms table
CREATE TABLE IF NOT EXISTS resource_chat_rooms (
    id SERIAL PRIMARY KEY,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Resource Chat Participants table
CREATE TABLE IF NOT EXISTS resource_chat_participants (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES resource_chat_rooms(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(room_id, user_id)
);

-- Resource Messages table (extends existing messages)
CREATE TABLE IF NOT EXISTS resource_messages (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES resource_chat_rooms(id) ON DELETE CASCADE,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, system, file, progress
    metadata JSONB, -- For progress updates, file info, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_skill_resources_skill ON skill_resources(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_resources_owner ON skill_resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_skill_resources_public ON skill_resources(is_public);
CREATE INDEX IF NOT EXISTS idx_download_requests_status ON download_requests(status);
CREATE INDEX IF NOT EXISTS idx_download_requests_requester ON download_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_transfer_sessions_status ON transfer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_transfer_sessions_requester ON transfer_sessions(requester_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_skill ON learning_progress(skill_name);
CREATE INDEX IF NOT EXISTS idx_resource_messages_room ON resource_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_resource_messages_created ON resource_messages(created_at);

-- Update existing tables to support new workflow
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_skill_resource BOOLEAN DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS associated_skill VARCHAR(255);
ALTER TABLE peer_participation ADD COLUMN IF NOT EXISTS session_id INT REFERENCES transfer_sessions(id) ON DELETE SET NULL;

-- Views for common queries
CREATE OR REPLACE VIEW public.skill_resources_with_details AS
SELECT 
    sr.id,
    sr.skill_name,
    sr.resource_id,
    sr.owner_id,
    sr.is_public,
    sr.auto_approve,
    sr.difficulty_level,
    sr.description,
    sr.created_at,
    r.title as resource_title,
    r.file_size,
    r.download_count,
    u.username as owner_username,
    u.name as owner_name,
    s.total_seeders,
    s.total_leechers,
    COALESCE(AVG(rr.rating), 0) as average_rating
FROM skill_resources sr
JOIN resources r ON sr.resource_id = r.id
JOIN users u ON sr.owner_id = u.id
LEFT JOIN swarms s ON r.id = s.resource_id
LEFT JOIN resource_ratings rr ON r.id = rr.resource_id
GROUP BY sr.id, r.title, r.file_size, r.download_count, u.username, u.name, s.total_seeders, s.total_leechers;

CREATE OR REPLACE VIEW public.user_learning_summary AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT lp.skill_name) as skills_learning,
    COUNT(DISTINCT CASE WHEN lp.status = 'completed' THEN lp.skill_name END) as skills_completed,
    SUM(EXTRACT(EPOCH FROM lp.time_spent)) as total_learning_seconds,
    AVG(lp.completion_percentage) as average_progress
FROM users u
LEFT JOIN learning_progress lp ON u.id = lp.user_id
GROUP BY u.id, u.username;
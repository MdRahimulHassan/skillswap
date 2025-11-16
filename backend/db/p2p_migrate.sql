-- Comprehensive P2P Migration Script
-- This script integrates P2P functionality with existing data

-- Start transaction
BEGIN;

-- Create P2P tables if they don't exist
-- (These may already exist in init.sql but we ensure they're created safely)

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

-- Create indexes for P2P tables if they don't exist
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(skill_category);
CREATE INDEX IF NOT EXISTS idx_resources_tags ON resources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_resources_hash ON resources(file_hash);
CREATE INDEX IF NOT EXISTS idx_peer_participation_user ON peer_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_peer_participation_resource ON peer_participation(resource_id);
CREATE INDEX IF NOT EXISTS idx_peer_participation_status ON peer_participation(status);

-- Migration: Convert existing skills to resources
-- This creates placeholder resources for users who have skills

-- Create a function to safely parse skills from text
CREATE OR REPLACE FUNCTION parse_skills(skills_text TEXT) 
RETURNS TEXT[] AS $$
DECLARE
    skills_array TEXT[];
BEGIN
    -- Handle NULL or empty input
    IF skills_text IS NULL OR skills_text = '' THEN
        RETURN ARRAY[]::TEXT[];
    END IF;
    
    -- Split by comma and clean up
    SELECT ARRAY_AGG(TRIM(skill)) INTO skills_array
    FROM unnest(string_to_array(skills_text, ',')) AS skill
    WHERE TRIM(skill) != '';
    
    RETURN COALESCE(skills_array, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- Migrate skills_have to resources (users offering to teach)
INSERT INTO resources (title, description, skill_category, file_hash, file_size, mime_type, uploader_id, piece_count, piece_size, pieces_hash, tags, difficulty_level)
SELECT 
    'Skill: ' || TRIM(skill),
    'User ' || u.username || ' offers to teach: ' || TRIM(skill),
    'teaching',
    'skill_' || md5(u.username || '_' || TRIM(skill)), -- Generate unique hash
    0, -- No file size for skill offerings
    'text/skill',
    u.id,
    1, -- Single piece
    1048576, -- Standard piece size
    'skill_placeholder', -- Placeholder hash
    ARRAY[TRIM(skill)], -- Tags
    'intermediate'
FROM users u, 
     unnest(parse_skills(u.skills_have)) AS skill
WHERE u.skills_have IS NOT NULL 
  AND u.skills_have != ''
  AND NOT EXISTS (
      SELECT 1 FROM resources r 
      WHERE r.title = 'Skill: ' || TRIM(skill) 
        AND r.uploader_id = u.id
        AND r.skill_category = 'teaching'
  )
ON CONFLICT (file_hash) DO NOTHING;

-- Migrate skills_want to resources (users looking to learn)
INSERT INTO resources (title, description, skill_category, file_hash, file_size, mime_type, uploader_id, piece_count, piece_size, pieces_hash, tags, difficulty_level)
SELECT 
    'Learning Request: ' || TRIM(skill),
    'User ' || u.username || ' wants to learn: ' || TRIM(skill),
    'learning',
    'learning_' || md5(u.username || '_' || TRIM(skill)), -- Generate unique hash
    0, -- No file size for learning requests
    'text/learning',
    u.id,
    1, -- Single piece
    1048576, -- Standard piece size
    'learning_placeholder', -- Placeholder hash
    ARRAY[TRIM(skill)], -- Tags
    'beginner'
FROM users u, 
     unnest(parse_skills(u.skills_want)) AS skill
WHERE u.skills_want IS NOT NULL 
  AND u.skills_want != ''
  AND NOT EXISTS (
      SELECT 1 FROM resources r 
      WHERE r.title = 'Learning Request: ' || TRIM(skill) 
        AND r.uploader_id = u.id
        AND r.skill_category = 'learning'
  )
ON CONFLICT (file_hash) DO NOTHING;

-- Create user resource linking system
-- This table links users to resources they're interested in or participating in

CREATE TABLE IF NOT EXISTS user_resources (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
    relationship_type VARCHAR(20) NOT NULL, -- 'owner', 'participant', 'interested', 'completed'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, resource_id, relationship_type)
);

-- Create index for user_resources
CREATE INDEX IF NOT EXISTS idx_user_resources_user ON user_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resources_resource ON user_resources(resource_id);
CREATE INDEX IF NOT EXISTS idx_user_resources_type ON user_resources(relationship_type);

-- Link users to their created resources (teaching offerings)
INSERT INTO user_resources (user_id, resource_id, relationship_type)
SELECT DISTINCT r.uploader_id, r.id, 'owner'
FROM resources r
WHERE r.skill_category = 'teaching'
  AND NOT EXISTS (
      SELECT 1 FROM user_resources ur 
      WHERE ur.user_id = r.uploader_id 
        AND ur.resource_id = r.id 
        AND ur.relationship_type = 'owner'
  );

-- Link users to their learning requests
INSERT INTO user_resources (user_id, resource_id, relationship_type)
SELECT DISTINCT r.uploader_id, r.id, 'interested'
FROM resources r
WHERE r.skill_category = 'learning'
  AND NOT EXISTS (
      SELECT 1 FROM user_resources ur 
      WHERE ur.user_id = r.uploader_id 
        AND ur.resource_id = r.id 
        AND ur.relationship_type = 'interested'
  );

-- Initialize swarm data for existing resources
INSERT INTO swarms (resource_id, total_seeders, total_leechers, total_completed, last_activity)
SELECT r.id, 0, 0, 0, NOW()
FROM resources r
WHERE NOT EXISTS (
    SELECT 1 FROM swarms s WHERE s.resource_id = r.id
);

-- Create a view for easy access to user skills and resources
CREATE OR REPLACE VIEW user_skill_resources AS
SELECT 
    u.id as user_id,
    u.username,
    u.name,
    CASE 
        WHEN r.skill_category = 'teaching' THEN 'offers'
        WHEN r.skill_category = 'learning' THEN 'wants'
        ELSE 'other'
    END as relationship_type,
    TRIM(unnest(r.tags)) as skill,
    r.title,
    r.description,
    r.created_at as resource_created_at
FROM users u
JOIN resources r ON r.uploader_id = u.id
WHERE r.skill_category IN ('teaching', 'learning')
  AND array_length(r.tags, 1) > 0;

-- Create a function to update user's skill resources when their skills change
CREATE OR REPLACE FUNCTION update_user_skill_resources()
RETURNS TRIGGER AS $$
BEGIN
    -- When skills_have or skills_want changes, update corresponding resources
    IF TG_OP = 'UPDATE' THEN
        -- Delete old teaching resources
        DELETE FROM resources 
        WHERE uploader_id = NEW.id 
          AND skill_category = 'teaching'
          AND title LIKE 'Skill: %';
        
        -- Delete old learning resources
        DELETE FROM resources 
        WHERE uploader_id = NEW.id 
          AND skill_category = 'learning'
          AND title LIKE 'Learning Request: %';
        
        -- Recreate teaching resources
        INSERT INTO resources (title, description, skill_category, file_hash, file_size, mime_type, uploader_id, piece_count, piece_size, pieces_hash, tags, difficulty_level)
        SELECT 
            'Skill: ' || TRIM(skill),
            'User ' || NEW.username || ' offers to teach: ' || TRIM(skill),
            'teaching',
            'skill_' || md5(NEW.username || '_' || TRIM(skill)),
            0,
            'text/skill',
            NEW.id,
            1,
            1048576,
            'skill_placeholder',
            ARRAY[TRIM(skill)],
            'intermediate'
        FROM unnest(parse_skills(NEW.skills_have)) AS skill
        WHERE TRIM(skill) != '';
        
        -- Recreate learning resources
        INSERT INTO resources (title, description, skill_category, file_hash, file_size, mime_type, uploader_id, piece_count, piece_size, pieces_hash, tags, difficulty_level)
        SELECT 
            'Learning Request: ' || TRIM(skill),
            'User ' || NEW.username || ' wants to learn: ' || TRIM(skill),
            'learning',
            'learning_' || md5(NEW.username || '_' || TRIM(skill)),
            0,
            'text/learning',
            NEW.id,
            1,
            1048576,
            'learning_placeholder',
            ARRAY[TRIM(skill)],
            'beginner'
        FROM unnest(parse_skills(NEW.skills_want)) AS skill
        WHERE TRIM(skill) != '';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update skill resources when user skills change
DROP TRIGGER IF EXISTS trigger_update_user_skill_resources ON users;
CREATE TRIGGER trigger_update_user_skill_resources
    AFTER UPDATE OF skills_have, skills_want ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_skill_resources();

-- Create a summary table for P2P statistics
CREATE TABLE IF NOT EXISTS p2p_statistics (
    id SERIAL PRIMARY KEY,
    total_resources INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    active_seeders INTEGER DEFAULT 0,
    active_leechers INTEGER DEFAULT 0,
    total_downloads BIGINT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Initialize or update statistics
INSERT INTO p2p_statistics (total_resources, total_users, active_seeders, active_leechers, total_downloads, last_updated)
SELECT 
    (SELECT COUNT(*) FROM resources),
    (SELECT COUNT(*) FROM users),
    (SELECT COUNT(DISTINCT user_id) FROM peer_participation WHERE status = 'seeding'),
    (SELECT COUNT(DISTINCT user_id) FROM peer_participation WHERE status = 'leeching'),
    COALESCE((SELECT SUM(download_count) FROM resources), 0),
    NOW()
ON CONFLICT (id) DO UPDATE SET
    total_resources = EXCLUDED.total_resources,
    total_users = EXCLUDED.total_users,
    active_seeders = EXCLUDED.active_seeders,
    active_leechers = EXCLUDED.active_leechers,
    total_downloads = EXCLUDED.total_downloads,
    last_updated = EXCLUDED.last_updated;

-- Create a function to get P2P statistics
CREATE OR REPLACE FUNCTION get_p2p_statistics()
RETURNS TABLE (
    total_resources INTEGER,
    total_users INTEGER,
    active_seeders INTEGER,
    active_leechers INTEGER,
    total_downloads BIGINT,
    last_updated TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT ps.total_resources, ps.total_users, ps.active_seeders, ps.active_leechers, ps.total_downloads, ps.last_updated
    FROM p2p_statistics ps
    ORDER BY ps.last_updated DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Commit the migration
COMMIT;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'P2P Migration completed successfully';
    RAISE NOTICE 'Migrated skills to resources system';
    RAISE NOTICE 'Created user resource linking system';
    RAISE NOTICE 'Initialized P2P statistics';
END $$;
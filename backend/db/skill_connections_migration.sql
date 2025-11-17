-- SkillSwap Database Migration for Skill-Based Resource Organization and P2P Connection Management
-- Run this script to add new tables and modify existing structure

-- Create skill_resources table to link resources to specific skills
CREATE TABLE IF NOT EXISTS skill_resources (
    id SERIAL PRIMARY KEY,
    skill_name VARCHAR(255) NOT NULL,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    auto_approve BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(skill_name, owner_id, resource_id)
);

-- Create p2p_connections table to manage connection requests and approvals
CREATE TABLE IF NOT EXISTS p2p_connections (
    id SERIAL PRIMARY KEY,
    requester_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_skill_resources_skill_name ON skill_resources(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_resources_owner ON skill_resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_skill_resources_resource ON skill_resources(resource_id);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_requester ON p2p_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_target ON p2p_connections(target_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_status ON p2p_connections(status);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_skill ON p2p_connections(skill_name);

-- Add connection_status column to peer_participation table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='peer_participation' AND column_name='connection_status') THEN
        ALTER TABLE peer_participation ADD COLUMN connection_status VARCHAR(20) DEFAULT 'none';
    END IF;
END $$;

-- Create function to check if user has approved connection for a skill
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
$$ LANGUAGE plpgsql;

-- Insert sample data for testing (optional)
-- This can be removed in production
DO $$
BEGIN
    -- Check if there are any existing resources to migrate
    IF EXISTS (SELECT 1 FROM resources LIMIT 1) THEN
        -- Migrate existing resources to skill_resources if they have skill_category
        INSERT INTO skill_resources (skill_name, owner_id, resource_id, is_public)
        SELECT 
            r.skill_category,
            r.uploader_id,
            r.id,
            true
        FROM resources r
        WHERE r.skill_category IS NOT NULL
        ON CONFLICT (skill_name, owner_id, resource_id) DO NOTHING;
    END IF;
END $$;

-- Create view for skill-based resource listing
CREATE OR REPLACE VIEW skill_resource_list AS
SELECT 
    sr.id,
    sr.skill_name,
    sr.owner_id,
    sr.resource_id,
    sr.is_public,
    sr.auto_approve,
    sr.created_at,
    r.title,
    r.description,
    r.file_size,
    r.difficulty_level,
    r.rating,
    r.download_count,
    u.username as owner_username,
    u.name as owner_name,
    u.profile_photo as owner_photo
FROM skill_resources sr
JOIN resources r ON sr.resource_id = r.id
JOIN users u ON sr.owner_id = u.id;

-- Create view for connection management
CREATE OR REPLACE VIEW connection_requests AS
SELECT 
    pc.id,
    pc.requester_id,
    pc.target_user_id,
    pc.skill_name,
    pc.status,
    pc.message,
    pc.created_at,
    pc.updated_at,
    req_user.username as requester_username,
    req_user.name as requester_name,
    target_user.username as target_username,
    target_user.name as target_name
FROM p2p_connections pc
JOIN users req_user ON pc.requester_id = req_user.id
JOIN users target_user ON pc.target_user_id = target_user.id;

COMMIT;
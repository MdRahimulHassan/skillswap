-- P2P Integration Migration
-- Add tables for P2P resource requests and skill-based connections

-- Create p2p_requests table for managing connection requests
CREATE TABLE IF NOT EXISTS p2p_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for p2p_requests
CREATE INDEX IF NOT EXISTS idx_p2p_requests_requester ON p2p_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_p2p_requests_target ON p2p_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_requests_status ON p2p_requests(status);
CREATE INDEX IF NOT EXISTS idx_p2p_requests_skill ON p2p_requests(skill);

-- Create p2p_connections table for approved connections
CREATE TABLE IF NOT EXISTS p2p_connections (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    request_id INTEGER REFERENCES p2p_requests(id) ON DELETE SET NULL,
    established_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    UNIQUE(user1_id, user2_id, skill)
);

-- Create indexes for p2p_connections
CREATE INDEX IF NOT EXISTS idx_p2p_connections_user1 ON p2p_connections(user1_id);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_user2 ON p2p_connections(user2_id);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_skill ON p2p_connections(skill);

-- Add skill_category column to resources table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='resources' AND column_name='skill_category') THEN
        ALTER TABLE resources ADD COLUMN skill_category VARCHAR(255);
    END IF;
END $$;

-- Create index for resources skill_category
CREATE INDEX IF NOT EXISTS idx_resources_skill_category ON resources(skill_category);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for p2p_requests updated_at
DROP TRIGGER IF EXISTS update_p2p_requests_updated_at ON p2p_requests;
CREATE TRIGGER update_p2p_requests_updated_at 
    BEFORE UPDATE ON p2p_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
-- Migration script to add missing columns to users table
-- Run this script to update existing databases

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='name') THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(255);
    END IF;

    -- Add profile_photo column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='profile_photo') THEN
        ALTER TABLE users ADD COLUMN profile_photo TEXT;
    END IF;

    -- Add skills_have column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='skills_have') THEN
        ALTER TABLE users ADD COLUMN skills_have TEXT;
    END IF;

    -- Add skills_want column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='skills_want') THEN
        ALTER TABLE users ADD COLUMN skills_want TEXT;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Update existing users to have default values
UPDATE users SET name = username WHERE name IS NULL;
UPDATE users SET profile_photo = 'static/images/default.svg' WHERE profile_photo IS NULL;
UPDATE users SET skills_have = '' WHERE skills_have IS NULL;
UPDATE users SET skills_want = '' WHERE skills_want IS NULL;

COMMIT;
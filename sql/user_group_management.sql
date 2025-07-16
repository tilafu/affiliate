-- Add columns to support user group management and personal groups

-- Update chat_groups table to support personal and public groups
ALTER TABLE chat_groups 
ADD COLUMN IF NOT EXISTS is_personal_group BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Update users table to store personal group reference
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS personal_group_id INTEGER REFERENCES chat_groups(id);

-- Update chat_group_members to include roles
ALTER TABLE chat_group_members 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_groups_personal ON chat_groups(is_personal_group);
CREATE INDEX IF NOT EXISTS idx_chat_groups_public ON chat_groups(is_public);
CREATE INDEX IF NOT EXISTS idx_chat_groups_owner ON chat_groups(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_users_personal_group ON users(personal_group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_role ON chat_group_members(role);

-- Update existing groups to be public by default (except personal ones)
UPDATE chat_groups 
SET is_public = true 
WHERE is_personal_group = false OR is_personal_group IS NULL;

-- Add some default common groups if they don't exist
INSERT INTO chat_groups (name, description, is_public, is_personal_group)
SELECT 'General Discussion', 'Welcome to the general discussion group! Chat with other community members.', true, false
WHERE NOT EXISTS (SELECT 1 FROM chat_groups WHERE name = 'General Discussion');

INSERT INTO chat_groups (name, description, is_public, is_personal_group)
SELECT 'Announcements', 'Stay updated with the latest news and announcements.', true, false
WHERE NOT EXISTS (SELECT 1 FROM chat_groups WHERE name = 'Announcements');

INSERT INTO chat_groups (name, description, is_public, is_personal_group)
SELECT 'Help & Support', 'Get help and support from our community and team.', true, false
WHERE NOT EXISTS (SELECT 1 FROM chat_groups WHERE name = 'Help & Support');

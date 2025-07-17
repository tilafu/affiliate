-- Complete Chat System Migration
-- This script creates all necessary tables for the chat system

-- Create chat_groups table
CREATE TABLE IF NOT EXISTS chat_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    group_type VARCHAR(20) DEFAULT 'standard',
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);  

-- Create chat_fake_users table
CREATE TABLE IF NOT EXISTS chat_fake_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    avatar_url VARCHAR(255),
    bio TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_group_members table for real users
CREATE TABLE IF NOT EXISTS chat_group_members (
    group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);

-- Create chat_group_fake_members table for fake users
CREATE TABLE IF NOT EXISTS chat_group_fake_members (
    group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
    fake_user_id INTEGER REFERENCES chat_fake_users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id),
    PRIMARY KEY (group_id, fake_user_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url VARCHAR(255),
    media_type VARCHAR(50),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    fake_user_id INTEGER REFERENCES chat_fake_users(id) ON DELETE SET NULL,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sent_by_admin BOOLEAN DEFAULT FALSE,
    parent_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
    timestamps VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_admin_logs table
CREATE TABLE IF NOT EXISTS chat_admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    fake_user_id INTEGER REFERENCES chat_fake_users(id),
    details JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_scheduled_messages table
CREATE TABLE IF NOT EXISTS chat_scheduled_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    fake_user_id INTEGER NOT NULL REFERENCES chat_fake_users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url VARCHAR(255),
    media_type VARCHAR(50),
    scheduled_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50),
    admin_id INTEGER NOT NULL REFERENCES users(id),
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_fake_user_id ON chat_messages(fake_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_fake_members_fake_user_id ON chat_group_fake_members(fake_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_admin_logs_admin_id ON chat_admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_admin_logs_action_type ON chat_admin_logs(action_type);

-- Insert some sample data for testing

-- Sample chat groups
INSERT INTO chat_groups (name, description, created_by) 
SELECT 'General Discussion', 'Main chat group for all users', id 
FROM users WHERE username = 'admin' 
ON CONFLICT DO NOTHING;

INSERT INTO chat_groups (name, description, created_by) 
SELECT 'VIP Members', 'Exclusive chat for VIP members', id 
FROM users WHERE username = 'admin' 
ON CONFLICT DO NOTHING;

-- Sample fake users
INSERT INTO chat_fake_users (username, display_name, bio, created_by) 
SELECT 'bot_alice', 'Alice Helper', 'I''m here to help with any questions!', id 
FROM users WHERE username = 'admin' 
ON CONFLICT (username) DO NOTHING;

INSERT INTO chat_fake_users (username, display_name, bio, created_by) 
SELECT 'bot_bob', 'Bob Assistant', 'Your friendly neighborhood assistant', id 
FROM users WHERE username = 'admin' 
ON CONFLICT (username) DO NOTHING;

-- Add fake users to groups
INSERT INTO chat_group_fake_members (group_id, fake_user_id, added_by)
SELECT cg.id, cfu.id, u.id
FROM chat_groups cg, chat_fake_users cfu, users u
WHERE cg.name = 'General Discussion' 
  AND cfu.username = 'bot_alice'
  AND u.username = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO chat_group_fake_members (group_id, fake_user_id, added_by)
SELECT cg.id, cfu.id, u.id
FROM chat_groups cg, chat_fake_users cfu, users u
WHERE cg.name = 'VIP Members' 
  AND cfu.username = 'bot_bob'
  AND u.username = 'admin'
ON CONFLICT DO NOTHING;

-- Sample welcome messages
INSERT INTO chat_messages (group_id, fake_user_id, content)
SELECT cg.id, cfu.id, 'Welcome to the General Discussion! Feel free to ask any questions.'
FROM chat_groups cg, chat_fake_users cfu
WHERE cg.name = 'General Discussion' AND cfu.username = 'bot_alice'
ON CONFLICT DO NOTHING;

INSERT INTO chat_messages (group_id, fake_user_id, content)
SELECT cg.id, cfu.id, 'Welcome to the VIP Members area! This is an exclusive space for our premium users.'
FROM chat_groups cg, chat_fake_users cfu
WHERE cg.name = 'VIP Members' AND cfu.username = 'bot_bob'
ON CONFLICT DO NOTHING;

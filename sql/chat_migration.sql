-- Chat system migration script
-- This script adds the necessary tables for the chat feature

-- Create chat_groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    group_type VARCHAR(20) DEFAULT 'standard',
    avatar_url VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create chat_fake_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_fake_users (
    id SERIAL PRIMARY KEY,
    display_name VARCHAR(100),
    avatar_url VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_group_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_group_members (
    group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Create chat_group_fake_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_group_fake_members (
    group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
    fake_user_id INTEGER REFERENCES chat_fake_users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by INTEGER REFERENCES users(id),
    PRIMARY KEY (group_id, fake_user_id)
);

-- Create chat_messages table if it doesn't exist
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_admin_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_scheduled_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_scheduled_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    media_url VARCHAR(255),
    media_type VARCHAR(50),
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    fake_user_id INTEGER REFERENCES chat_fake_users(id),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_fake_user_id ON chat_messages(fake_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_id ON chat_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_fake_members_fake_user_id ON chat_group_fake_members(fake_user_id);

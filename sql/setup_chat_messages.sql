-- SQL script to set up the chat_messages table

-- Check if chat_messages table exists
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('fake_user', 'admin')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'link')),
    admin_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster retrieval
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_type ON chat_messages(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Add a constraint to ensure either fake_user or admin exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_user_check'
    ) THEN
        ALTER TABLE chat_messages
        ADD CONSTRAINT chat_messages_user_check
        CHECK (
            (user_type = 'fake_user' AND EXISTS (SELECT 1 FROM chat_fake_users WHERE id = user_id)) OR
            (user_type = 'admin' AND EXISTS (SELECT 1 FROM users WHERE id = user_id AND role = 'admin'))
        );
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Skipping constraint creation: %', SQLERRM;
END $$;

-- Create a function to update the message count in chat_groups
CREATE OR REPLACE FUNCTION update_chat_group_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chat_groups SET message_count = message_count + 1 WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_groups SET message_count = message_count - 1 WHERE id = OLD.group_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update message count when messages are added or deleted
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_group_message_count_trigger'
    ) THEN
        CREATE TRIGGER update_chat_group_message_count_trigger
        AFTER INSERT OR DELETE ON chat_messages
        FOR EACH ROW
        EXECUTE FUNCTION update_chat_group_message_count();
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Skipping trigger creation: %', SQLERRM;
END $$;

-- Create the scheduled messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_scheduled_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('fake_user', 'admin')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'link')),
    scheduled_at TIMESTAMP NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly') OR recurring_frequency IS NULL),
    recurring_interval INTEGER DEFAULT 1,
    recurring_end_date TIMESTAMP,
    admin_id INTEGER REFERENCES users(id),
    is_sent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster retrieval of scheduled messages
CREATE INDEX IF NOT EXISTS idx_chat_scheduled_messages_scheduled_at ON chat_scheduled_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_chat_scheduled_messages_group_id ON chat_scheduled_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_scheduled_messages_is_sent ON chat_scheduled_messages(is_sent);

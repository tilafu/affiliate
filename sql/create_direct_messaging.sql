-- Create tables for direct messaging functionality
-- This enables users to have private conversations with each other

-- Table to store direct message conversations between two users
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT direct_messages_users_check CHECK (user1_id < user2_id),
    CONSTRAINT direct_messages_unique UNIQUE (user1_id, user2_id)
);

-- Table to store the actual message texts in direct conversations
CREATE TABLE IF NOT EXISTS direct_message_texts (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_user1 ON direct_messages(user1_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_user2 ON direct_messages(user2_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_texts_conversation ON direct_message_texts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_texts_sender ON direct_message_texts(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_texts_created_at ON direct_message_texts(created_at);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_direct_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update timestamps
CREATE TRIGGER update_direct_messages_timestamp
    BEFORE UPDATE ON direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_direct_message_timestamp();

CREATE TRIGGER update_direct_message_texts_timestamp
    BEFORE UPDATE ON direct_message_texts
    FOR EACH ROW
    EXECUTE FUNCTION update_direct_message_timestamp();

-- Update the direct_messages table when a new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE direct_messages 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON direct_message_texts
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Show results
SELECT 'Direct messaging tables created successfully!' as status;

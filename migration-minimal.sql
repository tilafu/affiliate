-- =============================================
-- MINIMAL Direct Messaging Migration
-- Database: affiliate_db  
-- User: postgres
-- Date: 2025-07-26
-- =============================================

-- Start transaction
BEGIN;

-- =============================================
-- PHASE 1: CREATE CORE DM TABLES
-- =============================================

-- Create direct_messages table for conversation management
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER, -- NULL for support conversations
    user2_type VARCHAR(20) CHECK (user2_type IN ('real_user', 'fake_user', 'support')),
    fake_user_id INTEGER REFERENCES chat_fake_users(id) ON DELETE SET NULL,
    conversation_type VARCHAR(20) NOT NULL CHECK (conversation_type IN ('support', 'user_dm')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    unread_count_user1 INTEGER DEFAULT 0,
    unread_count_user2 INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT valid_user2_reference CHECK (
        (user2_type = 'real_user' AND user2_id IS NOT NULL AND fake_user_id IS NULL) OR
        (user2_type = 'fake_user' AND fake_user_id IS NOT NULL AND user2_id IS NULL) OR
        (user2_type = 'support' AND user2_id IS NULL AND fake_user_id IS NULL)
    ),
    CONSTRAINT no_self_conversation CHECK (user1_id != user2_id)
);

-- Create dm_messages table for actual messages
CREATE TABLE IF NOT EXISTS dm_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('real_user', 'fake_user', 'admin')),
    fake_user_sender_id INTEGER REFERENCES chat_fake_users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'link', 'notification')),
    is_notification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT valid_sender_reference CHECK (
        (sender_type = 'real_user' AND fake_user_sender_id IS NULL) OR
        (sender_type = 'fake_user' AND fake_user_sender_id IS NOT NULL) OR
        (sender_type IN ('admin') AND fake_user_sender_id IS NULL)
    ),
    CONSTRAINT valid_message_content CHECK (LENGTH(TRIM(content)) > 0)
);

-- =============================================
-- PHASE 2: ADD NOTIFICATION FIELDS TO EXISTING CHAT_MESSAGES
-- =============================================

-- Add notification support to existing chat_messages table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'is_notification'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN is_notification BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'notification_style'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN notification_style JSONB DEFAULT '{}';
    END IF;
END
$$;

-- =============================================
-- PHASE 3: CREATE ESSENTIAL INDEXES
-- =============================================

-- Direct Messages Indexes (only the essential ones)
CREATE INDEX IF NOT EXISTS idx_direct_messages_user1 ON direct_messages(user1_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_user2_type ON direct_messages(user2_id, user2_type) WHERE user2_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_direct_messages_fake_user ON direct_messages(fake_user_id) WHERE fake_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_direct_messages_type ON direct_messages(conversation_type);
CREATE INDEX IF NOT EXISTS idx_direct_messages_last_message ON direct_messages(last_message_at DESC);

-- DM Messages Indexes (only the essential ones)
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_time ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender ON dm_messages(sender_id, sender_type);
CREATE INDEX IF NOT EXISTS idx_dm_messages_fake_sender ON dm_messages(fake_user_sender_id) WHERE fake_user_sender_id IS NOT NULL;

-- =============================================
-- PHASE 4: CREATE BASIC UPDATE FUNCTIONS
-- =============================================

-- Function to update conversation last_message_at (simplified)
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE direct_messages 
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update unread counts (simplified)
CREATE OR REPLACE FUNCTION update_unread_counts()
RETURNS TRIGGER AS $$
DECLARE
    conv_rec RECORD;
BEGIN
    -- Get conversation details
    SELECT user1_id, user2_id INTO conv_rec
    FROM direct_messages WHERE id = NEW.conversation_id;
    
    -- Simple unread count logic
    IF NEW.sender_type = 'real_user' AND NEW.sender_id = conv_rec.user1_id THEN
        -- Message from user1, increment user2's unread count
        UPDATE direct_messages 
        SET unread_count_user2 = unread_count_user2 + 1
        WHERE id = NEW.conversation_id;
    ELSE
        -- Message from user2/system, increment user1's unread count
        UPDATE direct_messages 
        SET unread_count_user1 = unread_count_user1 + 1
        WHERE id = NEW.conversation_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PHASE 5: CREATE TRIGGERS
-- =============================================

-- Trigger for updating conversation metadata on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON dm_messages;
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON dm_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Trigger for managing unread counts
DROP TRIGGER IF EXISTS trigger_update_unread_counts ON dm_messages;
CREATE TRIGGER trigger_update_unread_counts
    AFTER INSERT ON dm_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_unread_counts();

-- =============================================
-- PHASE 6: INSERT BASIC SUPPORT PERSONAS (if needed)
-- =============================================

-- Insert default support persona if it doesn't exist
INSERT INTO chat_fake_users (name, avatar_url, bio, created_at)
SELECT 
    'Support Agent',
    '/images/avatars/support-agent.png',
    'Customer support representative',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM chat_fake_users WHERE name = 'Support Agent'
);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify table creation
SELECT 
    table_name, 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_name IN ('direct_messages', 'dm_messages')
ORDER BY table_name;

-- Verify new columns in chat_messages
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
    AND column_name IN ('is_notification', 'notification_style');

-- Verify indexes
SELECT indexname, tablename
FROM pg_indexes 
WHERE tablename IN ('direct_messages', 'dm_messages')
ORDER BY tablename, indexname;

-- Verify support persona
SELECT id, name FROM chat_fake_users WHERE name = 'Support Agent';

-- =============================================
-- COMMIT TRANSACTION
-- =============================================

COMMIT;

-- =============================================
-- POST-MIGRATION NOTES
-- =============================================

/*
MINIMAL MIGRATION COMPLETED:

WHAT WAS ADDED:
✅ direct_messages table - conversation management
✅ dm_messages table - individual messages  
✅ is_notification + notification_style columns to chat_messages
✅ Essential indexes for performance
✅ Basic triggers for conversation updates
✅ Default support persona

WHAT WAS NOT CHANGED:
✅ Existing chat_groups table (unchanged)
✅ Existing chat_group_members table (unchanged)  
✅ Existing chat_messages structure (only added 2 columns)
✅ Existing chat_fake_users table (unchanged, just added 1 record)
✅ Existing users table (unchanged)

NEXT STEPS FOR IMPLEMENTATION:
1. Update backend APIs to support new DM endpoints
2. Update frontend to handle DM conversations
3. Gradually migrate support conversations from groups to DMs
4. Test new notification system in chat_messages

ROLLBACK PLAN (if needed):
DROP TABLE dm_messages;
DROP TABLE direct_messages;
ALTER TABLE chat_messages DROP COLUMN is_notification;
ALTER TABLE chat_messages DROP COLUMN notification_style;
-- Remove support persona from chat_fake_users if desired

This migration is SAFE and REVERSIBLE!
*/

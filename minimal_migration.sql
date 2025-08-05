-- =============================================
-- Minimal DM Feature Migration
-- Only adds new tables and essential fields
-- =============================================

BEGIN;

-- =============================================
-- 1. CREATE DIRECT MESSAGES TABLE
-- =============================================
CREATE TABLE direct_messages (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id),
    user2_id INTEGER,  -- NULL for support conversations
    user2_type VARCHAR(20) CHECK (user2_type IN ('real_user', 'fake_user', 'support')),
    fake_user_id INTEGER REFERENCES chat_fake_users(id),
    conversation_type VARCHAR(20) NOT NULL CHECK (conversation_type IN ('support', 'user_dm')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- 2. CREATE DM MESSAGES TABLE
-- =============================================
CREATE TABLE dm_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('real_user', 'fake_user', 'admin')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'link', 'notification')),
    is_notification BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- 3. ADD NOTIFICATION FIELDS TO EXISTING CHAT_MESSAGES
-- =============================================
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
-- 4. CREATE ESSENTIAL INDEXES
-- =============================================
CREATE INDEX idx_direct_messages_user1 ON direct_messages(user1_id);
CREATE INDEX idx_direct_messages_user2 ON direct_messages(user2_id, user2_type);
CREATE INDEX idx_direct_messages_type ON direct_messages(conversation_type);
CREATE INDEX idx_dm_messages_conversation ON dm_messages(conversation_id);
CREATE INDEX idx_dm_messages_sender ON dm_messages(sender_id, sender_type);

-- =============================================
-- 5. VERIFICATION
-- =============================================
-- Verify tables were created
SELECT 'direct_messages' as table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'direct_messages') as column_count
UNION ALL
SELECT 'dm_messages' as table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'dm_messages') as column_count;

-- Verify chat_messages columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
  AND column_name IN ('is_notification', 'notification_style');

COMMIT;

-- Migration completed successfully!

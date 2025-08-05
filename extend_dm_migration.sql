-- =============================================
-- Extend Existing DM System for Fake Users and Support
-- Phase 1: Database Extensions
-- =============================================

BEGIN;

-- =============================================
-- 1. EXTEND chat_dm_conversations FOR FAKE USERS
-- =============================================

-- Add columns to support fake users and support conversations
ALTER TABLE chat_dm_conversations 
ADD COLUMN IF NOT EXISTS user2_type VARCHAR(20) DEFAULT 'real_user' 
    CHECK (user2_type IN ('real_user', 'fake_user', 'support')),
ADD COLUMN IF NOT EXISTS fake_user_id INTEGER REFERENCES chat_fake_users(id),
ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) DEFAULT 'user_dm' 
    CHECK (conversation_type IN ('user_dm', 'support')),
ADD COLUMN IF NOT EXISTS is_support_conversation BOOLEAN DEFAULT FALSE;

-- Update the unique constraint to handle fake users
-- Drop existing constraint
ALTER TABLE chat_dm_conversations DROP CONSTRAINT IF EXISTS chat_dm_conversations_user_id_1_user_id_2_key;

-- Add new constraint that handles fake users
ALTER TABLE chat_dm_conversations 
ADD CONSTRAINT unique_conversation CHECK (
    -- Real user to real user: both user_ids set, no fake_user_id
    (user2_type = 'real_user' AND user_id_2 IS NOT NULL AND fake_user_id IS NULL) OR
    -- Real user to fake user: user_id_1 set, fake_user_id set, user_id_2 NULL
    (user2_type = 'fake_user' AND user_id_2 IS NULL AND fake_user_id IS NOT NULL) OR
    -- Support conversation: user_id_1 set, user_id_2 NULL, fake_user_id NULL
    (user2_type = 'support' AND user_id_2 IS NULL AND fake_user_id IS NULL)
);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_dm_conversations_fake_user ON chat_dm_conversations(fake_user_id) WHERE fake_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_support ON chat_dm_conversations(user_id_1) WHERE is_support_conversation = TRUE;
CREATE INDEX IF NOT EXISTS idx_dm_conversations_type ON chat_dm_conversations(conversation_type);

-- =============================================
-- 2. EXTEND chat_dm_messages FOR FAKE USER SENDERS
-- =============================================

-- Add columns to support fake user senders
ALTER TABLE chat_dm_messages 
ADD COLUMN IF NOT EXISTS sender_type VARCHAR(20) DEFAULT 'real_user' 
    CHECK (sender_type IN ('real_user', 'fake_user', 'support', 'admin')),
ADD COLUMN IF NOT EXISTS fake_user_sender_id INTEGER REFERENCES chat_fake_users(id),
ADD COLUMN IF NOT EXISTS is_notification BOOLEAN DEFAULT FALSE;

-- Add constraint to ensure proper sender reference
ALTER TABLE chat_dm_messages 
ADD CONSTRAINT valid_dm_sender CHECK (
    -- Real user sender
    (sender_type = 'real_user' AND sender_id IS NOT NULL AND fake_user_sender_id IS NULL) OR
    -- Fake user sender  
    (sender_type = 'fake_user' AND fake_user_sender_id IS NOT NULL) OR
    -- Support/admin sender
    (sender_type IN ('support', 'admin') AND sender_id IS NOT NULL AND fake_user_sender_id IS NULL)
);

-- Create index for fake user senders
CREATE INDEX IF NOT EXISTS idx_dm_messages_fake_sender ON chat_dm_messages(fake_user_sender_id) WHERE fake_user_sender_id IS NOT NULL;

-- =============================================
-- 3. ADD NOTIFICATION SUPPORT TO CHAT_MESSAGES
-- =============================================

-- Add notification fields to existing group chat system
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_notification BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_style JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_admin_notification BOOLEAN DEFAULT FALSE;

-- Index for admin notifications
CREATE INDEX IF NOT EXISTS idx_chat_messages_admin_notifications ON chat_messages(group_id) WHERE is_admin_notification = TRUE;

-- =============================================
-- 4. CREATE SUPPORT CONVERSATION HELPER FUNCTIONS
-- =============================================

-- Function to get or create support conversation for a user
CREATE OR REPLACE FUNCTION get_or_create_support_conversation(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_conversation_id INTEGER;
BEGIN
    -- Try to find existing support conversation
    SELECT id INTO v_conversation_id
    FROM chat_dm_conversations 
    WHERE user_id_1 = p_user_id 
      AND conversation_type = 'support' 
      AND is_support_conversation = TRUE
      AND status = 'active';
    
    -- If not found, create new one
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_dm_conversations (
            user_id_1, 
            user_id_2, 
            user2_type, 
            conversation_type, 
            is_support_conversation,
            status
        ) VALUES (
            p_user_id, 
            NULL, 
            'support', 
            'support', 
            TRUE,
            'active'
        ) RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create or get DM conversation with fake user
CREATE OR REPLACE FUNCTION get_or_create_fake_user_conversation(p_user_id INTEGER, p_fake_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_conversation_id INTEGER;
BEGIN
    -- Try to find existing conversation
    SELECT id INTO v_conversation_id
    FROM chat_dm_conversations 
    WHERE user_id_1 = p_user_id 
      AND fake_user_id = p_fake_user_id
      AND user2_type = 'fake_user'
      AND status = 'active';
    
    -- If not found, create new one
    IF v_conversation_id IS NULL THEN
        INSERT INTO chat_dm_conversations (
            user_id_1, 
            user_id_2, 
            user2_type, 
            fake_user_id, 
            conversation_type,
            status
        ) VALUES (
            p_user_id, 
            NULL, 
            'fake_user', 
            p_fake_user_id, 
            'user_dm',
            'active'
        ) RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. CREATE ADMIN VIEWS FOR MANAGEMENT
-- =============================================

-- View for support conversations
CREATE OR REPLACE VIEW admin_support_conversations AS
SELECT 
    c.id as conversation_id,
    u.username,
    u.email,
    c.created_at,
    c.last_message_at,
    c.status,
    -- Latest message preview
    (SELECT message FROM chat_dm_messages 
     WHERE conversation_id = c.id 
     ORDER BY created_at DESC LIMIT 1) as last_message,
    -- Unread count (messages not read by support)
    (SELECT COUNT(*) FROM chat_dm_messages 
     WHERE conversation_id = c.id 
       AND sender_type = 'real_user' 
       AND is_read = FALSE) as unread_count
FROM chat_dm_conversations c
JOIN users u ON c.user_id_1 = u.id
WHERE c.is_support_conversation = TRUE
ORDER BY c.last_message_at DESC;

-- View for fake user DM conversations
CREATE OR REPLACE VIEW admin_fake_user_dms AS
SELECT 
    c.id as conversation_id,
    u.username as user_name,
    COALESCE(fu.display_name, fu.username) as fake_user_name,
    c.created_at,
    c.last_message_at,
    c.status,
    (SELECT message FROM chat_dm_messages 
     WHERE conversation_id = c.id 
     ORDER BY created_at DESC LIMIT 1) as last_message
FROM chat_dm_conversations c
JOIN users u ON c.user_id_1 = u.id
JOIN chat_fake_users fu ON c.fake_user_id = fu.id
WHERE c.user2_type = 'fake_user'
ORDER BY c.last_message_at DESC;

-- =============================================
-- 6. VERIFICATION QUERIES
-- =============================================

-- Test the new structure
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Extended DM conversations: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'chat_dm_conversations' AND column_name = 'user2_type');
    RAISE NOTICE 'Extended DM messages: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'chat_dm_messages' AND column_name = 'sender_type');
    RAISE NOTICE 'Extended chat messages: %', (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_notification');
END
$$;

-- Verify views were created
SELECT 'admin_support_conversations' as view_name, COUNT(*) as record_count FROM admin_support_conversations
UNION ALL
SELECT 'admin_fake_user_dms' as view_name, COUNT(*) as record_count FROM admin_fake_user_dms;

COMMIT;

-- =============================================
-- POST-MIGRATION NOTES
-- =============================================

/*
MIGRATION SUMMARY:
✅ Extended chat_dm_conversations to support fake users and support conversations
✅ Extended chat_dm_messages to support fake user senders
✅ Added notification support to chat_messages
✅ Created helper functions for conversation management
✅ Created admin views for support and fake user DM management

NEXT STEPS:
1. Update backend APIs to use new conversation functions
2. Implement frontend avatar click handlers
3. Add notification display in group chats
4. Migrate existing support conversations from group filtering to DM system

API ENDPOINTS TO CREATE:
- POST /api/user/chat/support - Get or create support conversation
- POST /api/user/chat/fake-user-dm/:fakeUserId - Start DM with fake user
- POST /api/admin/chat/notifications - Send notification to user's personal group
- GET /api/admin/chat/support-queue - Get support conversations for admin
*/

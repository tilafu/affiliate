-- =============================================
-- Direct Messaging & Support Chat Migration
-- Database: affiliate_db
-- User: postgres
-- Date: 2025-07-26
-- =============================================

-- Start transaction
BEGIN;

-- Create backup timestamp for reference
-- To restore: psql -h localhost -U postgres -d affiliate_db < backup_before_dm_20250726_HHMMSS.sql

-- =============================================
-- PHASE 1: CREATE ADMIN ROLES (if not exists)
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'affiliate_admin') THEN
        CREATE ROLE affiliate_admin;
        GRANT CONNECT ON DATABASE affiliate_db TO affiliate_admin;
        GRANT USAGE ON SCHEMA public TO affiliate_admin;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO affiliate_admin;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO affiliate_admin;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO affiliate_admin;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO affiliate_admin;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'affiliate_readonly') THEN
        CREATE ROLE affiliate_readonly;
        GRANT CONNECT ON DATABASE affiliate_db TO affiliate_readonly;
        GRANT USAGE ON SCHEMA public TO affiliate_readonly;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO affiliate_readonly;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO affiliate_readonly;
    END IF;
END
$$;

-- =============================================
-- PHASE 2: CREATE ENUM TYPES
-- =============================================

-- User type enumeration for DM system
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
        CREATE TYPE user_type_enum AS ENUM ('real_user', 'fake_user', 'support', 'admin');
    END IF;
END
$$;

-- Conversation type enumeration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type_enum') THEN
        CREATE TYPE conversation_type_enum AS ENUM ('support', 'user_dm', 'admin_notification');
    END IF;
END
$$;

-- Message type enumeration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type_enum') THEN
        CREATE TYPE message_type_enum AS ENUM ('text', 'image', 'link', 'notification', 'file');
    END IF;
END
$$;

-- =============================================
-- PHASE 3: CREATE DIRECT MESSAGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER, -- NULL for support conversations
    user2_type user_type_enum NOT NULL DEFAULT 'support',
    fake_user_id INTEGER REFERENCES chat_fake_users(id) ON DELETE SET NULL,
    conversation_type conversation_type_enum NOT NULL DEFAULT 'support',
    conversation_name VARCHAR(255), -- For custom conversation names
    is_support_conversation BOOLEAN DEFAULT FALSE,
    support_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Assigned support agent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT, -- For quick conversation list display
    unread_count_user1 INTEGER DEFAULT 0,
    unread_count_user2 INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}', -- For future extensibility
    
    -- Constraints
    CONSTRAINT valid_user2_reference CHECK (
        (user2_type = 'real_user' AND user2_id IS NOT NULL AND fake_user_id IS NULL) OR
        (user2_type = 'fake_user' AND fake_user_id IS NOT NULL AND user2_id IS NULL) OR
        (user2_type = 'support' AND user2_id IS NULL AND fake_user_id IS NULL) OR
        (user2_type = 'admin' AND user2_id IS NOT NULL AND fake_user_id IS NULL)
    ),
    CONSTRAINT no_self_conversation CHECK (user1_id != user2_id),
    CONSTRAINT valid_support_conversation CHECK (
        (conversation_type = 'support' AND is_support_conversation = TRUE) OR
        (conversation_type != 'support' AND is_support_conversation = FALSE)
    )
);

-- =============================================
-- PHASE 4: CREATE DM MESSAGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS dm_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL,
    sender_type user_type_enum NOT NULL,
    fake_user_sender_id INTEGER REFERENCES chat_fake_users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type message_type_enum DEFAULT 'text',
    is_notification BOOLEAN DEFAULT FALSE,
    notification_style JSONB DEFAULT '{}',
    reply_to_message_id INTEGER REFERENCES dm_messages(id) ON DELETE SET NULL,
    file_url TEXT, -- For file attachments
    file_name TEXT, -- Original filename
    file_size INTEGER, -- File size in bytes
    image_url TEXT, -- For image messages
    link_url TEXT, -- For link previews
    link_title TEXT, -- Link preview title
    link_description TEXT, -- Link preview description
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_sender_reference CHECK (
        (sender_type = 'real_user' AND fake_user_sender_id IS NULL) OR
        (sender_type = 'fake_user' AND fake_user_sender_id IS NOT NULL) OR
        (sender_type IN ('support', 'admin') AND fake_user_sender_id IS NULL)
    ),
    CONSTRAINT valid_message_content CHECK (
        LENGTH(TRIM(content)) > 0 OR 
        message_type IN ('image', 'file') OR 
        is_notification = TRUE
    ),
    CONSTRAINT valid_file_fields CHECK (
        (message_type = 'file' AND file_url IS NOT NULL AND file_name IS NOT NULL) OR
        (message_type != 'file')
    ),
    CONSTRAINT valid_image_fields CHECK (
        (message_type = 'image' AND image_url IS NOT NULL) OR
        (message_type != 'image')
    ),
    CONSTRAINT valid_link_fields CHECK (
        (message_type = 'link' AND link_url IS NOT NULL) OR
        (message_type != 'link')
    )
);

-- =============================================
-- PHASE 5: UPDATE EXISTING CHAT_MESSAGES TABLE
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
    
    IF NOT EXISTS (
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'is_admin_notification'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN is_admin_notification BOOLEAN DEFAULT FALSE;
    END IF;
END
$$;

-- =============================================
-- PHASE 6: CREATE PERFORMANCE INDEXES
-- =============================================

-- Direct Messages Indexes
CREATE INDEX IF NOT EXISTS idx_direct_messages_user1_active ON direct_messages(user1_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_direct_messages_user2_type ON direct_messages(user2_id, user2_type) WHERE user2_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_direct_messages_fake_user ON direct_messages(fake_user_id) WHERE fake_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_direct_messages_type ON direct_messages(conversation_type);
CREATE INDEX IF NOT EXISTS idx_direct_messages_support ON direct_messages(user1_id) WHERE is_support_conversation = TRUE;
CREATE INDEX IF NOT EXISTS idx_direct_messages_last_message ON direct_messages(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_user1 ON direct_messages(user1_id) WHERE unread_count_user1 > 0;
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_user2 ON direct_messages(user2_id) WHERE unread_count_user2 > 0;

-- DM Messages Indexes
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_time ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender ON dm_messages(sender_id, sender_type);
CREATE INDEX IF NOT EXISTS idx_dm_messages_fake_sender ON dm_messages(fake_user_sender_id) WHERE fake_user_sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dm_messages_notifications ON dm_messages(conversation_id) WHERE is_notification = TRUE;
CREATE INDEX IF NOT EXISTS idx_dm_messages_active ON dm_messages(conversation_id) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_dm_messages_reply_to ON dm_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- Chat Messages Notification Index
CREATE INDEX IF NOT EXISTS idx_chat_messages_notifications ON chat_messages(group_id) WHERE is_notification = TRUE;

-- =============================================
-- PHASE 7: CREATE DATABASE FUNCTIONS
-- =============================================

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE direct_messages 
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = CASE 
            WHEN NEW.is_notification THEN '[Notification]'
            WHEN NEW.message_type = 'image' THEN '[Image]'
            WHEN NEW.message_type = 'file' THEN '[File]'
            WHEN NEW.message_type = 'link' THEN '[Link]'
            ELSE LEFT(NEW.content, 100)
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to manage unread counts
CREATE OR REPLACE FUNCTION update_unread_counts()
RETURNS TRIGGER AS $$
DECLARE
    conv_rec RECORD;
BEGIN
    -- Get conversation details
    SELECT user1_id, user2_id, user2_type INTO conv_rec
    FROM direct_messages WHERE id = NEW.conversation_id;
    
    -- Update unread counts based on sender
    IF NEW.sender_type = 'real_user' AND NEW.sender_id = conv_rec.user1_id THEN
        -- Message from user1, increment user2's unread count
        UPDATE direct_messages 
        SET unread_count_user2 = unread_count_user2 + 1
        WHERE id = NEW.conversation_id;
    ELSIF NEW.sender_type = 'real_user' AND NEW.sender_id = conv_rec.user2_id THEN
        -- Message from user2, increment user1's unread count
        UPDATE direct_messages 
        SET unread_count_user1 = unread_count_user1 + 1
        WHERE id = NEW.conversation_id;
    ELSIF NEW.sender_type IN ('fake_user', 'support', 'admin') THEN
        -- Message from system/admin, increment user1's unread count
        UPDATE direct_messages 
        SET unread_count_user1 = unread_count_user1 + 1
        WHERE id = NEW.conversation_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_conversation_read(
    p_conversation_id INTEGER,
    p_user_id INTEGER,
    p_user_position TEXT -- 'user1' or 'user2'
)
RETURNS VOID AS $$
BEGIN
    IF p_user_position = 'user1' THEN
        UPDATE direct_messages 
        SET unread_count_user1 = 0
        WHERE id = p_conversation_id AND user1_id = p_user_id;
    ELSIF p_user_position = 'user2' THEN
        UPDATE direct_messages 
        SET unread_count_user2 = 0
        WHERE id = p_conversation_id AND user2_id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PHASE 8: CREATE TRIGGERS
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

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_direct_messages_updated_at ON direct_messages;
CREATE TRIGGER trigger_direct_messages_updated_at
    BEFORE UPDATE ON direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PHASE 9: CREATE ADMIN MANAGEMENT VIEWS
-- =============================================

-- View for admin dashboard - all conversations
CREATE OR REPLACE VIEW admin_conversation_overview AS
SELECT 
    dm.id as conversation_id,
    dm.conversation_type,
    dm.is_support_conversation,
    u1.username as user1_username,
    u1.email as user1_email,
    CASE 
        WHEN dm.user2_type = 'real_user' THEN u2.username
        WHEN dm.user2_type = 'fake_user' THEN fu.name
        WHEN dm.user2_type = 'support' THEN 'Support Team'
        ELSE 'System'
    END as user2_name,
    dm.last_message_at,
    dm.last_message_preview,
    dm.unread_count_user1 + dm.unread_count_user2 as total_unread,
    dm.is_active,
    dm.created_at,
    -- Message count
    (SELECT COUNT(*) FROM dm_messages WHERE conversation_id = dm.id AND is_active = TRUE) as message_count,
    -- Support agent info
    sa.username as support_agent_username
FROM direct_messages dm
JOIN users u1 ON dm.user1_id = u1.id
LEFT JOIN users u2 ON dm.user2_id = u2.id AND dm.user2_type = 'real_user'
LEFT JOIN chat_fake_users fu ON dm.fake_user_id = fu.id
LEFT JOIN users sa ON dm.support_agent_id = sa.id
WHERE dm.is_active = TRUE
ORDER BY dm.last_message_at DESC;

-- View for support ticket queue
CREATE OR REPLACE VIEW support_ticket_queue AS
SELECT 
    dm.id as ticket_id,
    u.username,
    u.email,
    dm.created_at as ticket_created,
    dm.last_message_at,
    dm.unread_count_user1 as unread_from_user,
    sa.username as assigned_agent,
    dm.last_message_preview,
    -- Latest message details
    (SELECT content FROM dm_messages 
     WHERE conversation_id = dm.id AND is_active = TRUE 
     ORDER BY created_at DESC LIMIT 1) as latest_message,
    (SELECT sender_type FROM dm_messages 
     WHERE conversation_id = dm.id AND is_active = TRUE 
     ORDER BY created_at DESC LIMIT 1) as latest_sender_type
FROM direct_messages dm
JOIN users u ON dm.user1_id = u.id
LEFT JOIN users sa ON dm.support_agent_id = sa.id
WHERE dm.is_support_conversation = TRUE 
    AND dm.is_active = TRUE
ORDER BY 
    CASE WHEN dm.unread_count_user1 > 0 THEN 0 ELSE 1 END, -- Unread tickets first
    dm.last_message_at DESC;

-- View for user DM conversations
CREATE OR REPLACE VIEW user_dm_conversations AS
SELECT 
    dm.id as conversation_id,
    CASE 
        WHEN dm.user2_type = 'real_user' THEN u2.username
        WHEN dm.user2_type = 'fake_user' THEN fu.name
        ELSE 'System'
    END as other_party_name,
    CASE 
        WHEN dm.user2_type = 'real_user' THEN u2.avatar_url
        WHEN dm.user2_type = 'fake_user' THEN fu.avatar_url
        ELSE NULL
    END as other_party_avatar,
    dm.last_message_at,
    dm.last_message_preview,
    dm.unread_count_user1 as unread_count,
    dm.is_active
FROM direct_messages dm
LEFT JOIN users u2 ON dm.user2_id = u2.id AND dm.user2_type = 'real_user'
LEFT JOIN chat_fake_users fu ON dm.fake_user_id = fu.id
WHERE dm.conversation_type = 'user_dm' 
    AND dm.is_active = TRUE;

-- =============================================
-- PHASE 10: INSERT DEFAULT SUPPORT PERSONAS
-- =============================================

-- Insert default support personas if they don't exist
INSERT INTO chat_fake_users (name, avatar_url, bio, created_at)
SELECT 
    'Support Agent',
    '/images/avatars/support-agent.png',
    'General customer support representative',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM chat_fake_users WHERE name = 'Support Agent'
);

INSERT INTO chat_fake_users (name, avatar_url, bio, created_at)
SELECT 
    'Technical Support',
    '/images/avatars/tech-support.png',
    'Technical assistance and troubleshooting',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM chat_fake_users WHERE name = 'Technical Support'
);

INSERT INTO chat_fake_users (name, avatar_url, bio, created_at)
SELECT 
    'Account Manager',
    '/images/avatars/account-manager.png',
    'Account and billing support',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM chat_fake_users WHERE name = 'Account Manager'
);

-- =============================================
-- PHASE 11: MIGRATION TRACKING
-- =============================================

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_by VARCHAR(255) DEFAULT CURRENT_USER,
    description TEXT,
    status VARCHAR(50) DEFAULT 'completed'
);

-- Record this migration
INSERT INTO migration_history (migration_name, description) VALUES (
    'dm_feature_001_schema',
    'Initial Direct Messaging and Support Chat system implementation with tables, indexes, functions, triggers, and admin views'
);

-- =============================================
-- PHASE 12: GRANT PERMISSIONS
-- =============================================

-- Grant permissions to admin role
GRANT ALL PRIVILEGES ON direct_messages TO affiliate_admin;
GRANT ALL PRIVILEGES ON dm_messages TO affiliate_admin;
GRANT USAGE, SELECT ON SEQUENCE direct_messages_id_seq TO affiliate_admin;
GRANT USAGE, SELECT ON SEQUENCE dm_messages_id_seq TO affiliate_admin;
GRANT SELECT ON admin_conversation_overview TO affiliate_admin;
GRANT SELECT ON support_ticket_queue TO affiliate_admin;
GRANT SELECT ON user_dm_conversations TO affiliate_admin;

-- Grant read permissions to readonly role
GRANT SELECT ON direct_messages TO affiliate_readonly;
GRANT SELECT ON dm_messages TO affiliate_readonly;
GRANT SELECT ON admin_conversation_overview TO affiliate_readonly;
GRANT SELECT ON support_ticket_queue TO affiliate_readonly;
GRANT SELECT ON user_dm_conversations TO affiliate_readonly;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify table creation
SELECT 
    table_name, 
    table_type,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_name IN ('direct_messages', 'dm_messages')
ORDER BY table_name;

-- Verify indexes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('direct_messages', 'dm_messages')
ORDER BY tablename, indexname;

-- Verify functions
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('update_conversation_last_message', 'update_unread_counts', 'mark_conversation_read')
ORDER BY routine_name;

-- Verify views
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN ('admin_conversation_overview', 'support_ticket_queue', 'user_dm_conversations')
ORDER BY table_name;

-- Verify fake users for support
SELECT id, name, bio FROM chat_fake_users WHERE name IN ('Support Agent', 'Technical Support', 'Account Manager');

-- =============================================
-- COMMIT TRANSACTION
-- =============================================

COMMIT;

-- =============================================
-- POST-MIGRATION NOTES
-- =============================================

/*
POST-MIGRATION STEPS:

1. BACKUP VERIFICATION:
   - Ensure backup was created: backup_before_dm_YYYYMMDD_HHMMSS.sql
   - Test backup restoration on development environment

2. APPLICATION UPDATES NEEDED:
   - Update backend APIs to use new direct_messages and dm_messages tables
   - Implement new Socket.IO event handlers for DM system
   - Update frontend to handle new conversation structure
   - Add admin interface for DM and support management

3. DATA MIGRATION (Next Step):
   - Run separate script to migrate existing support conversations
   - Migrate chat_messages with support_conversation_user_id to dm_messages
   - Update user references and conversation assignments

4. TESTING CHECKLIST:
   - Create test DM conversations
   - Verify unread count functionality
   - Test support ticket creation and assignment
   - Validate notification system
   - Check admin dashboard views
   - Verify real-time messaging

5. PERFORMANCE MONITORING:
   - Monitor query performance on new indexes
   - Check trigger execution times
   - Validate view query performance
   - Monitor database size increase

6. ROLLBACK PLAN (if needed):
   - Drop new tables: DROP TABLE dm_messages, direct_messages CASCADE;
   - Drop new functions and triggers
   - Restore from backup if necessary
   - Remove new columns from chat_messages table

7. PRODUCTION DEPLOYMENT:
   - Schedule maintenance window
   - Run migration during low-traffic period
   - Monitor application logs for errors
   - Verify all functionality after deployment

SUCCESS INDICATORS:
✅ All tables created successfully
✅ Indexes and constraints applied
✅ Functions and triggers operational
✅ Admin views accessible
✅ Default support personas created
✅ Permissions granted correctly
✅ Migration tracked in history table

For support: Check migration_history table for execution details
*/

# Database Migration Script for DM Feature

## Migration Overview
**Database**: `affiliate_db`  
**User**: `postgres`  
**Purpose**: Implement Direct Messaging and Support Chat redesign  
**Date**: 2025-07-26

## Pre-Migration Setup

### 1. Connect to Database
```bash
psql -h localhost -U postgres -d affiliate_db
```

### 2. Create Migration Tracking Table
```sql
-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT NOW(),
    executed_by VARCHAR(100) DEFAULT CURRENT_USER,
    status VARCHAR(50) DEFAULT 'completed',
    notes TEXT
);

-- Record this migration
INSERT INTO migration_history (migration_name, notes) 
VALUES ('dm_feature_001', 'Direct Messaging and Support Chat implementation')
ON CONFLICT (migration_name) DO NOTHING;
```

## Admin Role and Permissions Setup

### 3. Create Admin Roles for Database Management
```sql
-- Create admin role for backend application
DO $$
BEGIN
    -- Create affiliate_admin role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'affiliate_admin') THEN
        CREATE ROLE affiliate_admin WITH LOGIN PASSWORD 'secure_admin_password_2025';
        
        -- Grant necessary permissions
        GRANT CONNECT ON DATABASE affiliate_db TO affiliate_admin;
        GRANT USAGE ON SCHEMA public TO affiliate_admin;
        GRANT CREATE ON SCHEMA public TO affiliate_admin;
        
        -- Grant permissions on existing tables
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO affiliate_admin;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO affiliate_admin;
        
        -- Grant permissions on future tables
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO affiliate_admin;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO affiliate_admin;
        
        RAISE NOTICE 'Created affiliate_admin role with necessary permissions';
    ELSE
        RAISE NOTICE 'affiliate_admin role already exists';
    END IF;
    
    -- Create read-only role for analytics/reporting
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'affiliate_readonly') THEN
        CREATE ROLE affiliate_readonly WITH LOGIN PASSWORD 'readonly_password_2025';
        
        GRANT CONNECT ON DATABASE affiliate_db TO affiliate_readonly;
        GRANT USAGE ON SCHEMA public TO affiliate_readonly;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO affiliate_readonly;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO affiliate_readonly;
        
        RAISE NOTICE 'Created affiliate_readonly role for analytics';
    ELSE
        RAISE NOTICE 'affiliate_readonly role already exists';
    END IF;
END $$;
```

### 4. Update Users Table for Admin Backend Integration
```sql
-- Ensure users table has admin capabilities
DO $$
BEGIN
    -- Add admin-specific columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
        RAISE NOTICE 'Added role column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin') THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_admin column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'admin_permissions') THEN
        ALTER TABLE users ADD COLUMN admin_permissions JSONB DEFAULT '{}';
        RAISE NOTICE 'Added admin_permissions column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_admin_login') THEN
        ALTER TABLE users ADD COLUMN last_admin_login TIMESTAMP;
        RAISE NOTICE 'Added last_admin_login column to users table';
    END IF;
END $$;

-- Create default admin user if none exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin' OR is_admin = true) THEN
        INSERT INTO users (
            username, 
            email, 
            password, 
            role, 
            is_admin, 
            admin_permissions,
            created_at
        ) VALUES (
            'admin',
            'admin@affiliate.com',
            '$2b$10$placeholder_hashed_password', -- Replace with actual hashed password
            'admin',
            true,
            '{"chat_management": true, "user_management": true, "support_access": true, "notification_send": true}'::jsonb,
            NOW()
        );
        RAISE NOTICE 'Created default admin user - CHANGE PASSWORD IMMEDIATELY';
    ELSE
        RAISE NOTICE 'Admin user already exists';
    END IF;
END $$;
```

## Core DM Feature Migration

### 5. Create Enum Types for Data Integrity
```sql
-- Create enum types for better data validation
DO $$
BEGIN
    -- Conversation type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type_enum') THEN
        CREATE TYPE conversation_type_enum AS ENUM ('support', 'user_dm');
        RAISE NOTICE 'Created conversation_type_enum';
    END IF;
    
    -- Sender type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sender_type_enum') THEN
        CREATE TYPE sender_type_enum AS ENUM ('real_user', 'fake_user', 'admin');
        RAISE NOTICE 'Created sender_type_enum';
    END IF;
    
    -- Message type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type_enum') THEN
        CREATE TYPE message_type_enum AS ENUM ('text', 'image', 'link', 'notification');
        RAISE NOTICE 'Created message_type_enum';
    END IF;
    
    -- Support status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_status_enum') THEN
        CREATE TYPE support_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
        RAISE NOTICE 'Created support_status_enum';
    END IF;
END $$;
```

### 6. Create Direct Messages Table
```sql
-- Create direct_messages table for conversations
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    
    -- Participant information
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    user2_type VARCHAR(20) CHECK (user2_type IN ('real_user', 'fake_user', 'support')) DEFAULT 'support',
    fake_user_id INTEGER REFERENCES chat_fake_users(id) ON DELETE SET NULL,
    
    -- Conversation metadata
    conversation_type conversation_type_enum NOT NULL DEFAULT 'support',
    title VARCHAR(255) DEFAULT 'Conversation',
    description TEXT,
    
    -- Support-specific fields
    support_status support_status_enum DEFAULT 'open',
    support_priority INTEGER DEFAULT 1 CHECK (support_priority BETWEEN 1 AND 5),
    assigned_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    support_category VARCHAR(100),
    
    -- Message tracking
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    last_message_sender_type sender_type_enum,
    
    -- Unread counters
    unread_count_user1 INTEGER DEFAULT 0,
    unread_count_user2 INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_conversation_setup CHECK (
        (conversation_type = 'support' AND user2_type = 'support') OR
        (conversation_type = 'user_dm' AND user2_type IN ('real_user', 'fake_user'))
    ),
    
    CONSTRAINT valid_user2_reference CHECK (
        (user2_type = 'real_user' AND user2_id IS NOT NULL AND fake_user_id IS NULL) OR
        (user2_type = 'fake_user' AND fake_user_id IS NOT NULL AND user2_id IS NULL) OR
        (user2_type = 'support' AND user2_id IS NULL AND fake_user_id IS NULL)
    ),
    
    CONSTRAINT valid_support_fields CHECK (
        (conversation_type = 'support' AND assigned_admin_id IS NOT NULL) OR
        (conversation_type = 'user_dm')
    )
);

-- Add table comment
COMMENT ON TABLE direct_messages IS 'Stores one-to-one conversations including support tickets and direct messages between users and personas';
```

### 7. Create DM Messages Table
```sql
-- Create dm_messages table for message content
CREATE TABLE IF NOT EXISTS dm_messages (
    id SERIAL PRIMARY KEY,
    
    -- Conversation reference
    conversation_id INTEGER NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    
    -- Sender information
    sender_id INTEGER NOT NULL,
    sender_type sender_type_enum NOT NULL,
    
    -- Message content
    content TEXT NOT NULL,
    message_type message_type_enum DEFAULT 'text',
    
    -- Special message types
    is_notification BOOLEAN DEFAULT FALSE,
    notification_style JSONB DEFAULT '{}',
    notification_priority INTEGER DEFAULT 1 CHECK (notification_priority BETWEEN 1 AND 5),
    
    -- Media attachments
    media_url TEXT,
    media_type VARCHAR(50),
    media_size INTEGER,
    
    -- Message relationships
    reply_to_message_id INTEGER REFERENCES dm_messages(id) ON DELETE SET NULL,
    thread_id INTEGER, -- For message threading
    
    -- Message status
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Delivery tracking
    is_delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Additional data
    metadata JSONB DEFAULT '{}',
    
    -- Constraints for sender validation
    CONSTRAINT valid_sender_reference CHECK (
        (sender_type = 'real_user' AND sender_id IN (SELECT id FROM users WHERE id = sender_id)) OR
        (sender_type = 'fake_user' AND sender_id IN (SELECT id FROM chat_fake_users WHERE id = sender_id)) OR
        (sender_type = 'admin' AND sender_id IN (SELECT id FROM users WHERE id = sender_id))
    )
);

-- Add table comment
COMMENT ON TABLE dm_messages IS 'Stores all messages for direct conversations and support tickets';
```

### 8. Update Existing Chat Messages Table for Notifications
```sql
-- Add notification support to existing chat_messages table
DO $$
BEGIN
    -- Add notification columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_notification') THEN
        ALTER TABLE chat_messages ADD COLUMN is_notification BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_notification column to chat_messages';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'notification_style') THEN
        ALTER TABLE chat_messages ADD COLUMN notification_style JSONB DEFAULT '{}';
        RAISE NOTICE 'Added notification_style column to chat_messages';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'notification_metadata') THEN
        ALTER TABLE chat_messages ADD COLUMN notification_metadata JSONB DEFAULT '{}';
        RAISE NOTICE 'Added notification_metadata column to chat_messages';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'notification_priority') THEN
        ALTER TABLE chat_messages ADD COLUMN notification_priority INTEGER DEFAULT 1 CHECK (notification_priority BETWEEN 1 AND 5);
        RAISE NOTICE 'Added notification_priority column to chat_messages';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'sent_by_admin_id') THEN
        ALTER TABLE chat_messages ADD COLUMN sent_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added sent_by_admin_id column to chat_messages for tracking admin notifications';
    END IF;
END $$;
```

### 9. Create Performance Indexes
```sql
-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_user1_active 
ON direct_messages(user1_id, is_active, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_user2_type 
ON direct_messages(user2_id, user2_type, is_active) 
WHERE user2_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_direct_messages_fake_user 
ON direct_messages(fake_user_id, is_active) 
WHERE fake_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_direct_messages_type_active 
ON direct_messages(conversation_type, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_support_queue 
ON direct_messages(conversation_type, support_status, support_priority DESC, created_at) 
WHERE conversation_type = 'support';

CREATE INDEX IF NOT EXISTS idx_direct_messages_assigned_admin 
ON direct_messages(assigned_admin_id, is_active, support_status) 
WHERE assigned_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_time 
ON dm_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_sender 
ON dm_messages(sender_id, sender_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_active_unread 
ON dm_messages(conversation_id, is_active, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_notifications 
ON dm_messages(is_notification, notification_priority DESC, created_at DESC) 
WHERE is_notification = true;

CREATE INDEX IF NOT EXISTS idx_dm_messages_media 
ON dm_messages(conversation_id, media_url) 
WHERE media_url IS NOT NULL;

-- Indexes for chat_messages notifications
CREATE INDEX IF NOT EXISTS idx_chat_messages_notifications 
ON chat_messages(is_notification, notification_priority DESC, created_at DESC) 
WHERE is_notification = true;

CREATE INDEX IF NOT EXISTS idx_chat_messages_admin_sent 
ON chat_messages(sent_by_admin_id, created_at DESC) 
WHERE sent_by_admin_id IS NOT NULL;

RAISE NOTICE 'Created performance indexes for DM feature';
```

### 10. Create Database Functions and Triggers
```sql
-- Function to update conversation metadata when new message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE direct_messages 
    SET 
        last_message_at = NEW.created_at,
        updated_at = NOW(),
        last_message_preview = CASE 
            WHEN NEW.is_notification = true THEN '📢 ' || LEFT(NEW.content, 97)
            WHEN NEW.media_url IS NOT NULL THEN '📎 Media attachment'
            ELSE LEFT(NEW.content, 100)
        END,
        last_message_sender_type = NEW.sender_type,
        unread_count_user1 = CASE 
            WHEN (NEW.sender_type != 'real_user' OR NEW.sender_id != user1_id) AND is_active = true
            THEN unread_count_user1 + 1 
            ELSE unread_count_user1 
        END,
        unread_count_user2 = CASE 
            WHEN (NEW.sender_type = 'real_user' AND NEW.sender_id = user1_id) AND is_active = true AND user2_type != 'support'
            THEN unread_count_user2 + 1 
            ELSE unread_count_user2 
        END
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON dm_messages;
CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON dm_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- Function to mark conversation messages as read
CREATE OR REPLACE FUNCTION mark_conversation_read(
    p_conversation_id INTEGER,
    p_user_id INTEGER,
    p_user_type VARCHAR DEFAULT 'real_user'
)
RETURNS VOID AS $$
BEGIN
    -- Mark messages as read
    UPDATE dm_messages 
    SET 
        is_read = true,
        read_at = NOW(),
        is_delivered = true,
        delivered_at = COALESCE(delivered_at, NOW())
    WHERE conversation_id = p_conversation_id 
    AND is_read = false
    AND is_active = true
    AND NOT (sender_type = p_user_type::sender_type_enum AND sender_id = p_user_id);
    
    -- Update conversation unread counts
    UPDATE direct_messages 
    SET 
        unread_count_user1 = CASE 
            WHEN user1_id = p_user_id THEN 0 
            ELSE unread_count_user1 
        END,
        unread_count_user2 = CASE 
            WHEN user2_id = p_user_id OR (user2_type = 'support' AND p_user_type = 'admin') THEN 0 
            ELSE unread_count_user2 
        END,
        updated_at = NOW()
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create support conversation
CREATE OR REPLACE FUNCTION get_or_create_support_conversation(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    conversation_id INTEGER;
    admin_id INTEGER;
BEGIN
    -- Try to find existing active support conversation
    SELECT id INTO conversation_id
    FROM direct_messages 
    WHERE user1_id = p_user_id 
    AND conversation_type = 'support' 
    AND is_active = true
    AND support_status != 'closed'
    LIMIT 1;
    
    -- Create new support conversation if none exists
    IF conversation_id IS NULL THEN
        -- Find available admin for assignment
        SELECT id INTO admin_id
        FROM users 
        WHERE (role = 'admin' OR is_admin = true)
        AND id NOT IN (
            SELECT assigned_admin_id 
            FROM direct_messages 
            WHERE support_status IN ('open', 'in_progress') 
            AND assigned_admin_id IS NOT NULL
            GROUP BY assigned_admin_id
            HAVING COUNT(*) >= 5 -- Limit active tickets per admin
        )
        ORDER BY RANDOM()
        LIMIT 1;
        
        -- Fallback to any admin if all are busy
        IF admin_id IS NULL THEN
            SELECT id INTO admin_id
            FROM users 
            WHERE (role = 'admin' OR is_admin = true)
            ORDER BY RANDOM()
            LIMIT 1;
        END IF;
        
        INSERT INTO direct_messages (
            user1_id,
            user2_type,
            conversation_type,
            title,
            assigned_admin_id,
            support_status,
            support_priority,
            created_at,
            updated_at,
            last_message_at
        ) VALUES (
            p_user_id,
            'support',
            'support',
            'Help & Support',
            admin_id,
            'open',
            1,
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO conversation_id;
    END IF;
    
    RETURN conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to start or get DM conversation
CREATE OR REPLACE FUNCTION get_or_create_dm_conversation(
    p_user1_id INTEGER,
    p_user2_id INTEGER DEFAULT NULL,
    p_fake_user_id INTEGER DEFAULT NULL,
    p_title VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    conversation_id INTEGER;
    target_type VARCHAR;
    conv_title VARCHAR;
BEGIN
    -- Determine target type and title
    IF p_user2_id IS NOT NULL THEN
        target_type := 'real_user';
        SELECT COALESCE(p_title, 'Chat with ' || username) INTO conv_title
        FROM users WHERE id = p_user2_id;
    ELSIF p_fake_user_id IS NOT NULL THEN
        target_type := 'fake_user';
        SELECT COALESCE(p_title, 'Chat with ' || display_name) INTO conv_title
        FROM chat_fake_users WHERE id = p_fake_user_id;
    ELSE
        RAISE EXCEPTION 'Must specify either user2_id or fake_user_id';
    END IF;
    
    -- Check if conversation already exists
    SELECT id INTO conversation_id
    FROM direct_messages 
    WHERE user1_id = p_user1_id 
    AND conversation_type = 'user_dm'
    AND (
        (user2_id = p_user2_id AND user2_type = 'real_user') OR
        (fake_user_id = p_fake_user_id AND user2_type = 'fake_user')
    )
    AND is_active = true
    LIMIT 1;
    
    -- Create new conversation if none exists
    IF conversation_id IS NULL THEN
        INSERT INTO direct_messages (
            user1_id,
            user2_id,
            fake_user_id,
            user2_type,
            conversation_type,
            title,
            created_at,
            updated_at,
            last_message_at
        ) VALUES (
            p_user1_id,
            p_user2_id,
            p_fake_user_id,
            target_type,
            'user_dm',
            conv_title,
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO conversation_id;
    END IF;
    
    RETURN conversation_id;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Created database functions and triggers';
```

### 11. Create Management Views
```sql
-- Comprehensive view for conversation management
CREATE OR REPLACE VIEW v_user_conversations AS
SELECT 
    dm.id,
    dm.conversation_type,
    dm.title,
    dm.support_status,
    dm.support_priority,
    dm.support_category,
    dm.assigned_admin_id,
    dm.last_message_at,
    dm.last_message_preview,
    dm.last_message_sender_type,
    dm.user1_id,
    dm.user2_id,
    dm.user2_type,
    dm.fake_user_id,
    dm.unread_count_user1,
    dm.unread_count_user2,
    dm.is_active,
    dm.is_archived,
    dm.created_at,
    dm.metadata,
    
    -- User 1 info (conversation initiator)
    u1.username as user1_username,
    u1.email as user1_email,
    u1.profile_picture as user1_avatar,
    u1.user_tier as user1_tier,
    
    -- User 2 info (for real user DMs)
    u2.username as user2_username,
    u2.email as user2_email,
    u2.profile_picture as user2_avatar,
    u2.user_tier as user2_tier,
    
    -- Fake user info (for persona DMs)
    fu.username as fake_user_username,
    fu.display_name as fake_user_display_name,
    fu.bio as fake_user_bio,
    fu.avatar_url as fake_user_avatar,
    
    -- Assigned admin info (for support)
    admin.username as admin_username,
    admin.email as admin_email,
    admin.profile_picture as admin_avatar,
    
    -- Message statistics
    (SELECT COUNT(*) FROM dm_messages WHERE conversation_id = dm.id AND is_active = true) as total_messages,
    (SELECT COUNT(*) FROM dm_messages WHERE conversation_id = dm.id AND is_active = true AND sender_type = 'real_user') as user_messages,
    (SELECT COUNT(*) FROM dm_messages WHERE conversation_id = dm.id AND is_active = true AND sender_type IN ('admin', 'fake_user')) as admin_messages,
    
    -- Last message details
    (SELECT content FROM dm_messages WHERE conversation_id = dm.id AND is_active = true ORDER BY created_at DESC LIMIT 1) as last_message_content,
    (SELECT sender_id FROM dm_messages WHERE conversation_id = dm.id AND is_active = true ORDER BY created_at DESC LIMIT 1) as last_message_sender_id,
    
    -- Response time calculation for support
    CASE 
        WHEN dm.conversation_type = 'support' AND dm.last_message_sender_type = 'real_user' THEN
            EXTRACT(EPOCH FROM (NOW() - dm.last_message_at))/3600
        ELSE NULL
    END as hours_waiting_for_response

FROM direct_messages dm
LEFT JOIN users u1 ON dm.user1_id = u1.id
LEFT JOIN users u2 ON dm.user2_id = u2.id
LEFT JOIN chat_fake_users fu ON dm.fake_user_id = fu.id
LEFT JOIN users admin ON dm.assigned_admin_id = admin.id
WHERE dm.is_active = true;

-- Admin support queue view
CREATE OR REPLACE VIEW v_admin_support_queue AS
SELECT 
    vc.*,
    CASE 
        WHEN vc.last_message_sender_type = 'real_user' THEN 'awaiting_response'
        WHEN vc.last_message_sender_type IN ('admin', 'fake_user') THEN 'responded'
        WHEN vc.total_messages = 0 THEN 'new'
        ELSE 'unknown'
    END as response_status,
    CASE 
        WHEN vc.hours_waiting_for_response > 24 THEN 'overdue'
        WHEN vc.hours_waiting_for_response > 8 THEN 'urgent'
        WHEN vc.hours_waiting_for_response > 2 THEN 'normal'
        ELSE 'recent'
    END as urgency_level
FROM v_user_conversations vc
WHERE vc.conversation_type = 'support'
AND vc.is_active = true
AND vc.support_status != 'closed'
ORDER BY 
    vc.support_priority DESC,
    vc.hours_waiting_for_response DESC NULLS LAST,
    vc.last_message_at DESC;

-- Admin dashboard statistics view
CREATE OR REPLACE VIEW v_admin_dashboard_stats AS
SELECT 
    -- Support ticket statistics
    (SELECT COUNT(*) FROM direct_messages WHERE conversation_type = 'support' AND is_active = true) as total_support_conversations,
    (SELECT COUNT(*) FROM direct_messages WHERE conversation_type = 'support' AND support_status = 'open' AND is_active = true) as open_support_tickets,
    (SELECT COUNT(*) FROM direct_messages WHERE conversation_type = 'support' AND support_status = 'in_progress' AND is_active = true) as in_progress_tickets,
    (SELECT COUNT(*) FROM direct_messages WHERE conversation_type = 'support' AND support_status = 'resolved' AND is_active = true) as resolved_tickets,
    
    -- DM statistics
    (SELECT COUNT(*) FROM direct_messages WHERE conversation_type = 'user_dm' AND is_active = true) as total_dm_conversations,
    
    -- Message statistics
    (SELECT COUNT(*) FROM dm_messages WHERE created_at::DATE = CURRENT_DATE AND is_active = true) as messages_today,
    (SELECT COUNT(*) FROM dm_messages WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND is_active = true) as messages_this_week,
    
    -- Response time statistics
    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (admin_reply.created_at - user_msg.created_at))/3600), 2)
     FROM dm_messages user_msg
     INNER JOIN dm_messages admin_reply ON user_msg.conversation_id = admin_reply.conversation_id
     WHERE user_msg.sender_type = 'real_user' 
     AND admin_reply.sender_type IN ('admin', 'fake_user')
     AND admin_reply.created_at > user_msg.created_at
     AND user_msg.created_at >= CURRENT_DATE - INTERVAL '7 days'
    ) as avg_response_time_hours,
    
    -- Admin workload
    (SELECT jsonb_object_agg(admin_username, ticket_count)
     FROM (
         SELECT 
             admin.username as admin_username,
             COUNT(*) as ticket_count
         FROM direct_messages dm
         INNER JOIN users admin ON dm.assigned_admin_id = admin.id
         WHERE dm.conversation_type = 'support' 
         AND dm.support_status IN ('open', 'in_progress')
         AND dm.is_active = true
         GROUP BY admin.id, admin.username
     ) admin_workload
    ) as admin_ticket_distribution;

RAISE NOTICE 'Created management views for admin dashboard';
```

### 12. Create Default Support Personas
```sql
-- Insert default support personas if they don't exist
INSERT INTO chat_fake_users (username, display_name, bio, avatar_url, is_active, created_at, updated_at)
SELECT * FROM (VALUES 
    ('support_sarah', 'Sarah - Support Specialist', 'Customer Support Expert | Here to help with any questions or issues!', '/assets/avatars/support-sarah.jpg', true, NOW(), NOW()),
    ('tech_mike', 'Mike - Technical Support', 'Technical Support Engineer | Solving technical problems and system issues.', '/assets/avatars/tech-mike.jpg', true, NOW(), NOW()),
    ('account_lisa', 'Lisa - Account Manager', 'Account Management Specialist | Assistance with billing and account queries.', '/assets/avatars/account-lisa.jpg', true, NOW(), NOW()),
    ('success_jordan', 'Jordan - Success Coach', 'Customer Success Coach | Helping you maximize your affiliate potential!', '/assets/avatars/success-jordan.jpg', true, NOW(), NOW())
) AS new_personas(username, display_name, bio, avatar_url, is_active, created_at, updated_at)
WHERE NOT EXISTS (
    SELECT 1 FROM chat_fake_users 
    WHERE username = new_personas.username
);

RAISE NOTICE 'Created default support personas';
```

### 13. Update Migration History
```sql
-- Update migration status
UPDATE migration_history 
SET 
    status = 'completed',
    notes = notes || ' | Schema creation completed successfully at ' || NOW()
WHERE migration_name = 'dm_feature_001';

-- Insert checkpoint
INSERT INTO migration_history (migration_name, notes) 
VALUES ('dm_feature_001_schema', 'Database schema creation for DM feature completed')
ON CONFLICT (migration_name) DO UPDATE SET 
    executed_at = NOW(),
    notes = EXCLUDED.notes;
```

## Verification Queries

### 14. Verify Migration Success
```sql
-- Check if all tables were created
SELECT 
    table_name,
    table_type,
    CASE 
        WHEN table_name IN ('direct_messages', 'dm_messages') THEN '✅ NEW'
        WHEN table_name = 'chat_messages' THEN '✅ UPDATED'
        ELSE '✅ EXISTING'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('direct_messages', 'dm_messages', 'chat_messages', 'chat_fake_users', 'users')
ORDER BY table_name;

-- Check enum types
SELECT 
    typname as enum_name,
    enumlabel as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%_enum'
ORDER BY typname, enumsortorder;

-- Check indexes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('direct_messages', 'dm_messages', 'chat_messages')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Check functions
SELECT 
    routine_name as function_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_conversation_on_message',
    'mark_conversation_read',
    'get_or_create_support_conversation',
    'get_or_create_dm_conversation'
)
ORDER BY routine_name;

-- Check views
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name LIKE 'v_%'
ORDER BY table_name;

-- Check admin roles
SELECT 
    rolname,
    rolcanlogin,
    CASE 
        WHEN rolsuper THEN 'Superuser'
        WHEN rolcreatedb THEN 'Create DB'
        WHEN rolcreaterole THEN 'Create Role'
        ELSE 'Limited'
    END as privileges
FROM pg_roles 
WHERE rolname IN ('affiliate_admin', 'affiliate_readonly')
ORDER BY rolname;

-- Show table statistics
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('direct_messages', 'dm_messages')
ORDER BY tablename, attname;
```

## Post-Migration Steps

### 15. Grant Permissions to Application Roles
```sql
-- Grant permissions on new tables to affiliate_admin
GRANT SELECT, INSERT, UPDATE, DELETE ON direct_messages TO affiliate_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON dm_messages TO affiliate_admin;
GRANT USAGE, SELECT ON SEQUENCE direct_messages_id_seq TO affiliate_admin;
GRANT USAGE, SELECT ON SEQUENCE dm_messages_id_seq TO affiliate_admin;

-- Grant read permissions to readonly role
GRANT SELECT ON direct_messages TO affiliate_readonly;
GRANT SELECT ON dm_messages TO affiliate_readonly;
GRANT SELECT ON v_user_conversations TO affiliate_readonly;
GRANT SELECT ON v_admin_support_queue TO affiliate_readonly;
GRANT SELECT ON v_admin_dashboard_stats TO affiliate_readonly;

RAISE NOTICE 'Granted permissions to application roles';
```

### 16. Final Migration Status
```sql
-- Final status update
INSERT INTO migration_history (migration_name, notes) 
VALUES ('dm_feature_001_complete', 'DM feature migration completed successfully. Ready for data migration phase.')
ON CONFLICT (migration_name) DO UPDATE SET 
    executed_at = NOW(),
    notes = EXCLUDED.notes;

-- Show migration summary
SELECT 
    migration_name,
    executed_at,
    executed_by,
    status,
    notes
FROM migration_history 
WHERE migration_name LIKE 'dm_feature_%'
ORDER BY executed_at;

RAISE NOTICE '=== DM FEATURE MIGRATION COMPLETED ===';
RAISE NOTICE 'Next step: Run data migration script to transfer existing support conversations';
RAISE NOTICE 'Tables created: direct_messages, dm_messages';
RAISE NOTICE 'Tables updated: chat_messages (added notification columns)';
RAISE NOTICE 'Views created: v_user_conversations, v_admin_support_queue, v_admin_dashboard_stats';
RAISE NOTICE 'Functions created: conversation management and auto-assignment';
RAISE NOTICE 'Roles created: affiliate_admin, affiliate_readonly';
```

## Execution Instructions

To run this migration:

```bash
# 1. Save this script to a file
# Save the SQL portion to: sql/migrations/dm_feature_001_schema.sql

# 2. Create backup
pg_dump -h localhost -U postgres -d affiliate_db > backup_before_dm_$(date +%Y%m%d_%H%M%S).sql

# 3. Run the migration
psql -h localhost -U postgres -d affiliate_db -f sql/migrations/dm_feature_001_schema.sql

# 4. Verify success
psql -h localhost -U postgres -d affiliate_db -c "SELECT * FROM migration_history WHERE migration_name LIKE 'dm_feature_%';"
```

## Security Notes

1. **Change default passwords** for `affiliate_admin` and `affiliate_readonly` roles
2. **Update admin user password** in the users table
3. **Configure SSL** for database connections in production
4. **Set up proper firewall rules** for database access
5. **Enable audit logging** for admin operations

## Next Steps

After this migration completes successfully:

1. **Data Migration**: Run the data migration script to transfer existing support conversations
2. **Backend Updates**: Update API endpoints to use new table structure
3. **Frontend Updates**: Modify chat interface to support DM functionality
4. **Testing**: Comprehensive testing of all DM features
5. **Deployment**: Gradual rollout to production

---

**Migration Created**: 2025-07-26  
**Target Database**: affiliate_db  
**Status**: Ready for execution

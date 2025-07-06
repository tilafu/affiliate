-- Admin Chat Management Schema Enhancements

-- Add admin-related columns to chat_messages table (if it exists)
ALTER TABLE IF EXISTS chat_messages 
  ADD COLUMN IF NOT EXISTS is_admin_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

-- Create chat_admin_logs table for auditing
CREATE TABLE IF NOT EXISTS chat_admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id),
    action_type VARCHAR(50) NOT NULL,
    group_id INTEGER REFERENCES chat_groups(id),
    fake_user_id INTEGER REFERENCES chat_fake_users(id),
    message_id INTEGER REFERENCES chat_messages(id),
    action_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_chat_admin_logs_admin_id ON chat_admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_admin_logs_action_type ON chat_admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_chat_admin_logs_created_at ON chat_admin_logs(created_at);

-- Create chat_templates table for reusable conversations (future implementation)
CREATE TABLE IF NOT EXISTS chat_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    admin_id INTEGER REFERENCES admins(id),
    content JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for template lookup
CREATE INDEX IF NOT EXISTS idx_chat_templates_admin_id ON chat_templates(admin_id);

-- Add index to chat_messages for scheduled messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_scheduled_at ON chat_messages(scheduled_at)
    WHERE scheduled_at IS NOT NULL;

-- Add index for admin-generated messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_admin_generated ON chat_messages(is_admin_generated)
    WHERE is_admin_generated = TRUE;

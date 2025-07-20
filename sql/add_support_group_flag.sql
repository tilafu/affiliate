-- Add support group functionality to chat system
-- This allows users to post in Support Team group with isolated conversations

-- Add is_support_group flag to chat_groups table
ALTER TABLE chat_groups 
ADD COLUMN IF NOT EXISTS is_support_group BOOLEAN DEFAULT false;

-- Create index for support groups
CREATE INDEX IF NOT EXISTS idx_chat_groups_support ON chat_groups(is_support_group);

-- Add a column to track which user's conversation this message belongs to in support groups
-- This is needed to isolate conversations in support groups
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS support_conversation_user_id INTEGER REFERENCES users(id);

-- Create index for support conversation filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_support_user ON chat_messages(group_id, support_conversation_user_id) WHERE support_conversation_user_id IS NOT NULL;

-- Now update the existing "Support Team" group to be a support group (after column is created)
UPDATE chat_groups 
SET is_support_group = true 
WHERE name = 'Support Team';

-- Update existing messages in Support Team group to have support_conversation_user_id
-- This ensures existing messages are properly attributed
UPDATE chat_messages 
SET support_conversation_user_id = user_id
WHERE group_id IN (SELECT id FROM chat_groups WHERE is_support_group = true)
AND user_id IS NOT NULL;

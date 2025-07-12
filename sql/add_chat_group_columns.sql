-- SQL script to add message_count column to the chat_groups table if it doesn't exist

DO $$
BEGIN
    -- Check if the message_count column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chat_groups' AND column_name = 'message_count'
    ) THEN
        -- Add the message_count column with a default value of 0
        ALTER TABLE chat_groups ADD COLUMN message_count INTEGER DEFAULT 0;
    END IF;
    
    -- Check if the last_activity column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chat_groups' AND column_name = 'last_activity'
    ) THEN
        -- Add the last_activity column with a default value of now
        ALTER TABLE chat_groups ADD COLUMN last_activity TIMESTAMP DEFAULT NOW();
    END IF;
    
    -- Check if the member_count column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chat_groups' AND column_name = 'member_count'
    ) THEN
        -- Add the member_count column with a default value of 0
        ALTER TABLE chat_groups ADD COLUMN member_count INTEGER DEFAULT 0;
    END IF;
END $$;

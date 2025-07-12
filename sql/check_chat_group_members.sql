-- SQL script to check chat_group_members table schema

-- Check table schema
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_group_members'
ORDER BY ordinal_position;

-- Check the first few rows of data
SELECT * FROM chat_group_members LIMIT 5;

-- Check if join_date column exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_group_members' AND column_name = 'join_date'
) AS join_date_exists;

-- Check if joined_at column exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_group_members' AND column_name = 'joined_at'
) AS joined_at_exists;

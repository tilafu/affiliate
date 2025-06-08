-- Migration to fix notification_categories table by adding missing columns
-- Run this with: psql -U postgres -d affiliate_db -f fix_notification_categories.sql

-- First, check if the table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_categories') THEN
        RAISE NOTICE 'Table notification_categories does not exist. Please check your schema.';
        RETURN;
    END IF;
END
$$;

-- Add color column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notification_categories' 
                   AND column_name = 'color' 
                   AND table_schema = 'public') THEN
        ALTER TABLE notification_categories ADD COLUMN color VARCHAR(7) DEFAULT '#007bff';
        RAISE NOTICE 'Added color column to notification_categories';
    ELSE
        RAISE NOTICE 'Color column already exists in notification_categories';
    END IF;
END
$$;

-- Add icon column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notification_categories' 
                   AND column_name = 'icon' 
                   AND table_schema = 'public') THEN
        ALTER TABLE notification_categories ADD COLUMN icon VARCHAR(50) DEFAULT 'fas fa-bell';
        RAISE NOTICE 'Added icon column to notification_categories';
    ELSE
        RAISE NOTICE 'Icon column already exists in notification_categories';
    END IF;
END
$$;

-- Create default categories if table is empty
DO $$
DECLARE
    category_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_count FROM notification_categories;
    
    IF category_count = 0 THEN
        INSERT INTO notification_categories (name, color, icon, created_at, updated_at) VALUES
            ('System', '#007bff', 'fas fa-cog', NOW(), NOW()),
            ('Withdrawal', '#dc3545', 'fas fa-money-bill-wave', NOW(), NOW()),
            ('Deposit', '#28a745', 'fas fa-coins', NOW(), NOW()),
            ('General', '#6c757d', 'fas fa-bell', NOW(), NOW()),
            ('Important', '#fd7e14', 'fas fa-exclamation-triangle', NOW(), NOW()),
            ('Task', '#20c997', 'fas fa-tasks', NOW(), NOW());
        
        RAISE NOTICE 'Created % default notification categories', 6;
    ELSE
        RAISE NOTICE 'Found % existing categories, skipping default creation', category_count;
    END IF;
END
$$;

-- Test the query that was failing
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO test_result
    FROM general_notifications gn
    LEFT JOIN notification_categories nc ON gn.category_id = nc.id
    WHERE gn.is_active = true;
    
    RAISE NOTICE 'Test query successful: Found % active general notifications', test_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test query failed: %', SQLERRM;
END
$$;

-- Display final table structure
SELECT 'notification_categories table structure:' AS info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'notification_categories' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Display category data
SELECT 'Current notification categories:' AS info;
SELECT id, name, color, icon, created_at FROM notification_categories ORDER BY id;

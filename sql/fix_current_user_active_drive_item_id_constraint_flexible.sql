-- Fix current_user_active_drive_item_id constraint issue
-- This script ensures the column exists and is nullable, allowing for flexibility
-- in drive sessions that may not have active items

-- Connect to database
\c affiliate_db

-- Check if the column exists and ensure it's nullable
DO $$
BEGIN
    -- Check if the column exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'drive_sessions'
        AND column_name = 'current_user_active_drive_item_id'
    ) THEN
        RAISE NOTICE 'Column current_user_active_drive_item_id exists in drive_sessions';
        
        -- Check if it has a NOT NULL constraint and remove it if present
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'drive_sessions'
            AND column_name = 'current_user_active_drive_item_id'
            AND is_nullable = 'NO'
        ) THEN
            RAISE NOTICE 'Removing NOT NULL constraint from current_user_active_drive_item_id';
            ALTER TABLE drive_sessions ALTER COLUMN current_user_active_drive_item_id DROP NOT NULL;
        ELSE
            RAISE NOTICE 'Column current_user_active_drive_item_id is already nullable';
        END IF;
        
    ELSE
        RAISE NOTICE 'Adding current_user_active_drive_item_id column to drive_sessions';
        ALTER TABLE drive_sessions ADD COLUMN current_user_active_drive_item_id INTEGER NULL;
    END IF;
    
    -- Ensure the foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND table_name = 'drive_sessions'
        AND constraint_name = 'fk_current_user_active_drive_item'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE NOTICE 'Adding foreign key constraint for current_user_active_drive_item_id';
        ALTER TABLE drive_sessions
        ADD CONSTRAINT fk_current_user_active_drive_item
        FOREIGN KEY (current_user_active_drive_item_id)
        REFERENCES user_active_drive_items(id)
        ON DELETE SET NULL;
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
    
    -- For existing sessions without current_user_active_drive_item_id,
    -- try to link them to their first active drive item if it exists
    UPDATE drive_sessions ds
    SET current_user_active_drive_item_id = (
        SELECT uadi.id
        FROM user_active_drive_items uadi
        WHERE uadi.drive_session_id = ds.id
        AND uadi.user_status IN ('CURRENT', 'PENDING')
        ORDER BY uadi.order_in_drive ASC
        LIMIT 1
    )
    WHERE ds.current_user_active_drive_item_id IS NULL
    AND ds.status IN ('active', 'pending_reset', 'frozen');
    
    RAISE NOTICE 'Migration completed successfully';
END $$;

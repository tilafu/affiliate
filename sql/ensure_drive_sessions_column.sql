-- SQL script to ensure drive_sessions has current_user_active_drive_item_id column
-- This script can be run directly in any PostgreSQL client

-- Check if the current_user_active_drive_item_id column exists in drive_sessions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'drive_sessions'
        AND column_name = 'current_user_active_drive_item_id'
    ) THEN
        -- Add the column
        EXECUTE 'ALTER TABLE public.drive_sessions ADD COLUMN current_user_active_drive_item_id INTEGER';
        RAISE NOTICE 'Added current_user_active_drive_item_id column to drive_sessions table.';
    ELSE
        RAISE NOTICE 'Column current_user_active_drive_item_id already exists in drive_sessions table.';
    END IF;
END $$;

-- Check if the foreign key constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND table_name = 'drive_sessions'
        AND constraint_name = 'fk_drive_sessions_current_user_active_drive_item'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Add foreign key constraint
        EXECUTE 'ALTER TABLE public.drive_sessions 
                ADD CONSTRAINT fk_drive_sessions_current_user_active_drive_item
                FOREIGN KEY (current_user_active_drive_item_id)
                REFERENCES public.user_active_drive_items (id)
                ON DELETE SET NULL
                ON UPDATE CASCADE';
        RAISE NOTICE 'Added foreign key constraint to current_user_active_drive_item_id column.';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists for current_user_active_drive_item_id column.';
    END IF;
END $$;

-- For any active drive sessions that don't have a current_user_active_drive_item_id set,
-- update them with the first active drive item from user_active_drive_items
DO $$
DECLARE
    session_record RECORD;
    first_item_id INTEGER;
BEGIN
    FOR session_record IN 
        SELECT ds.id, ds.user_id
        FROM drive_sessions ds
        WHERE ds.status = 'active' 
        AND ds.current_user_active_drive_item_id IS NULL
    LOOP
        -- Find the first active drive item for this session
        SELECT id INTO first_item_id
        FROM user_active_drive_items
        WHERE drive_session_id = session_record.id
        AND user_status IN ('CURRENT', 'PENDING')
        ORDER BY order_in_drive ASC
        LIMIT 1;
        
        -- If found, update the session
        IF first_item_id IS NOT NULL THEN
            EXECUTE 'UPDATE drive_sessions 
                    SET current_user_active_drive_item_id = $1 
                    WHERE id = $2'
            USING first_item_id, session_record.id;
            
            RAISE NOTICE 'Updated drive session % for user % with current_user_active_drive_item_id %', 
                         session_record.id, session_record.user_id, first_item_id;
        ELSE
            RAISE NOTICE 'No active drive items found for session % (user %). Session remains unchanged.', 
                         session_record.id, session_record.user_id;
        END IF;
    END LOOP;
END $$;

-- Verification query to check the column and constraint
SELECT 
    column_name, 
    data_type
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'drive_sessions'
    AND column_name = 'current_user_active_drive_item_id';

SELECT 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.key_column_usage kcu
    ON tc.constraint_catalog = kcu.constraint_catalog
    AND tc.constraint_schema = kcu.constraint_schema
    AND tc.constraint_name = kcu.constraint_name
JOIN 
    information_schema.constraint_column_usage ccu
    ON ccu.constraint_catalog = tc.constraint_catalog
    AND ccu.constraint_schema = tc.constraint_schema
    AND ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_schema = 'public'
    AND tc.table_name = 'drive_sessions'
    AND tc.constraint_name = 'fk_drive_sessions_current_user_active_drive_item';

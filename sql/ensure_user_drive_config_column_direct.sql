-- Direct SQL script to ensure assigned_drive_configuration_id column exists in users table
-- This version can be executed directly in any PostgreSQL client

-- Check if drive_configurations table exists and create if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'drive_configurations') THEN
        RAISE NOTICE 'Table "drive_configurations" does not exist. Creating it...';
        -- Add table creation logic here if needed
    ELSE
        RAISE NOTICE 'Table "drive_configurations" exists.';
    END IF;
END $$;

-- Check if users table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        RAISE NOTICE 'Table "users" does not exist. Please create it first.';
    ELSE
        RAISE NOTICE 'Table "users" exists.';
    END IF;
END $$;

-- Add the assigned_drive_configuration_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'assigned_drive_configuration_id'
    ) THEN
        EXECUTE 'ALTER TABLE public.users ADD COLUMN assigned_drive_configuration_id INTEGER';
        RAISE NOTICE 'Column "assigned_drive_configuration_id" added to "users" table.';
    ELSE
        RAISE NOTICE 'Column "assigned_drive_configuration_id" already exists in "users" table.';
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND table_name = 'users'
        AND constraint_name = 'fk_users_assigned_drive_configuration'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Only add the constraint if both tables and column exist
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'assigned_drive_configuration_id'
        ) AND EXISTS (
            SELECT 1
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'drive_configurations'
        ) THEN
            EXECUTE 'ALTER TABLE public.users 
                    ADD CONSTRAINT fk_users_assigned_drive_configuration
                    FOREIGN KEY (assigned_drive_configuration_id)
                    REFERENCES public.drive_configurations (id)
                    ON DELETE SET NULL
                    ON UPDATE CASCADE';
            RAISE NOTICE 'Foreign key constraint "fk_users_assigned_drive_configuration" added to "users" table.';
        ELSE
            RAISE NOTICE 'Cannot add foreign key constraint - required tables or columns do not exist.';
        END IF;
    ELSE
        RAISE NOTICE 'Foreign key constraint "fk_users_assigned_drive_configuration" already exists on "users" table.';
    END IF;
END $$;

-- Verification query to check the column and constraint
SELECT 
    column_name, 
    data_type
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'assigned_drive_configuration_id';

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
    AND tc.table_name = 'users'
    AND tc.constraint_name = 'fk_users_assigned_drive_configuration';

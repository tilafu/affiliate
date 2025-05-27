-- PSQL Script to ensure assigned_drive_configuration_id column exists in users table

-- Connect to the database (typically done via psql command line)
-- \c affiliate_db postgres

DO $$
BEGIN
    -- Check if the drive_configurations table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'drive_configurations') THEN
        RAISE NOTICE 'Table "drive_configurations" does not exist. Please create it first.';
        RETURN;
    END IF;

    -- Check if the users table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'users') THEN
        RAISE NOTICE 'Table "users" does not exist. Please create it first.';
        RETURN;
    END IF;

    -- Check if the column assigned_drive_configuration_id exists in users table
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'assigned_drive_configuration_id'
    ) THEN
        RAISE NOTICE 'Column "assigned_drive_configuration_id" does not exist in "users" table. Adding it.';
        ALTER TABLE public.users
        ADD COLUMN assigned_drive_configuration_id INTEGER;
    ELSE
        RAISE NOTICE 'Column "assigned_drive_configuration_id" already exists in "users" table.';
    END IF;

    -- Add foreign key constraint if it doesn't exist
    -- Constraint names must be unique within a schema.
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND table_name = 'users'
        AND constraint_name = 'fk_users_assigned_drive_configuration'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE NOTICE 'Adding foreign key constraint "fk_users_assigned_drive_configuration" to "users" table.';
        ALTER TABLE public.users
        ADD CONSTRAINT fk_users_assigned_drive_configuration
        FOREIGN KEY (assigned_drive_configuration_id)
        REFERENCES public.drive_configurations (id)
        ON DELETE SET NULL -- Or ON DELETE RESTRICT, depending on desired behavior
        ON UPDATE CASCADE;
    ELSE
        RAISE NOTICE 'Foreign key constraint "fk_users_assigned_drive_configuration" already exists on "users" table.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'An error occurred: %', SQLERRM;
END;
$$;

-- Verification (optional, run manually to check)
/*
RAISE NOTICE 'Describing users table after script execution:';
\d users

RAISE NOTICE 'Describing drive_configurations table:';
\d drive_configurations
*/

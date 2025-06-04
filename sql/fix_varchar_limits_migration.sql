-- Migration script to fix VARCHAR limits that are causing data truncation errors
-- This fixes the "value too long for type character varying(20)" error

-- Fix tier_quantity_configs table - increase tier_name limit
ALTER TABLE tier_quantity_configs 
ALTER COLUMN tier_name TYPE VARCHAR(50);

-- Fix drive_configurations table - increase name limit if needed
ALTER TABLE drive_configurations 
ALTER COLUMN name TYPE TEXT;

-- Fix drive_task_sets table - increase name limit if needed  
ALTER TABLE drive_task_sets 
ALTER COLUMN name TYPE VARCHAR(500);

-- Fix users table tier column if it exists and has limits
DO $$ 
BEGIN
    -- Check if tier column exists and alter it if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'tier') THEN
        ALTER TABLE users ALTER COLUMN tier TYPE VARCHAR(50);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN tier_quantity_configs.tier_name IS 'User tier name (Bronze, Silver, Gold, Platinum) - increased limit';

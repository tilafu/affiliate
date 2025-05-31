-- Fix the NOT NULL constraint on current_user_active_drive_item_id
-- This column should allow NULL values to resolve the circular dependency issue

-- Remove the NOT NULL constraint from current_user_active_drive_item_id
ALTER TABLE drive_sessions 
ALTER COLUMN current_user_active_drive_item_id DROP NOT NULL;

-- Add a comment explaining why this column can be NULL
COMMENT ON COLUMN drive_sessions.current_user_active_drive_item_id IS 
'Foreign key to user_active_drive_items.id. Can be NULL temporarily during session creation to resolve circular dependency, but should be populated once the first drive item is created.';

-- Optional: Add a check to ensure that active sessions eventually have a current_user_active_drive_item_id
-- (This is commented out as it might be too restrictive during development)
-- ALTER TABLE drive_sessions 
-- ADD CONSTRAINT chk_active_sessions_have_current_item 
-- CHECK (
--     status != 'active' OR 
--     current_user_active_drive_item_id IS NOT NULL
-- );

-- Migration script to add notes column to drive_sessions table
-- This fixes the assignTierBasedDriveToUser function

-- Add missing notes column to drive_sessions table
ALTER TABLE drive_sessions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add missing ended_at column to drive_sessions table
ALTER TABLE drive_sessions 
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;

-- Add comments for the new columns
COMMENT ON COLUMN drive_sessions.notes IS 'Additional notes about the drive session';
COMMENT ON COLUMN drive_sessions.ended_at IS 'Timestamp when the drive session was ended';

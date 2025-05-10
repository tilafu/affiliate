-- Add is_active column to drive_sessions table
ALTER TABLE drive_sessions ADD COLUMN is_active BOOLEAN DEFAULT true;

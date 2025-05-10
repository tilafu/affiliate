-- Add drive_session_id column to commission_logs table
ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS drive_session_id INT;

-- Create an index for efficient querying by drive_session_id
CREATE INDEX IF NOT EXISTS idx_comm_logs_drive_session_id ON commission_logs(drive_session_id);

-- Add foreign key constraint (optional, do this only if other foreign keys are being used)
-- ALTER TABLE commission_logs ADD CONSTRAINT fk_drive_session_id FOREIGN KEY (drive_session_id) REFERENCES drive_sessions(id);

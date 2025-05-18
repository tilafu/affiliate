-- Add user_drive_configurations table to store which drive configuration is assigned to which user
CREATE TABLE IF NOT EXISTS user_drive_configurations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_configuration_id INTEGER NOT NULL REFERENCES drive_configurations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- Each user can only have one active configuration
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_drive_config_user_id ON user_drive_configurations(user_id);

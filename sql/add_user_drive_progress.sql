-- Add a table to track user's daily drive completions
CREATE TABLE IF NOT EXISTS user_drive_progress (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    drives_completed INT DEFAULT 0,
    is_working_day BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Add a table to track user's overall progress
CREATE TABLE IF NOT EXISTS user_working_days (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    total_working_days INT DEFAULT 0,
    weekly_progress INT DEFAULT 0, -- 0-7 to track progress in the current week
    last_reset_date DATE, -- Track when the weekly progress was last reset
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_drive_progress_user_id ON user_drive_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_drive_progress_date ON user_drive_progress(date);
CREATE INDEX IF NOT EXISTS idx_user_working_days_user_id ON user_working_days(user_id);

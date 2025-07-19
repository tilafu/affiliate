-- Production database optimizations for avatar functionality

-- Add index for faster avatar queries
CREATE INDEX idx_users_avatar_url ON users(avatar_url);

-- Create audit table for avatar changes (compliance/security)
CREATE TABLE IF NOT EXISTS user_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_activity_user_id (user_id),
    INDEX idx_user_activity_action (action),
    INDEX idx_user_activity_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create table for avatar metadata (optional, for analytics)
CREATE TABLE IF NOT EXISTS avatar_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    original_filename VARCHAR(255),
    file_size INT,
    storage_provider ENUM('local', 's3', 'cloudinary') DEFAULT 'local',
    storage_url VARCHAR(500),
    upload_ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_avatar_uploads_user_id (user_id),
    INDEX idx_avatar_uploads_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

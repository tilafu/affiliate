-- Create notification_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#000000',
    icon VARCHAR(50) NOT NULL DEFAULT 'fas fa-bell',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default notification categories
INSERT INTO notification_categories (name, color, icon, description) VALUES
    ('System', '#dc3545', 'fas fa-cog', 'System-wide notifications and updates'),
    ('Drive', '#0d6efd', 'fas fa-car', 'Notifications related to drive activities'),
    ('Commission', '#198754', 'fas fa-dollar-sign', 'Notifications about commission earnings'),
    ('Account', '#6c757d', 'fas fa-user', 'Account-related notifications'),
    ('Support', '#ffc107', 'fas fa-headset', 'Support ticket and response notifications')
ON CONFLICT (name) DO NOTHING; 
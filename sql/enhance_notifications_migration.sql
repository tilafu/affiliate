-- Migration script to enhance notifications system with categories and images
-- This migration adds notification categories, images, and admin management capabilities

-- 1. Create notification categories table
CREATE TABLE IF NOT EXISTS notification_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color_code VARCHAR(7) NOT NULL, -- Hex color code like #FF5733
    icon VARCHAR(50), -- Icon class name (e.g., 'fas fa-bell')
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert default notification categories with colors
INSERT INTO notification_categories (name, color_code, icon, description) VALUES 
('System Alert', '#DC3545', 'fas fa-exclamation-triangle', 'Critical system notifications and alerts'),
('Account Update', '#007BFF', 'fas fa-user-edit', 'Account-related updates and changes'),
('Financial', '#28A745', 'fas fa-dollar-sign', 'Deposit, withdrawal, and commission notifications'),
('Promotion', '#FFC107', 'fas fa-gift', 'Promotional offers and announcements'),
('Security', '#6F42C1', 'fas fa-shield-alt', 'Security-related notifications'),
('General Info', '#17A2B8', 'fas fa-info-circle', 'General information and updates'),
('Event', '#FD7E14', 'fas fa-calendar-alt', 'Event announcements and reminders'),
('Achievement', '#20C997', 'fas fa-trophy', 'Achievement and milestone notifications')
ON CONFLICT (name) DO NOTHING;

-- 3. Create general notifications table (for public notifications visible to all users)
CREATE TABLE IF NOT EXISTS general_notifications (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES notification_categories(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    image_url VARCHAR(500), -- URL or path to notification image
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1, -- 1=Low, 2=Medium, 3=High
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ, -- Optional end date for time-limited notifications
    created_by INTEGER REFERENCES users(id), -- Admin who created the notification
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enhance existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES notification_categories(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set default category for existing notifications
UPDATE notifications 
SET category_id = (SELECT id FROM notification_categories WHERE name = 'General Info' LIMIT 1)
WHERE category_id IS NULL;

-- Make category_id NOT NULL after setting default values
ALTER TABLE notifications ALTER COLUMN category_id SET NOT NULL;

-- 5. Create notification read status table for general notifications
CREATE TABLE IF NOT EXISTS general_notification_reads (
    id SERIAL PRIMARY KEY,
    general_notification_id INTEGER NOT NULL REFERENCES general_notifications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(general_notification_id, user_id)
);

-- 6. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_general_notifications_category ON general_notifications(category_id);
CREATE INDEX IF NOT EXISTS idx_general_notifications_active ON general_notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_general_notifications_priority ON general_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_general_notifications_dates ON general_notifications(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category_id);
CREATE INDEX IF NOT EXISTS idx_general_notification_reads_user ON general_notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_general_notification_reads_notification ON general_notification_reads(general_notification_id);

-- 7. Create triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_categories_updated_at 
    BEFORE UPDATE ON notification_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_general_notifications_updated_at 
    BEFORE UPDATE ON general_notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at 
    BEFORE UPDATE ON notifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE notification_categories IS 'Defines notification categories with color coding and icons';
COMMENT ON TABLE general_notifications IS 'Public notifications visible to all users, managed by admins';
COMMENT ON TABLE general_notification_reads IS 'Tracks which users have read which general notifications';
COMMENT ON COLUMN general_notifications.priority IS '1=Low, 2=Medium, 3=High priority';
COMMENT ON COLUMN notification_categories.color_code IS 'Hex color code for UI display';

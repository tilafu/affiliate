-- Enhanced Notifications System Migration
-- This migration adds notification categories, general notifications, and image support

-- 1. Create notification categories table
CREATE TABLE IF NOT EXISTS notification_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) NOT NULL, -- Hex color code for UI
    icon VARCHAR(50) NOT NULL, -- FontAwesome icon class
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert default notification categories
INSERT INTO notification_categories (name, color, icon, description) VALUES
('System', '#DC3545', 'fas fa-cog', 'System-related notifications and updates'),
('Financial', '#28A745', 'fas fa-dollar-sign', 'Financial transactions and balance updates'),
('Account', '#007BFF', 'fas fa-user', 'Account-related notifications'),
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
    display_order INTEGER DEFAULT 0, -- For ordering notifications
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiration date
);

-- 4. Enhance existing notifications table
-- Add category support and image support to user notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES notification_categories(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set default category for existing notifications (General Info)
UPDATE notifications 
SET category_id = (SELECT id FROM notification_categories WHERE name = 'General Info' LIMIT 1)
WHERE category_id IS NULL;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_general_notifications_category ON general_notifications(category_id);
CREATE INDEX IF NOT EXISTS idx_general_notifications_active ON general_notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_general_notifications_priority ON general_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_general_notifications_created_at ON general_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category_id);

-- 6. Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_categories_updated_at
    BEFORE UPDATE ON notification_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_general_notifications_updated_at
    BEFORE UPDATE ON general_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Insert some sample general notifications
INSERT INTO general_notifications (category_id, title, message, priority, display_order) VALUES
(
    (SELECT id FROM notification_categories WHERE name = 'System' LIMIT 1),
    'Welcome to Our Platform',
    'Welcome to our enhanced notification system! Stay updated with the latest news and updates.',
    2,
    1
),
(
    (SELECT id FROM notification_categories WHERE name = 'Promotion' LIMIT 1),
    'Special Offer Available',
    'Limited time offer: Get 20% bonus on your next deposit! Don''t miss out on this amazing opportunity.',
    3,
    2
),
(
    (SELECT id FROM notification_categories WHERE name = 'Event' LIMIT 1),
    'Platform Maintenance',
    'Scheduled maintenance will occur on Sunday from 2:00 AM to 4:00 AM UTC. Thank you for your patience.',
    2,
    3
);

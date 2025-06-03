-- Migration script to add admin notifications table for balance freezing notifications
-- Create table for admin notifications

CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP NULL
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);

-- Add comments for the table and columns
COMMENT ON TABLE admin_notifications IS 'Stores notifications for admin users about system events';
COMMENT ON COLUMN admin_notifications.type IS 'Type of notification (balance_frozen, etc.)';
COMMENT ON COLUMN admin_notifications.title IS 'Brief title for the notification';
COMMENT ON COLUMN admin_notifications.message IS 'Detailed message for the notification';
COMMENT ON COLUMN admin_notifications.data IS 'JSON data with additional notification details';
COMMENT ON COLUMN admin_notifications.is_read IS 'Whether the notification has been read by admin';
COMMENT ON COLUMN admin_notifications.read_at IS 'Timestamp when notification was marked as read';

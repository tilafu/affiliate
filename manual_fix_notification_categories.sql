-- Simple SQL commands to fix notification_categories table
-- You can run these directly in pgAdmin or psql

-- Check current table structure
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'notification_categories' AND table_schema = 'public';

-- Add missing columns (run these one by one)
ALTER TABLE notification_categories ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6c757d';
ALTER TABLE notification_categories ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'fas fa-bell';
ALTER TABLE notification_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Insert some default categories if the table is empty
INSERT INTO notification_categories (name, color, icon, created_at, updated_at)
SELECT 'System', '#007bff', 'fas fa-cog', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM notification_categories WHERE name = 'System');

INSERT INTO notification_categories (name, color, icon, created_at, updated_at)
SELECT 'General', '#6c757d', 'fas fa-bell', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM notification_categories WHERE name = 'General');

INSERT INTO notification_categories (name, color, icon, created_at, updated_at)
SELECT 'Important', '#fd7e14', 'fas fa-exclamation-triangle', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM notification_categories WHERE name = 'Important');

-- Verify the changes
SELECT * FROM notification_categories;

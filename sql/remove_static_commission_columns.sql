-- Remove static commission columns since commission rates should be dynamic based on user tiers
-- This ensures all commission calculations use the tier-based system

-- Remove commission_rate from products table
ALTER TABLE products DROP COLUMN IF EXISTS commission_rate;

-- Remove commission_override from drive_task_set_products table  
ALTER TABLE drive_task_set_products DROP COLUMN IF EXISTS commission_override;

-- Add a comment to document this change
COMMENT ON TABLE products IS 'Products table - commission rates are calculated dynamically based on user membership tiers';
COMMENT ON TABLE drive_task_set_products IS 'Drive task set products - commission rates calculated dynamically, no static overrides';

-- Enhanced Tier Management Database Migration
-- This migration adds the necessary columns to support full tier management

-- First, add the missing columns to tier_quantity_configs table
ALTER TABLE tier_quantity_configs 
ADD COLUMN IF NOT EXISTS num_single_tasks INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS num_combo_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_price_single NUMERIC(10,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS max_price_single NUMERIC(10,2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS min_price_combo NUMERIC(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS max_price_combo NUMERIC(10,2) DEFAULT 500.00,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 5.00;

-- Update existing records with default values
UPDATE tier_quantity_configs SET 
    num_single_tasks = CASE 
        WHEN tier_name = 'bronze' THEN 30
        WHEN tier_name = 'silver' THEN 40
        WHEN tier_name = 'gold' THEN 50
        WHEN tier_name = 'platinum' THEN 60
        ELSE 40
    END,
    min_price_single = CASE 
        WHEN tier_name = 'bronze' THEN 10.00
        WHEN tier_name = 'silver' THEN 15.00
        WHEN tier_name = 'gold' THEN 20.00
        WHEN tier_name = 'platinum' THEN 25.00
        ELSE 10.00
    END,
    max_price_single = CASE 
        WHEN tier_name = 'bronze' THEN 80.00
        WHEN tier_name = 'silver' THEN 120.00
        WHEN tier_name = 'gold' THEN 180.00
        WHEN tier_name = 'platinum' THEN 250.00
        ELSE 100.00
    END,
    min_price_combo = CASE 
        WHEN tier_name = 'bronze' THEN 50.00
        WHEN tier_name = 'silver' THEN 75.00
        WHEN tier_name = 'gold' THEN 100.00
        WHEN tier_name = 'platinum' THEN 150.00
        ELSE 50.00
    END,
    max_price_combo = CASE 
        WHEN tier_name = 'bronze' THEN 300.00
        WHEN tier_name = 'silver' THEN 450.00
        WHEN tier_name = 'gold' THEN 600.00
        WHEN tier_name = 'platinum' THEN 800.00
        ELSE 500.00
    END,
    commission_rate = CASE 
        WHEN tier_name = 'bronze' THEN 3.00
        WHEN tier_name = 'silver' THEN 4.00
        WHEN tier_name = 'gold' THEN 5.00
        WHEN tier_name = 'platinum' THEN 6.00
        ELSE 5.00
    END,
    description = CASE 
        WHEN tier_name = 'bronze' THEN 'Entry level tier with basic privileges'
        WHEN tier_name = 'silver' THEN 'Intermediate tier with enhanced benefits'
        WHEN tier_name = 'gold' THEN 'Advanced tier with premium features'
        WHEN tier_name = 'platinum' THEN 'Premium tier with maximum benefits'
        ELSE 'Standard tier'
    END
WHERE tier_name IN ('bronze', 'silver', 'gold', 'platinum');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tier_quantity_configs_tier_name_active 
ON tier_quantity_configs(tier_name, is_active);

-- Insert default tiers if they don't exist
INSERT INTO tier_quantity_configs (tier_name, quantity_limit, num_single_tasks, min_price_single, max_price_single, description)
SELECT 'bronze', 30, 30, 10.00, 80.00, 'Entry level tier with basic privileges'
WHERE NOT EXISTS (SELECT 1 FROM tier_quantity_configs WHERE tier_name = 'bronze');

INSERT INTO tier_quantity_configs (tier_name, quantity_limit, num_single_tasks, min_price_single, max_price_single, description)
SELECT 'silver', 40, 40, 15.00, 120.00, 'Intermediate tier with enhanced benefits'
WHERE NOT EXISTS (SELECT 1 FROM tier_quantity_configs WHERE tier_name = 'silver');

INSERT INTO tier_quantity_configs (tier_name, quantity_limit, num_single_tasks, min_price_single, max_price_single, description)
SELECT 'gold', 50, 50, 20.00, 180.00, 'Advanced tier with premium features'
WHERE NOT EXISTS (SELECT 1 FROM tier_quantity_configs WHERE tier_name = 'gold');

INSERT INTO tier_quantity_configs (tier_name, quantity_limit, num_single_tasks, min_price_single, max_price_single, description)
SELECT 'platinum', 60, 60, 25.00, 250.00, 'Premium tier with maximum benefits'
WHERE NOT EXISTS (SELECT 1 FROM tier_quantity_configs WHERE tier_name = 'platinum');

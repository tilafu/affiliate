-- Updated Tier Management Migration
-- This adds new columns to tier_quantity_configs while working with existing constraints

-- First, let's drop the restrictive tier_name constraint to allow more flexibility
ALTER TABLE tier_quantity_configs DROP CONSTRAINT IF EXISTS chk_tier_name;

-- Add new columns to tier_quantity_configs
ALTER TABLE tier_quantity_configs 
ADD COLUMN IF NOT EXISTS num_single_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_combo_tasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_price_single NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_price_single NUMERIC(10,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS min_price_combo NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_price_combo NUMERIC(10,2) DEFAULT 500,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Update existing rows with default values for the new tier-specific settings
UPDATE tier_quantity_configs SET
    num_single_tasks = CASE 
        WHEN tier_name = 'Bronze' THEN 25
        WHEN tier_name = 'Silver' THEN 30
        WHEN tier_name = 'Gold' THEN 35
        WHEN tier_name = 'Platinum' THEN 40
        ELSE 25
    END,
    num_combo_tasks = CASE 
        WHEN tier_name = 'Bronze' THEN 3
        WHEN tier_name = 'Silver' THEN 4
        WHEN tier_name = 'Gold' THEN 5
        WHEN tier_name = 'Platinum' THEN 6
        ELSE 3
    END,
    min_price_single = CASE 
        WHEN tier_name = 'Bronze' THEN 10
        WHEN tier_name = 'Silver' THEN 15
        WHEN tier_name = 'Gold' THEN 20
        WHEN tier_name = 'Platinum' THEN 25
        ELSE 10
    END,
    max_price_single = CASE 
        WHEN tier_name = 'Bronze' THEN 50
        WHEN tier_name = 'Silver' THEN 75
        WHEN tier_name = 'Gold' THEN 100
        WHEN tier_name = 'Platinum' THEN 150
        ELSE 50
    END,
    min_price_combo = CASE 
        WHEN tier_name = 'Bronze' THEN 50
        WHEN tier_name = 'Silver' THEN 75
        WHEN tier_name = 'Gold' THEN 100
        WHEN tier_name = 'Platinum' THEN 150
        ELSE 50
    END,
    max_price_combo = CASE 
        WHEN tier_name = 'Bronze' THEN 200
        WHEN tier_name = 'Silver' THEN 300
        WHEN tier_name = 'Gold' THEN 400
        WHEN tier_name = 'Platinum' THEN 500
        ELSE 200
    END,
    commission_rate = CASE 
        WHEN tier_name = 'Bronze' THEN 3.0
        WHEN tier_name = 'Silver' THEN 4.0
        WHEN tier_name = 'Gold' THEN 5.0
        WHEN tier_name = 'Platinum' THEN 6.0
        ELSE 3.0
    END,
    description = CASE 
        WHEN tier_name = 'Bronze' THEN 'Entry level tier with basic benefits'
        WHEN tier_name = 'Silver' THEN 'Intermediate tier with enhanced features'
        WHEN tier_name = 'Gold' THEN 'Advanced tier with premium benefits'
        WHEN tier_name = 'Platinum' THEN 'Premium tier with maximum benefits'
        ELSE 'Custom tier configuration'
    END
WHERE num_single_tasks IS NULL OR num_single_tasks = 0;

-- Add a more flexible constraint that allows common tier names but doesn't restrict to only the original four
-- This allows for future custom tiers while maintaining data integrity
ALTER TABLE tier_quantity_configs 
ADD CONSTRAINT chk_tier_name_format 
CHECK (
    LENGTH(tier_name) > 0 AND 
    LENGTH(tier_name) <= 50 AND
    tier_name ~ '^[A-Za-z][A-Za-z0-9\s\-_]*$'
);

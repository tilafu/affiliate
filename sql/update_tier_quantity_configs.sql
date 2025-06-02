-- Update tier_quantity_configs table to include all necessary columns for drive generation
-- Add missing columns for task configuration

ALTER TABLE tier_quantity_configs 
ADD COLUMN IF NOT EXISTS num_single_tasks INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS num_combo_tasks INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS min_price_single NUMERIC(10,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS max_price_single NUMERIC(10,2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS min_price_combo NUMERIC(10,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS max_price_combo NUMERIC(10,2) DEFAULT 100.00;

-- Update existing records with default values based on tier
UPDATE tier_quantity_configs SET
    num_single_tasks = CASE 
        WHEN tier_name = 'Bronze' THEN 20
        WHEN tier_name = 'Silver' THEN 20
        WHEN tier_name = 'Gold' THEN 22
        WHEN tier_name = 'Platinum' THEN 25
        ELSE 20
    END,
    num_combo_tasks = CASE 
        WHEN tier_name = 'Bronze' THEN 20
        WHEN tier_name = 'Silver' THEN 20
        WHEN tier_name = 'Gold' THEN 23
        WHEN tier_name = 'Platinum' THEN 25
        ELSE 20
    END,
    min_price_single = CASE 
        WHEN tier_name = 'Bronze' THEN 1.00
        WHEN tier_name = 'Silver' THEN 2.00
        WHEN tier_name = 'Gold' THEN 3.00
        WHEN tier_name = 'Platinum' THEN 5.00
        ELSE 1.00
    END,
    max_price_single = CASE 
        WHEN tier_name = 'Bronze' THEN 30.00
        WHEN tier_name = 'Silver' THEN 50.00
        WHEN tier_name = 'Gold' THEN 75.00
        WHEN tier_name = 'Platinum' THEN 100.00
        ELSE 30.00
    END,
    min_price_combo = CASE 
        WHEN tier_name = 'Bronze' THEN 5.00
        WHEN tier_name = 'Silver' THEN 10.00
        WHEN tier_name = 'Gold' THEN 15.00
        WHEN tier_name = 'Platinum' THEN 20.00
        ELSE 5.00
    END,
    max_price_combo = CASE 
        WHEN tier_name = 'Bronze' THEN 80.00
        WHEN tier_name = 'Silver' THEN 120.00
        WHEN tier_name = 'Gold' THEN 180.00
        WHEN tier_name = 'Platinum' THEN 250.00
        ELSE 80.00
    END;

-- Add comments for the new columns
COMMENT ON COLUMN tier_quantity_configs.num_single_tasks IS 'Number of single tasks for drive generation';
COMMENT ON COLUMN tier_quantity_configs.num_combo_tasks IS 'Number of combo tasks for drive generation';
COMMENT ON COLUMN tier_quantity_configs.min_price_single IS 'Minimum price for single task products';
COMMENT ON COLUMN tier_quantity_configs.max_price_single IS 'Maximum price for single task products';
COMMENT ON COLUMN tier_quantity_configs.min_price_combo IS 'Minimum price for combo task products';
COMMENT ON COLUMN tier_quantity_configs.max_price_combo IS 'Maximum price for combo task products';

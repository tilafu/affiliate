-- Add order_in_drive column to drive_orders table
ALTER TABLE drive_orders ADD COLUMN IF NOT EXISTS order_in_drive INTEGER;

-- Update existing records to have a default value (0)
UPDATE drive_orders SET order_in_drive = 0 WHERE order_in_drive IS NULL;

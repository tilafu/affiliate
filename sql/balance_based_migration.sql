-- Migration script to add balance-based filtering support to drive_configurations table
-- Add new columns for balance-based drive configurations

ALTER TABLE drive_configurations 
ADD COLUMN balance_filter_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN tier_quantity_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN min_balance_percentage NUMERIC(5,2) DEFAULT 75.00,
ADD COLUMN max_balance_percentage NUMERIC(5,2) DEFAULT 99.00;

-- Add comments for the new columns
COMMENT ON COLUMN drive_configurations.balance_filter_enabled IS 'Enable/disable balance-based product filtering (75%-99% range)';
COMMENT ON COLUMN drive_configurations.tier_quantity_enabled IS 'Enable/disable tier-based quantity limits';
COMMENT ON COLUMN drive_configurations.min_balance_percentage IS 'Minimum balance percentage for product filtering';
COMMENT ON COLUMN drive_configurations.max_balance_percentage IS 'Maximum balance percentage for product filtering';

-- Create table for tier quantity configurations (admin adjustable)
CREATE TABLE IF NOT EXISTS tier_quantity_configs (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(20) NOT NULL UNIQUE,
    quantity_limit INTEGER NOT NULL DEFAULT 40,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_tier_name CHECK (tier_name IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
    CONSTRAINT chk_quantity_limit CHECK (quantity_limit > 0)
);

-- Insert default tier quantity limits
INSERT INTO tier_quantity_configs (tier_name, quantity_limit) VALUES
('Bronze', 40),
('Silver', 40),
('Gold', 45),
('Platinum', 50)
ON CONFLICT (tier_name) DO NOTHING;

-- Add trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_tier_quantity_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tier_quantity_configs_updated_at
BEFORE UPDATE ON tier_quantity_configs
FOR EACH ROW
EXECUTE FUNCTION update_tier_quantity_configs_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tier_quantity_configs_tier_name ON tier_quantity_configs(tier_name);
CREATE INDEX IF NOT EXISTS idx_tier_quantity_configs_active ON tier_quantity_configs(is_active);

-- Add balance column to users table if it doesn't exist (for balance filtering)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'balance') THEN
        ALTER TABLE users ADD COLUMN balance NUMERIC(15,2) DEFAULT 0.00;
        COMMENT ON COLUMN users.balance IS 'User current balance for balance-based filtering';
    END IF;
END $$;

-- Create index on users balance for filtering performance
CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance);
CREATE INDEX IF NOT EXISTS idx_users_tier_balance ON users(tier, balance);

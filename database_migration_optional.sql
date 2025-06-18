-- Database Migration: Add missing columns
-- Generated: 2025-06-16T18:17:09.720Z
-- Run these queries if you need the missing functionality

-- Add mobile_number to users table (if mobile functionality is needed)
ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20);

-- Add pricing columns to tier_quantity_configs (if pricing functionality is needed)
ALTER TABLE tier_quantity_configs ADD COLUMN min_price_single NUMERIC(10,2);
ALTER TABLE tier_quantity_configs ADD COLUMN max_price_single NUMERIC(10,2);

-- Create user_tiers table (if separate tier management is needed)
CREATE TABLE user_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tiers
INSERT INTO user_tiers (name, description) VALUES 
('bronze', 'Bronze tier - basic level'),
('silver', 'Silver tier - intermediate level'),
('gold', 'Gold tier - advanced level'),
('platinum', 'Platinum tier - premium level');

-- Update tier_quantity_configs to reference user_tiers (if needed)
-- Note: This would require data migration and is optional
-- ALTER TABLE tier_quantity_configs ADD COLUMN tier_id INTEGER REFERENCES user_tiers(id);

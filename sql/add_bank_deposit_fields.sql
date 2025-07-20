-- Add fields to support bank deposits and deposit type classification
-- This script adds the necessary columns to the existing deposits table

-- Add deposit type field (bank or direct)
ALTER TABLE deposits 
ADD COLUMN deposit_type VARCHAR(20) DEFAULT 'direct' CHECK (deposit_type IN ('direct', 'bank'));

-- Add bank-specific fields
ALTER TABLE deposits 
ADD COLUMN bank_name VARCHAR(100);

-- Add notes field for additional information
ALTER TABLE deposits 
ADD COLUMN notes TEXT;

-- Add index for deposit type for better query performance
CREATE INDEX idx_deposits_type ON deposits(deposit_type);

-- Update existing records to have deposit_type = 'direct' (they are all direct deposits currently)
UPDATE deposits SET deposit_type = 'direct' WHERE deposit_type IS NULL;

-- Create a view to easily query bank deposits
CREATE VIEW bank_deposits AS 
SELECT 
    id,
    user_id,
    amount,
    status,
    bank_name,
    notes,
    client_image_url,
    client_image_filename,
    created_at,
    updated_at
FROM deposits 
WHERE deposit_type = 'bank';

-- Create a view to easily query direct deposits  
CREATE VIEW direct_deposits AS 
SELECT 
    id,
    user_id,
    amount,
    status,
    txn_hash,
    description,
    client_image_url,
    client_image_filename,
    created_at,
    updated_at
FROM deposits 
WHERE deposit_type = 'direct';

-- Show the updated table structure
\d deposits;

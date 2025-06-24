-- Migration: Add wallet_address column to deposit_qr_codes table
-- Date: 2025-06-24
-- Description: Add wallet address field to QR code management system

-- Add wallet_address column to existing deposit_qr_codes table
ALTER TABLE deposit_qr_codes 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);

-- Add a comment to the column
COMMENT ON COLUMN deposit_qr_codes.wallet_address IS 'Wallet address associated with the QR code for deposit payments';

-- Optional: Update existing records with a placeholder (remove if not needed)
-- UPDATE deposit_qr_codes SET wallet_address = 'Not set' WHERE wallet_address IS NULL;

-- Verify the column was added successfully
SELECT column_name, data_type, character_maximum_length, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'deposit_qr_codes' 
AND column_name = 'wallet_address';
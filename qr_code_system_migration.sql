-- Database Migration for QR Code System
-- Add QR code management and client deposit images

-- Table for storing admin-managed QR codes
CREATE TABLE IF NOT EXISTS deposit_qr_codes (
    id SERIAL PRIMARY KEY,
    qr_code_url VARCHAR(500) NOT NULL,
    wallet_address VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    uploaded_by_admin_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add image upload capability to deposits table
ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS client_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS client_image_filename VARCHAR(255);

-- Insert default QR code placeholder
INSERT INTO deposit_qr_codes (qr_code_url, description, is_active, uploaded_by_admin_id) 
VALUES ('/assets/uploads/qr-codes/default-qr.png', 'Default deposit QR code', true, NULL)
ON CONFLICT DO NOTHING;

-- Create uploads directory structure
-- Note: These directories need to be created manually:
-- /public/assets/uploads/qr-codes/
-- /public/assets/uploads/deposit-images/

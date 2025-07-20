-- Add admin tracking fields for deposit approvals
-- This script adds fields to track which admin approved/rejected deposits and when

-- Add admin tracking fields
ALTER TABLE deposits 
ADD COLUMN approved_by INTEGER REFERENCES users(id),
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN admin_notes TEXT;

-- Add index for approved_by for better query performance
CREATE INDEX idx_deposits_approved_by ON deposits(approved_by);

-- Add index for approved_at for better query performance  
CREATE INDEX idx_deposits_approved_at ON deposits(approved_at);

-- Create a view to see deposit approval history with admin details
CREATE VIEW deposit_approval_history AS 
SELECT 
    d.id,
    d.user_id,
    u.username as user_username,
    u.email as user_email,
    d.amount,
    d.deposit_type,
    d.bank_name,
    d.status,
    d.notes as user_notes,
    d.admin_notes,
    d.created_at as submitted_at,
    d.approved_by,
    admin.username as approved_by_username,
    admin.email as approved_by_email,
    d.approved_at,
    d.client_image_url,
    d.client_image_filename
FROM deposits d
JOIN users u ON d.user_id = u.id
LEFT JOIN users admin ON d.approved_by = admin.id
ORDER BY d.created_at DESC;

-- Create a view for pending deposits that need admin review
CREATE VIEW pending_deposits_for_review AS 
SELECT 
    d.id,
    d.user_id,
    u.username,
    u.email,
    d.amount,
    d.deposit_type,
    d.bank_name,
    d.notes,
    d.client_image_url,
    d.client_image_filename,
    d.created_at as submitted_at,
    EXTRACT(HOURS FROM (NOW() - d.created_at)) as hours_pending
FROM deposits d
JOIN users u ON d.user_id = u.id
WHERE d.status = 'PENDING'
ORDER BY d.created_at ASC;

-- Show the updated table structure
\d deposits;

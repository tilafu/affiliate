-- Test the bank deposit functionality
-- Check if all required fields exist

-- Check deposits table structure
\d deposits;

-- Check if admin tracking fields exist
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'deposits' 
  AND table_schema = 'public'
  AND column_name IN ('approved_by', 'approved_at', 'admin_notes', 'deposit_type', 'bank_name', 'notes')
ORDER BY column_name;

-- Test query for bank deposits with admin tracking
SELECT 
    d.id,
    d.user_id,
    u.username,
    d.amount,
    d.deposit_type,
    d.bank_name,
    d.notes,
    d.status,
    d.approved_by,
    admin.username as approved_by_username,
    d.approved_at,
    d.admin_notes,
    d.created_at
FROM deposits d
JOIN users u ON d.user_id = u.id
LEFT JOIN users admin ON d.approved_by = admin.id
WHERE d.deposit_type = 'bank'
ORDER BY d.created_at DESC
LIMIT 5;

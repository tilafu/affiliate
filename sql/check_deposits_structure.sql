-- Database structure analysis and bank deposit implementation
-- Run this to see current state and execute the migration

-- 1. Current deposits table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'deposits' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Current deposit records sample
SELECT 
    id,
    user_id,
    amount,
    status,
    deposit_type,
    bank_name,
    notes,
    created_at
FROM deposits 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Count deposits by type (after migration)
SELECT 
    deposit_type,
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM deposits 
GROUP BY deposit_type, status
ORDER BY deposit_type, status;

-- 4. Bank deposits with complete information
SELECT 
    d.id,
    u.username,
    d.amount,
    d.bank_name,
    d.notes,
    d.status,
    d.client_image_filename,
    d.created_at
FROM deposits d
JOIN users u ON d.user_id = u.id
WHERE d.deposit_type = 'bank'
ORDER BY d.created_at DESC;

-- 5. Pending deposits for admin review
SELECT 
    d.id,
    u.username,
    d.amount,
    d.deposit_type,
    CASE 
        WHEN d.deposit_type = 'bank' THEN d.bank_name 
        ELSE 'Direct Deposit'
    END as deposit_source,
    d.status,
    d.client_image_filename,
    d.created_at
FROM deposits d
JOIN users u ON d.user_id = u.id
WHERE d.status = 'PENDING'
ORDER BY d.created_at ASC;

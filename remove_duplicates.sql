-- SQL Query to Remove Duplicate Products
-- This will keep the product with the LOWEST ID for each unique name+price combination

-- First, let's see what duplicates exist
SELECT 
    name, 
    price, 
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ' ORDER BY id) as all_ids
FROM products 
GROUP BY name, price 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, name;

-- Preview which records will be DELETED (run this first to be safe)
SELECT 
    id,
    name,
    price,
    'WILL BE DELETED' as action
FROM products p1
WHERE EXISTS (
    SELECT 1 
    FROM products p2 
    WHERE p2.name = p1.name 
    AND p2.price = p1.price 
    AND p2.id < p1.id
)
ORDER BY name, price, id;

-- Preview which records will be KEPT
SELECT 
    id,
    name,
    price,
    'WILL BE KEPT' as action
FROM products p1
WHERE NOT EXISTS (
    SELECT 1 
    FROM products p2 
    WHERE p2.name = p1.name 
    AND p2.price = p1.price 
    AND p2.id < p1.id
)
AND EXISTS (
    SELECT 1 
    FROM products p2 
    WHERE p2.name = p1.name 
    AND p2.price = p1.price 
    AND p2.id != p1.id
)
ORDER BY name, price, id;

-- ACTUAL DELETE QUERY (run this after reviewing the preview)
-- This deletes all duplicates except the one with the lowest ID
DELETE FROM products 
WHERE id IN (
    SELECT p1.id
    FROM products p1
    WHERE EXISTS (
        SELECT 1 
        FROM products p2 
        WHERE p2.name = p1.name 
        AND p2.price = p1.price 
        AND p2.id < p1.id
    )
);

-- Alternative approach: Use a CTE with ROW_NUMBER (PostgreSQL)
-- This is safer and more explicit about what's being kept
WITH duplicate_products AS (
    SELECT 
        id,
        name,
        price,
        ROW_NUMBER() OVER (
            PARTITION BY name, price 
            ORDER BY id ASC
        ) as row_num
    FROM products
)
DELETE FROM products 
WHERE id IN (
    SELECT id 
    FROM duplicate_products 
    WHERE row_num > 1
);

-- After running the delete, verify the results
SELECT 
    name, 
    price, 
    COUNT(*) as count
FROM products 
GROUP BY name, price 
HAVING COUNT(*) > 1;

-- This should return no results if all duplicates were removed

-- Optional: Update statistics and vacuum the table
ANALYZE products;

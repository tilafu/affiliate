-- SQL script to list all tables and their columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' -- Or your specific schema if not 'public'
ORDER BY 
    table_name,
    ordinal_position;

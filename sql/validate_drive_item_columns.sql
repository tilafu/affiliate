-- SQL script to validate the existence of specific columns in the user_active_drive_items table

-- Check for current_product_slot_processed column
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' -- Or your specific schema
            AND table_name = 'user_active_drive_items'
            AND column_name = 'current_product_slot_processed'
        )
        THEN 'Column current_product_slot_processed EXISTS'
        ELSE 'Column current_product_slot_processed DOES NOT EXIST'
    END AS column_existence_check;

-- Check for drive_task_set_id_override column
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' -- Or your specific schema
            AND table_name = 'user_active_drive_items'
            AND column_name = 'drive_task_set_id_override'
        )
        THEN 'Column drive_task_set_id_override EXISTS'
        ELSE 'Column drive_task_set_id_override DOES NOT EXIST'
    END AS column_existence_check;

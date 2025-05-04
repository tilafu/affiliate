SELECT
    table_name,
    column_name,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'drive_orders' AND column_name = 'id'
    ) AS drive_orders_id_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'drive_orders' AND column_name = 'status'
    ) AS drive_orders_status_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'drive_orders' AND column_name = 'session_id'
    ) AS drive_orders_session_id_exists,
     EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'drive_orders' AND column_name = 'product_id'
    ) AS drive_orders_product_id_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'id'
    ) AS products_id_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'name'
    ) AS products_name_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'image_url'
    ) AS products_image_url_exists,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'price'
    ) AS products_price_exists
LIMIT 1;

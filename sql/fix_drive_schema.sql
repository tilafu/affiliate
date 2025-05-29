-- Script to ensure all required columns for the Drive functionality exist
-- This helps fix the 500 error in /api/drive/status and makes the drive system work properly

-- Connect to the database (typically done via psql command line or through your PostgreSQL client)

-- Add missing columns to drive_sessions if they don't exist
DO $$
BEGIN
    -- Check if current_user_active_drive_item_id column exists in drive_sessions
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'drive_sessions'
        AND column_name = 'current_user_active_drive_item_id'
    ) THEN
        RAISE NOTICE 'Adding current_user_active_drive_item_id column to drive_sessions table';
        ALTER TABLE public.drive_sessions ADD COLUMN current_user_active_drive_item_id INTEGER NULL;
        
        -- We'll add the foreign key constraint separately after ensuring user_active_drive_items table exists
    ELSE
        RAISE NOTICE 'current_user_active_drive_item_id column already exists in drive_sessions table';
    END IF;
    
    -- Check if user_active_drive_items table exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_active_drive_items'
    ) THEN
        RAISE NOTICE 'user_active_drive_items table does not exist. Creating it now...';
        
        -- Create the user_active_drive_items table
        CREATE TABLE user_active_drive_items (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            drive_session_id INT NOT NULL,
            product_id_1 INT NOT NULL,
            product_id_2 INT NULL,
            product_id_3 INT NULL,
            order_in_drive INT NOT NULL,
            user_status VARCHAR(10) DEFAULT 'PENDING' NOT NULL,
            task_type VARCHAR(50) DEFAULT 'order',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id_1) REFERENCES products(id) ON DELETE RESTRICT,
            FOREIGN KEY (product_id_2) REFERENCES products(id) ON DELETE RESTRICT,
            FOREIGN KEY (product_id_3) REFERENCES products(id) ON DELETE RESTRICT,
            FOREIGN KEY (drive_session_id) REFERENCES drive_sessions(id) ON DELETE CASCADE,
            CONSTRAINT chk_user_status CHECK (user_status IN ('PENDING', 'CURRENT', 'COMPLETED', 'SKIPPED', 'FAILED'))
        );
        
        -- Create indexes
        CREATE INDEX idx_user_drive_session_order ON user_active_drive_items (user_id, drive_session_id, order_in_drive);
        CREATE INDEX idx_drive_session_id ON user_active_drive_items (drive_session_id);
        
        RAISE NOTICE 'user_active_drive_items table created successfully';
    ELSE
        RAISE NOTICE 'user_active_drive_items table already exists';
    END IF;
    
    -- Now that we've ensured both tables exist, add the foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND table_name = 'drive_sessions'
        AND constraint_name = 'fk_current_user_active_drive_item'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE NOTICE 'Adding foreign key constraint fk_current_user_active_drive_item to drive_sessions table';
        
        -- Adding the foreign key constraint
        ALTER TABLE public.drive_sessions
        ADD CONSTRAINT fk_current_user_active_drive_item
        FOREIGN KEY (current_user_active_drive_item_id)
        REFERENCES public.user_active_drive_items(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Foreign key constraint added successfully';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_current_user_active_drive_item already exists';
    END IF;
    
    -- For existing active sessions without a current_user_active_drive_item_id,
    -- find and link the first non-completed drive item
    RAISE NOTICE 'Checking for active sessions without current_user_active_drive_item_id...';
    
    FOR session_rec IN 
        SELECT ds.id as session_id, ds.user_id
        FROM drive_sessions ds
        WHERE ds.status = 'active' 
        AND ds.current_user_active_drive_item_id IS NULL
    LOOP
        -- Find first non-completed item for this session
        FOR item_rec IN
            SELECT uadi.id as item_id
            FROM user_active_drive_items uadi
            WHERE uadi.drive_session_id = session_rec.session_id
            AND uadi.user_status != 'COMPLETED'
            ORDER BY uadi.order_in_drive ASC
            LIMIT 1
        LOOP
            -- Update the session with the first active item
            UPDATE drive_sessions
            SET current_user_active_drive_item_id = item_rec.item_id
            WHERE id = session_rec.session_id;
            
            RAISE NOTICE 'Updated session % for user % with current_user_active_drive_item_id %', 
                         session_rec.session_id, session_rec.user_id, item_rec.item_id;
        END LOOP;
    END LOOP;
    
    -- Migration for active sessions without items
    -- For any active sessions without user_active_drive_items:
    -- 1. Check if they have an active drive configuration
    -- 2. If so, create the necessary user_active_drive_items
    RAISE NOTICE 'Checking for active sessions without user_active_drive_items...';
    
    FOR session_rec IN 
        SELECT ds.id as session_id, ds.user_id, ds.drive_configuration_id
        FROM drive_sessions ds
        LEFT JOIN user_active_drive_items uadi ON uadi.drive_session_id = ds.id
        WHERE ds.status = 'active' 
        AND uadi.id IS NULL
        AND ds.drive_configuration_id IS NOT NULL
    LOOP
        RAISE NOTICE 'Session % for user % has no user_active_drive_items. Attempting to create them...',
                     session_rec.session_id, session_rec.user_id;
        
        -- Check if configuration has task sets with products
        FOR task_set_rec IN
            SELECT ts.id as task_set_id, tsp.product_id, ts.order_in_drive
            FROM drive_task_sets ts
            JOIN drive_task_set_products tsp ON ts.id = tsp.task_set_id
            WHERE ts.drive_configuration_id = session_rec.drive_configuration_id
            AND tsp.order_in_set = 1  -- Primary product
            ORDER BY ts.order_in_drive ASC
        LOOP
            -- Create user_active_drive_item
            INSERT INTO user_active_drive_items 
            (user_id, drive_session_id, product_id_1, order_in_drive, user_status, task_type, created_at, updated_at)
            VALUES 
            (session_rec.user_id, session_rec.session_id, task_set_rec.product_id, task_set_rec.order_in_drive, 
             CASE WHEN task_set_rec.order_in_drive = 1 THEN 'CURRENT' ELSE 'PENDING' END, 
             'order', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id INTO item_id;
            
            -- If this is the first item, update the session
            IF task_set_rec.order_in_drive = 1 THEN
                UPDATE drive_sessions
                SET current_user_active_drive_item_id = item_id
                WHERE id = session_rec.session_id;
                
                RAISE NOTICE 'Created first item % for session % and updated current_user_active_drive_item_id',
                             item_id, session_rec.session_id;
            ELSE
                RAISE NOTICE 'Created item % for session % at order %',
                             item_id, session_rec.session_id, task_set_rec.order_in_drive;
            END IF;
        END LOOP;
    END LOOP;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'An error occurred: %', SQLERRM;
END
$$;

-- Verification query
SELECT 
    ds.id AS session_id, 
    ds.user_id,
    ds.status,
    ds.current_user_active_drive_item_id,
    count(uadi.id) AS active_items_count
FROM 
    drive_sessions ds
LEFT JOIN 
    user_active_drive_items uadi ON ds.id = uadi.drive_session_id
WHERE 
    ds.status = 'active'
GROUP BY 
    ds.id, ds.user_id, ds.status, ds.current_user_active_drive_item_id
ORDER BY 
    ds.id;

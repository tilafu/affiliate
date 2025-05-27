-- SQL schema for user_active_drive_items table
-- This table stores the specific sequence of tasks (products/combos) for a user's active drive session.
-- It allows for admin customization of a drive instance for a particular user.

-- First, create the ENUM type if it doesn\'t exist, or use VARCHAR with CHECK constraint
-- For simplicity with ENUMs in this context, we will ensure the type exists.
-- CREATE TYPE user_drive_item_status AS ENUM ('PENDING', 'CURRENT', 'COMPLETED', 'SKIPPED', 'FAILED');
-- Or, using VARCHAR with a CHECK constraint:

CREATE TABLE user_active_drive_items (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    drive_session_id INT NOT NULL,
    
    product_id_1 INT NOT NULL,
    product_id_2 INT NULL,
    product_id_3 INT NULL,
    
    order_in_drive INT NOT NULL,
    
    user_status VARCHAR(10) DEFAULT 'PENDING' NOT NULL, -- Changed from ENUM
    
    task_type VARCHAR(50) DEFAULT 'order',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Removed ON UPDATE CURRENT_TIMESTAMP
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id_1) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id_2) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id_3) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (drive_session_id) REFERENCES drive_sessions(id) ON DELETE CASCADE,
    
    -- Constraints and Indexes
    CONSTRAINT chk_user_status CHECK (user_status IN ('PENDING', 'CURRENT', 'COMPLETED', 'SKIPPED', 'FAILED'))
    -- UNIQUE (user_id, drive_session_id, order_in_drive), -- Ensures unique step order within a user\'s drive session
);

-- Create indexes separately for PostgreSQL
CREATE INDEX idx_user_drive_session_order ON user_active_drive_items (user_id, drive_session_id, order_in_drive);
CREATE INDEX idx_drive_session_id ON user_active_drive_items (drive_session_id);

-- Comments on columns
COMMENT ON COLUMN user_active_drive_items.user_id IS 'ID of the user this drive item belongs to';
COMMENT ON COLUMN user_active_drive_items.drive_session_id IS 'FK to drive_sessions.id, identifying the user''s specific drive session.';
COMMENT ON COLUMN user_active_drive_items.product_id_1 IS 'Primary product for this drive step';
COMMENT ON COLUMN user_active_drive_items.product_id_2 IS 'Optional second product for a combo';
COMMENT ON COLUMN user_active_drive_items.product_id_3 IS 'Optional third product for a combo';
COMMENT ON COLUMN user_active_drive_items.order_in_drive IS 'The sequence number of this item in the user\'s active drive';
COMMENT ON COLUMN user_active_drive_items.user_status IS 'Status of this specific item for the user (e.g., PENDING, CURRENT, COMPLETED, SKIPPED, FAILED)';
COMMENT ON COLUMN user_active_drive_items.task_type IS 'Type of task, e.g., \'order\', \'survey\'';

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute the function before any update on the table
CREATE TRIGGER trigger_update_user_active_drive_items_updated_at
BEFORE UPDATE ON user_active_drive_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Notes:
-- 1. `drive_session_id` now links to `drive_sessions.id`.
-- 2. The `user_status` ENUM can be expanded if more states are needed.
-- 3. `ON DELETE CASCADE` for `user_id` means if a user is deleted, their active drive items are also deleted.
-- 4. `ON DELETE RESTRICT` for `product_id`s means a product cannot be deleted if it's part of an active drive item.
--    Consider `ON DELETE SET NULL` if products can be deleted and you want to preserve the drive item record.
-- 5. A `UNIQUE` constraint on `(user_id, drive_session_id, order_in_drive)` might be too restrictive if, for example,
--    a step can be re-attempted or re-inserted with the same order number after modification.
--    An index is generally sufficient for performance. If strict uniqueness is required, uncomment the UNIQUE constraint.

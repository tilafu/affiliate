-- New table for Drive Configurations (Templates)
CREATE TABLE drive_configurations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_admin_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table for items within a Drive Configuration
CREATE TABLE drive_configuration_items (
    id SERIAL PRIMARY KEY,
    drive_configuration_id INTEGER NOT NULL REFERENCES drive_configurations(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT, -- Ensure product exists
    order_in_drive INTEGER NOT NULL, -- To define the sequence of products
    -- quantity INTEGER DEFAULT 1, -- Uncomment if a product can appear multiple times or in specific quantities
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (drive_configuration_id, product_id, order_in_drive) -- Ensure a product is not in the same order position multiple times for the same drive config
);

-- Modify existing drive_sessions table
ALTER TABLE drive_sessions
ADD COLUMN drive_configuration_id INTEGER REFERENCES drive_configurations(id) ON DELETE SET NULL; -- Link to the new predefined drives, allow NULL if a session is not from a predefined drive

-- Optional: Add an index for faster lookups
CREATE INDEX idx_drive_sessions_drive_configuration_id ON drive_sessions(drive_configuration_id);
CREATE INDEX idx_drive_configuration_items_drive_configuration_id ON drive_configuration_items(drive_configuration_id);
CREATE INDEX idx_drive_configuration_items_product_id ON drive_configuration_items(product_id);

-- It might be beneficial to add a trigger to update 'updated_at' on drive_configurations table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_drive_configurations_updated_at
BEFORE UPDATE ON drive_configurations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

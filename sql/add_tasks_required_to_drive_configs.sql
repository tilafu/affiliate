-- Add tasks_required column to drive_configurations table
ALTER TABLE drive_configurations
ADD COLUMN IF NOT EXISTS tasks_required INTEGER;

-- Populate the tasks_required column with the count of items in each configuration
UPDATE drive_configurations dc
SET tasks_required = (
    SELECT COUNT(*) 
    FROM drive_configuration_items 
    WHERE drive_configuration_id = dc.id
);

-- Make the column NOT NULL after populating it
ALTER TABLE drive_configurations
ALTER COLUMN tasks_required SET NOT NULL;

-- Add constraint to ensure tasks_required is at least 1
ALTER TABLE drive_configurations
ADD CONSTRAINT tasks_required_positive CHECK (tasks_required > 0);

-- Create or replace a function to automatically update tasks_required when items change
CREATE OR REPLACE FUNCTION update_drive_configuration_tasks_required()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the tasks_required count in the drive_configurations table
    UPDATE drive_configurations
    SET tasks_required = (
        SELECT COUNT(*) 
        FROM drive_configuration_items 
        WHERE drive_configuration_id = 
            CASE
                WHEN TG_OP = 'DELETE' THEN OLD.drive_configuration_id
                ELSE NEW.drive_configuration_id
            END
    ),
    updated_at = NOW()
    WHERE id = 
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.drive_configuration_id
            ELSE NEW.drive_configuration_id
        END;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update the count when items are added/removed
DROP TRIGGER IF EXISTS trigger_update_tasks_required_insert_update ON drive_configuration_items;
CREATE TRIGGER trigger_update_tasks_required_insert_update
AFTER INSERT OR UPDATE ON drive_configuration_items
FOR EACH ROW EXECUTE FUNCTION update_drive_configuration_tasks_required();

DROP TRIGGER IF EXISTS trigger_update_tasks_required_delete ON drive_configuration_items;
CREATE TRIGGER trigger_update_tasks_required_delete
AFTER DELETE ON drive_configuration_items
FOR EACH ROW EXECUTE FUNCTION update_drive_configuration_tasks_required();

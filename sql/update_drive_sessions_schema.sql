-- File: c:\Users\user\Documents\affiliate-final\sql\update_drive_sessions_schema.sql

ALTER TABLE public.drive_sessions
ADD COLUMN current_user_active_drive_item_id INT NULL,
ADD CONSTRAINT fk_current_user_active_drive_item
    FOREIGN KEY (current_user_active_drive_item_id)
    REFERENCES public.user_active_drive_items(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN public.drive_sessions.current_user_active_drive_item_id IS 'FK to user_active_drive_items.id, indicating the current step in the active drive';

-- Re-evaluate existing columns in drive_sessions:
-- The columns 'last_product_id', 'last_combo_id', 'combo_progress', and 'drive_tasks' (jsonb)
-- might become redundant or need their logic adjusted now that user_active_drive_items
-- will manage the specific sequence and composition of drive steps, including combos.
-- For now, we are only adding the new column. Further analysis will be needed
-- to determine if these other columns should be deprecated or modified in how they are populated and used.
-- For example, 'tasks_completed' and 'tasks_required' might still refer to the overall progress
-- against the original Drive Configuration, while user_active_drive_items tracks the customized flow.

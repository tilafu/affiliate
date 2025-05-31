SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' -- Or your specific schema if not 'public'
  AND table_name   = 'drive_sessions'
  AND column_name  = 'current_user_active_drive_item_id';

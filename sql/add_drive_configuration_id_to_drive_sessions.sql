DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'drive_sessions'
        AND column_name = 'drive_configuration_id'
    ) THEN
        ALTER TABLE public.drive_sessions
        ADD COLUMN drive_configuration_id INTEGER REFERENCES public.drive_configurations(id) ON DELETE SET NULL;

        COMMENT ON COLUMN public.drive_sessions.drive_configuration_id IS 'Foreign key to the drive_configurations table, indicating which configuration this session is for.';
    ELSE
        RAISE NOTICE 'Column drive_configuration_id already exists in drive_sessions.';
    END IF;
END $$;

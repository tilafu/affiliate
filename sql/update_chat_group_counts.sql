-- SQL script to create a trigger to update member_count in chat_groups

-- Create a function to update the member count in chat_groups
CREATE OR REPLACE FUNCTION update_chat_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chat_groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE chat_groups SET member_count = member_count - 1 WHERE id = OLD.group_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update member count when members are added or deleted
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_group_member_count_trigger'
    ) THEN
        CREATE TRIGGER update_chat_group_member_count_trigger
        AFTER INSERT OR DELETE ON chat_group_members
        FOR EACH ROW
        EXECUTE FUNCTION update_chat_group_member_count();
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Skipping trigger creation: %', SQLERRM;
END $$;

-- SQL to recalculate the member count for all groups
DO $$
BEGIN
    -- Update member_count for all groups based on actual count in chat_group_members
    UPDATE chat_groups g
    SET member_count = (
        SELECT COUNT(*)
        FROM chat_group_members cgm
        WHERE cgm.group_id = g.id
    );

    -- Update message_count for all groups based on actual count in chat_messages
    UPDATE chat_groups g
    SET message_count = (
        SELECT COUNT(*)
        FROM chat_messages cm
        WHERE cm.group_id = g.id
    );

    -- Update last_activity for all groups based on most recent message
    UPDATE chat_groups g
    SET last_activity = (
        SELECT MAX(created_at)
        FROM chat_messages cm
        WHERE cm.group_id = g.id
    )
    WHERE EXISTS (
        SELECT 1
        FROM chat_messages cm
        WHERE cm.group_id = g.id
    );
END $$;

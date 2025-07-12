-- Chat System Setup - Clean Start with Data Reset
-- This will clear existing chat data and create fresh setup

-- Step 0: Clean existing chat data (in correct order to avoid foreign key violations)
DELETE FROM chat_scheduled_messages;
DELETE FROM chat_admin_logs;
DELETE FROM chat_messages;
DELETE FROM chat_group_members;
DELETE FROM chat_fake_users;
DELETE FROM chat_groups;

-- Reset sequences to start from 1
ALTER SEQUENCE chat_groups_id_seq RESTART WITH 1;
ALTER SEQUENCE chat_fake_users_id_seq RESTART WITH 1;
ALTER SEQUENCE chat_messages_id_seq RESTART WITH 1;
ALTER SEQUENCE chat_admin_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE chat_scheduled_messages_id_seq RESTART WITH 1;

-- Step 1: Insert chat groups first (required for foreign key relationships)
INSERT INTO chat_groups (name, description, group_type, is_active, created_by, created_at, updated_at) VALUES
('General Discussion', 'Main chat room for general conversations', 'standard', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Support Help', 'Customer support and help channel', 'support', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Announcements', 'Official announcements and updates', 'announcement', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('VIP Members', 'Exclusive chat for VIP tier members', 'vip', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Technical Discussion', 'Tech support and troubleshooting', 'technical', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 2: Insert fake users (required for chat_group_members and chat_messages)
INSERT INTO chat_fake_users (username, display_name, avatar_url, is_active, created_by, created_at, updated_at) VALUES
('assistant_sarah', 'Sarah (Assistant)', '/assets/avatars/sarah.png', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('helper_mike', 'Mike (Helper)', '/assets/avatars/mike.png', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('support_emma', 'Emma (Support)', '/assets/avatars/emma.png', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('admin_bot', 'Admin Bot', '/assets/avatars/bot.png', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('moderator_alex', 'Alex (Moderator)', '/assets/avatars/alex.png', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('guide_lisa', 'Lisa (Guide)', '/assets/avatars/lisa.png', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 3: Add fake users to groups (now both groups and fake users exist)
-- Add users to General Discussion (group_id: 1)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date) VALUES
(1, 1, 'fake_user', CURRENT_TIMESTAMP),
(1, 2, 'fake_user', CURRENT_TIMESTAMP),
(1, 4, 'fake_user', CURRENT_TIMESTAMP);

-- Add users to Support Help (group_id: 2)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date) VALUES
(2, 3, 'fake_user', CURRENT_TIMESTAMP),
(2, 4, 'fake_user', CURRENT_TIMESTAMP),
(2, 5, 'fake_user', CURRENT_TIMESTAMP);

-- Add users to Announcements (group_id: 3)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date) VALUES
(3, 4, 'fake_user', CURRENT_TIMESTAMP),
(3, 5, 'fake_user', CURRENT_TIMESTAMP);

-- Add users to VIP Members (group_id: 4)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date) VALUES
(4, 1, 'fake_user', CURRENT_TIMESTAMP),
(4, 6, 'fake_user', CURRENT_TIMESTAMP);

-- Add users to Technical Discussion (group_id: 5)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date) VALUES
(5, 2, 'fake_user', CURRENT_TIMESTAMP),
(5, 3, 'fake_user', CURRENT_TIMESTAMP),
(5, 5, 'fake_user', CURRENT_TIMESTAMP);

-- Step 4: Add some initial welcome messages (now groups and fake users exist)
INSERT INTO chat_messages (group_id, fake_user_id, message, sent_by_admin, admin_id, timestamp, created_at) VALUES
(1, 1, 'Welcome to the General Discussion! Feel free to chat about anything here.', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1, 2, 'Hi everyone! Great to see the chat is active. How is everyone doing today?', false, NULL, CURRENT_TIMESTAMP - INTERVAL '5 minutes', CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
(2, 3, 'Welcome to Support Help! I''m here to assist you with any questions or issues.', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 4, 'This is the official announcements channel. Stay tuned for important updates!', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 1, 'Welcome to the VIP lounge! Enjoy your exclusive access and premium support.', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 2, 'Technical Discussion is now open! Feel free to ask any technical questions here.', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Step 5: Add some admin log entries for chat management
INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, details, created_at) VALUES
(1, 'CREATE', 'chat_group', 1, '{"action": "Created chat group", "name": "General Discussion", "type": "standard"}', CURRENT_TIMESTAMP),
(1, 'CREATE', 'chat_group', 2, '{"action": "Created chat group", "name": "Support Help", "type": "support"}', CURRENT_TIMESTAMP),
(1, 'CREATE', 'chat_group', 3, '{"action": "Created chat group", "name": "Announcements", "type": "announcement"}', CURRENT_TIMESTAMP),
(1, 'CREATE', 'fake_user', 1, '{"action": "Created fake user", "username": "assistant_sarah", "display_name": "Sarah (Assistant)"}', CURRENT_TIMESTAMP),
(1, 'CREATE', 'fake_user', 2, '{"action": "Created fake user", "username": "helper_mike", "display_name": "Mike (Helper)"}', CURRENT_TIMESTAMP),
(1, 'CREATE', 'fake_user', 3, '{"action": "Created fake user", "username": "support_emma", "display_name": "Emma (Support)"}', CURRENT_TIMESTAMP);

-- Step 6: Add some scheduled messages for automated content
INSERT INTO chat_scheduled_messages (group_id, fake_user_id, message, media_type, scheduled_time, is_recurring, recurrence_pattern, is_sent, created_by, created_at, updated_at) VALUES
(1, 4, 'Daily reminder: Don''t forget to check your dashboard for new opportunities!', 'text', CURRENT_TIMESTAMP + INTERVAL '1 hour', true, 'daily', false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 3, 'Support tip: Use the help section in your dashboard if you need quick assistance.', 'text', CURRENT_TIMESTAMP + INTERVAL '2 hours', true, 'weekly', false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 4, 'Weekly update: Check our latest features and improvements!', 'text', CURRENT_TIMESTAMP + INTERVAL '1 day', true, 'weekly', false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Verify the setup by checking record counts
SELECT 'chat_groups' as table_name, COUNT(*) as record_count FROM chat_groups
UNION ALL
SELECT 'chat_fake_users', COUNT(*) FROM chat_fake_users
UNION ALL
SELECT 'chat_group_members', COUNT(*) FROM chat_group_members
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'chat_admin_logs', COUNT(*) FROM chat_admin_logs
UNION ALL
SELECT 'chat_scheduled_messages', COUNT(*) FROM chat_scheduled_messages
ORDER BY table_name;

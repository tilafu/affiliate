-- Add fake platform users to existing chat groups
-- This script assumes that:
-- 1. The chat_fake_users table already has the 20 platform users
-- 2. The chat_groups table already has the 5 standard groups

-- Add all users to the General Discussion group (group_id: 1)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date)
SELECT 1, id, 'fake_user', created_at + (random() * interval '5 days')
FROM chat_fake_users
WHERE id > 6; -- Skip the existing system users (1-6)

-- Add some users to Support Help group (group_id: 2)
-- We'll add users who might need support (around 50% of users)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date)
SELECT 2, id, 'fake_user', created_at + (random() * interval '10 days')
FROM chat_fake_users
WHERE id > 6 AND id % 2 = 0; -- Every other user

-- Add some users to Announcements group (group_id: 3)
-- All users should receive announcements
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date)
SELECT 3, id, 'fake_user', created_at + (random() * interval '3 days')
FROM chat_fake_users
WHERE id > 6;

-- Add some users to VIP Members group (group_id: 4)
-- Only about 25% of users should be VIP
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date)
SELECT 4, id, 'fake_user', created_at + (random() * interval '7 days')
FROM chat_fake_users
WHERE id > 6 AND id % 4 = 0; -- Every fourth user

-- Add some users to Technical Discussion group (group_id: 5)
-- Users who might be interested in technical discussions (around 40% of users)
INSERT INTO chat_group_members (group_id, fake_user_id, user_type, join_date)
SELECT 5, id, 'fake_user', created_at + (random() * interval '8 days')
FROM chat_fake_users
WHERE id > 6 AND (
    username LIKE '%tech%' OR 
    bio LIKE '%software%' OR 
    bio LIKE '%developer%' OR 
    bio LIKE '%digital%' OR
    bio LIKE '%crypto%' OR
    id % 3 = 0 -- Plus every third user
);

-- Add some initial messages from these users to make groups more lively
INSERT INTO chat_messages (group_id, fake_user_id, message, sent_by_admin, timestamp, created_at)
VALUES
-- General Discussion messages
(1, 7, 'Hi everyone! Just joined and wanted to say hello.', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(1, 9, 'Anyone here working in digital marketing? Would love to connect!', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(1, 12, 'Just published a new blog post on affiliate strategies. Check it out!', false, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),
(1, 15, 'How is everyone doing with the new dashboard updates?', false, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),

-- Support Help messages
(2, 8, 'I have a question about my payment settings. Can anyone help?', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(2, 14, 'Is there any way to customize the affiliate links further?', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(2, 10, 'Having trouble connecting my social media accounts. Any suggestions?', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

-- Announcements messages (primarily from system users, so no new ones needed)

-- VIP Members messages
(4, 8, 'Loving the VIP features! The advanced analytics are really helpful.', false, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
(4, 16, 'Just reached my first goal using the VIP strategies. Thanks team!', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

-- Technical Discussion messages
(5, 9, 'Has anyone integrated the API with Zapier? Looking for examples.', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
(5, 13, 'Just built a custom dashboard using the data export feature. Happy to share how.', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(5, 17, 'Any recommendations for tracking tools that work well with the platform?', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- Show counts to verify the data was inserted
SELECT 'chat_group_members' as table_name, COUNT(*) as record_count FROM chat_group_members
WHERE fake_user_id > 6;

SELECT 'chat_messages' as table_name, COUNT(*) as record_count FROM chat_messages
WHERE fake_user_id > 6;

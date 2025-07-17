-- Initialize chat system with default groups and fake users
-- Run this script to set up the basic chat infrastructure

-- 1. First, ensure the chat_fake_users table has data
INSERT INTO chat_fake_users (username, display_name, avatar_url, bio, is_active, created_by, created_at, updated_at)
VALUES 
('emily_jones92', 'Emily Jones', 'https://randomuser.me/api/portraits/women/23.jpg', 'Digital marketing specialist | Coffee lover | Dog mom', true, 1, NOW() - INTERVAL '45 days', NOW()),
('mark_wilson', 'Mark Wilson', 'https://randomuser.me/api/portraits/men/45.jpg', 'Entrepreneur and business coach. Love to connect with like-minded people!', true, 1, NOW() - INTERVAL '120 days', NOW()),
('alex_garcia87', 'Alex Garcia', 'https://randomuser.me/api/portraits/men/36.jpg', 'Travel blogger exploring the world one city at a time. Currently in: Tokyo', true, 1, NOW() - INTERVAL '67 days', NOW()),
('sophia_smith', 'Sophia Smith', 'https://randomuser.me/api/portraits/women/32.jpg', 'E-commerce store owner | Fashion enthusiast | Helping others succeed online', true, 1, NOW() - INTERVAL '89 days', NOW()),
('david_chen', 'David Chen', 'https://randomuser.me/api/portraits/men/22.jpg', 'Software engineer by day, gamer by night. Always looking for new opportunities.', true, 1, NOW() - INTERVAL '54 days', NOW()),
('olivia_m', 'Olivia Martinez', 'https://randomuser.me/api/portraits/women/57.jpg', 'Freelance graphic designer and illustrator. Lets collaborate!', true, 1, NOW() - INTERVAL '132 days', NOW()),
('jason_kim', 'Jason Kim', 'https://randomuser.me/api/portraits/men/19.jpg', 'Financial advisor | Investing tips | Building passive income streams', true, 1, NOW() - INTERVAL '72 days', NOW()),
('emma_w', 'Emma Wilson', 'https://randomuser.me/api/portraits/women/12.jpg', 'Content creator | YouTube: EmmaCreates | 50K followers and growing!', true, 1, NOW() - INTERVAL '36 days', NOW()),
('raj_patel', 'Raj Patel', 'https://randomuser.me/api/portraits/men/68.jpg', 'Restaurant owner exploring digital marketing. Food is my passion!', true, 1, NOW() - INTERVAL '103 days', NOW()),
('sarah_adams', 'Sarah Adams', 'https://randomuser.me/api/portraits/women/89.jpg', 'Health and wellness coach | Nutrition specialist | Marathon runner', true, 1, NOW() - INTERVAL '82 days', NOW()),
('mike_brown', 'Mike Brown', 'https://randomuser.me/api/portraits/men/41.jpg', 'Real estate investor | 12 properties and counting | DM for advice', true, 1, NOW() - INTERVAL '94 days', NOW()),
('jessica_taylor', 'Jessica Taylor', 'https://randomuser.me/api/portraits/women/29.jpg', 'Mom blogger | Homeschooling tips | Balancing work and family life', true, 1, NOW() - INTERVAL '65 days', NOW())
ON CONFLICT (username) DO NOTHING;

-- 2. Create default public groups that new users should automatically join
INSERT INTO chat_groups (name, description, is_public, is_personal_group, created_by, created_at)
VALUES 
('Support Team', 'Welcome to the chat! Get help and connect with our support team.', true, false, 1, NOW() - INTERVAL '30 days'),
('Marketing Group', 'Check out our new campaign ideas and marketing discussions.', true, false, 1, NOW() - INTERVAL '25 days'),
('General Discussion', 'Open forum for all community members to chat and share ideas.', true, false, 1, NOW() - INTERVAL '20 days'),
('Success Stories', 'Share your wins and celebrate achievements with the community.', true, false, 1, NOW() - INTERVAL '15 days')
ON CONFLICT (name) DO NOTHING;

-- 3. Add fake users to the public groups to make them feel active
DO $$
DECLARE
    group_record RECORD;
    fake_user_record RECORD;
    random_fake_users CURSOR FOR 
        SELECT id FROM chat_fake_users WHERE is_active = true ORDER BY RANDOM() LIMIT 8;
BEGIN
    -- For each public group
    FOR group_record IN 
        SELECT id FROM chat_groups WHERE is_public = true AND is_personal_group = false
    LOOP
        -- Add 5-8 random fake users to each group
        FOR fake_user_record IN random_fake_users
        LOOP
            INSERT INTO chat_group_members (group_id, fake_user_id, join_date, role)
            VALUES (group_record.id, fake_user_record.id, NOW() - INTERVAL '5 days', 'member')
            ON CONFLICT (group_id, fake_user_id) DO NOTHING;
        END LOOP;
        
        -- Reset cursor
        CLOSE random_fake_users;
        OPEN random_fake_users;
    END LOOP;
END $$;

-- 4. Add some sample messages to make the groups feel active
DO $$
DECLARE
    support_group_id INTEGER;
    marketing_group_id INTEGER;
    fake_user_ids INTEGER[];
BEGIN
    -- Get group IDs
    SELECT id INTO support_group_id FROM chat_groups WHERE name = 'Support Team' LIMIT 1;
    SELECT id INTO marketing_group_id FROM chat_groups WHERE name = 'Marketing Group' LIMIT 1;
    
    -- Get some fake user IDs
    SELECT ARRAY(SELECT id FROM chat_fake_users WHERE is_active = true ORDER BY RANDOM() LIMIT 5) INTO fake_user_ids;
    
    -- Add welcome message to Support Team
    IF support_group_id IS NOT NULL AND array_length(fake_user_ids, 1) > 0 THEN
        INSERT INTO chat_messages (group_id, user_id, user_type, content, message_type, created_at)
        VALUES (support_group_id, fake_user_ids[1], 'fake_user', 'Welcome to the chat!', 'text', NOW() - INTERVAL '2 hours');
    END IF;
    
    -- Add message to Marketing Group
    IF marketing_group_id IS NOT NULL AND array_length(fake_user_ids, 1) > 1 THEN
        INSERT INTO chat_messages (group_id, user_id, user_type, content, message_type, created_at)
        VALUES (marketing_group_id, fake_user_ids[2], 'fake_user', 'Check out our new campaign', 'text', NOW() - INTERVAL '1 day');
    END IF;
END $$;

-- 5. Update group member counts
UPDATE chat_groups SET 
    member_count = (
        SELECT COUNT(*) FROM chat_group_members 
        WHERE group_id = chat_groups.id
    ),
    message_count = (
        SELECT COUNT(*) FROM chat_messages 
        WHERE group_id = chat_groups.id AND is_active = true
    );

-- Show results
SELECT 'Setup complete!' as status;
SELECT 'Fake users created:' as info, COUNT(*) as count FROM chat_fake_users;
SELECT 'Public groups created:' as info, COUNT(*) as count FROM chat_groups WHERE is_public = true;
SELECT 'Total group memberships:' as info, COUNT(*) as count FROM chat_group_members;

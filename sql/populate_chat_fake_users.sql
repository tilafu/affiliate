-- SQL query to populate chat_fake_users table with test data of platform users
-- Based on the table structure with columns:
-- id, username, display_name, avatar_url, bio, is_active, created_by, created_at, updated_at

INSERT INTO chat_fake_users (username, display_name, avatar_url, bio, is_active, created_by, created_at, updated_at)
VALUES 
-- Regular platform users with various backgrounds and interests
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
('jessica_taylor', 'Jessica Taylor', 'https://randomuser.me/api/portraits/women/29.jpg', 'Mom blogger | Homeschooling tips | Balancing work and family life', true, 1, NOW() - INTERVAL '65 days', NOW()),
('chris_thompson', 'Chris Thompson', 'https://randomuser.me/api/portraits/men/53.jpg', 'Fitness trainer and nutritionist. Helping people transform their lives!', true, 1, NOW() - INTERVAL '28 days', NOW()),
('hannah_lee', 'Hannah Lee', 'https://randomuser.me/api/portraits/women/42.jpg', 'Aspiring author | Book lover | Currently working on my first novel', true, 1, NOW() - INTERVAL '117 days', NOW()),
('daniel_morgan', 'Daniel Morgan', 'https://randomuser.me/api/portraits/men/77.jpg', 'Photography enthusiast | Nature and wildlife | Available for bookings', true, 1, NOW() - INTERVAL '50 days', NOW()),
('lisa_nguyen', 'Lisa Nguyen', 'https://randomuser.me/api/portraits/women/62.jpg', 'Online teacher | Language tutor | Fluent in 4 languages', true, 1, NOW() - INTERVAL '73 days', NOW()),
('james_wilson', 'James Wilson', 'https://randomuser.me/api/portraits/men/55.jpg', 'Crypto investor since 2017 | Blockchain enthusiast | Technical analyst', true, 1, NOW() - INTERVAL '91 days', NOW()),
('tracy_wong', 'Tracy Wong', 'https://randomuser.me/api/portraits/women/72.jpg', 'Etsy shop owner | Handcrafted jewelry | Supporting small businesses', true, 1, NOW() - INTERVAL '38 days', NOW()),
('kevin_jackson', 'Kevin Jackson', 'https://randomuser.me/api/portraits/men/85.jpg', 'Podcast host | Digital marketing | Building my personal brand online', false, 1, NOW() - INTERVAL '143 days', NOW() - INTERVAL '40 days'),
('zoe_miller', 'Zoe Miller', 'https://randomuser.me/api/portraits/women/95.jpg', 'Interior designer | Home renovation tips | Before and after transformations', false, 1, NOW() - INTERVAL '156 days', NOW() - INTERVAL '30 days');

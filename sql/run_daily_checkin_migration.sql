-- Commands to run the daily check-in migration
-- Run these commands in your PostgreSQL database

-- First, connect to your affiliate database
-- psql -U your_username -d affiliate_database_name

-- Then run the migration file
\i C:/Users/user/Documents/affiliate-final/sql/create_daily_checkin_system.sql

-- Or if you prefer to run it directly:
-- cat C:/Users/user/Documents/affiliate-final/sql/create_daily_checkin_system.sql | psql -U your_username -d affiliate_database_name

-- Verify the tables were created successfully:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('daily_checkins', 'user_checkin_stats');

-- Test the functions work:
SELECT get_user_checkin_stats(1); -- Replace 1 with an actual user ID

-- Sample queries you can run to test:

-- 1. Check if a user has checked in today
SELECT EXISTS(
    SELECT 1 FROM daily_checkins 
    WHERE user_id = 1 AND checkin_date = CURRENT_DATE
) as has_checked_in_today;

-- 2. Get a user's check-in history for the current month
SELECT 
    checkin_date,
    bonus_points,
    streak_day
FROM daily_checkins 
WHERE user_id = 1 
AND EXTRACT(MONTH FROM checkin_date) = EXTRACT(MONTH FROM CURRENT_DATE)
AND EXTRACT(YEAR FROM checkin_date) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY checkin_date ASC;

-- 3. Get current leaderboard
SELECT 
    u.username,
    u.tier,
    ucs.current_streak,
    ucs.total_checkins,
    ucs.total_bonus_points
FROM user_checkin_stats ucs
JOIN users u ON u.id = ucs.user_id
WHERE ucs.current_streak > 0
ORDER BY ucs.current_streak DESC, ucs.total_checkins DESC
LIMIT 10;

-- 4. Perform a test check-in for user ID 1 (replace with actual user ID)
-- SELECT perform_daily_checkin(1);

-- Note: Remove the comment from the line above to actually test the check-in function

-- Daily Check-in System Migration
-- This migration creates the tables needed for persistent daily check-in tracking

-- Create daily_checkins table to track individual check-in events
CREATE TABLE IF NOT EXISTS daily_checkins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    checkin_timestamp TIMESTAMP DEFAULT NOW(),
    bonus_points INTEGER DEFAULT 5,
    streak_day INTEGER DEFAULT 1, -- What day of the streak this represents
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one check-in per user per day
    UNIQUE(user_id, checkin_date)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id ON daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON daily_checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date);

-- Create user_checkin_stats table to store aggregated statistics
CREATE TABLE IF NOT EXISTS user_checkin_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_checkins INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_bonus_points INTEGER DEFAULT 0,
    last_checkin_date DATE,
    streak_start_date DATE, -- When current streak started
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for user_checkin_stats
CREATE INDEX IF NOT EXISTS idx_user_checkin_stats_user_id ON user_checkin_stats(user_id);

-- Function to calculate streak for a user
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id INTEGER) 
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER) 
LANGUAGE plpgsql AS $$
DECLARE
    v_current_streak INTEGER := 0;
    v_longest_streak INTEGER := 0;
    v_temp_streak INTEGER := 0;
    v_prev_date DATE;
    v_current_date DATE;
    checkin_record RECORD;
BEGIN
    -- Get all check-ins for user in descending order
    FOR checkin_record IN 
        SELECT checkin_date 
        FROM daily_checkins 
        WHERE user_id = p_user_id 
        ORDER BY checkin_date DESC
    LOOP
        v_current_date := checkin_record.checkin_date;
        
        -- First iteration
        IF v_prev_date IS NULL THEN
            v_temp_streak := 1;
            v_prev_date := v_current_date;
            CONTINUE;
        END IF;
        
        -- Check if consecutive day
        IF v_prev_date - v_current_date = 1 THEN
            v_temp_streak := v_temp_streak + 1;
            v_prev_date := v_current_date;
        ELSE
            -- Break in streak found
            IF v_current_streak = 0 THEN
                v_current_streak := v_temp_streak;
            END IF;
            
            -- Update longest streak if current temp is longer
            IF v_temp_streak > v_longest_streak THEN
                v_longest_streak := v_temp_streak;
            END IF;
            
            -- Reset temp streak
            v_temp_streak := 1;
            v_prev_date := v_current_date;
        END IF;
    END LOOP;
    
    -- Handle final streak
    IF v_current_streak = 0 THEN
        v_current_streak := v_temp_streak;
    END IF;
    
    IF v_temp_streak > v_longest_streak THEN
        v_longest_streak := v_temp_streak;
    END IF;
    
    -- Check if current streak is still active (last check-in was today or yesterday)
    IF EXISTS (
        SELECT 1 FROM daily_checkins 
        WHERE user_id = p_user_id 
        AND checkin_date >= CURRENT_DATE - INTERVAL '1 day'
    ) THEN
        current_streak := v_current_streak;
    ELSE
        current_streak := 0; -- Streak broken
    END IF;
    
    longest_streak := v_longest_streak;
    
    RETURN NEXT;
END;
$$;

-- Function to perform daily check-in
CREATE OR REPLACE FUNCTION perform_daily_checkin(p_user_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql AS $$
DECLARE
    v_checkin_date DATE := CURRENT_DATE;
    v_existing_checkin BOOLEAN := FALSE;
    v_streak_info RECORD;
    v_bonus_points INTEGER := 5;
    v_streak_bonus INTEGER := 0;
    v_result JSON;
BEGIN
    -- Check if user already checked in today
    SELECT EXISTS(
        SELECT 1 FROM daily_checkins 
        WHERE user_id = p_user_id AND checkin_date = v_checkin_date
    ) INTO v_existing_checkin;
    
    IF v_existing_checkin THEN
        v_result := json_build_object(
            'success', false,
            'message', 'Already checked in today',
            'data', json_build_object()
        );
        RETURN v_result;
    END IF;
    
    -- Calculate current streak before adding today's check-in
    SELECT current_streak, longest_streak 
    INTO v_streak_info
    FROM calculate_user_streak(p_user_id);
    
    -- Calculate streak bonus (every 7 days)
    v_streak_bonus := FLOOR((v_streak_info.current_streak + 1) / 7) * 10;
    v_bonus_points := v_bonus_points + v_streak_bonus;
    
    -- Insert today's check-in
    INSERT INTO daily_checkins (user_id, checkin_date, bonus_points, streak_day)
    VALUES (p_user_id, v_checkin_date, v_bonus_points, v_streak_info.current_streak + 1);
    
    -- Update or insert user stats
    INSERT INTO user_checkin_stats (
        user_id, 
        total_checkins, 
        current_streak, 
        longest_streak, 
        total_bonus_points,
        last_checkin_date,
        streak_start_date,
        updated_at
    ) VALUES (
        p_user_id,
        1,
        v_streak_info.current_streak + 1,
        GREATEST(v_streak_info.longest_streak, v_streak_info.current_streak + 1),
        v_bonus_points,
        v_checkin_date,
        CASE 
            WHEN v_streak_info.current_streak = 0 THEN v_checkin_date
            ELSE (SELECT streak_start_date FROM user_checkin_stats WHERE user_id = p_user_id)
        END,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_checkins = user_checkin_stats.total_checkins + 1,
        current_streak = v_streak_info.current_streak + 1,
        longest_streak = GREATEST(user_checkin_stats.longest_streak, v_streak_info.current_streak + 1),
        total_bonus_points = user_checkin_stats.total_bonus_points + v_bonus_points,
        last_checkin_date = v_checkin_date,
        streak_start_date = CASE 
            WHEN v_streak_info.current_streak = 0 THEN v_checkin_date
            ELSE user_checkin_stats.streak_start_date
        END,
        updated_at = NOW();
    
    -- Return success with updated stats
    v_result := json_build_object(
        'success', true,
        'message', 'Check-in successful',
        'data', json_build_object(
            'points_earned', v_bonus_points,
            'current_streak', v_streak_info.current_streak + 1,
            'longest_streak', GREATEST(v_streak_info.longest_streak, v_streak_info.current_streak + 1),
            'total_checkins', COALESCE((SELECT total_checkins FROM user_checkin_stats WHERE user_id = p_user_id), 1)
        )
    );
    
    RETURN v_result;
END;
$$;

-- Function to get user check-in stats
CREATE OR REPLACE FUNCTION get_user_checkin_stats(p_user_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql AS $$
DECLARE
    v_stats RECORD;
    v_has_checked_in_today BOOLEAN := FALSE;
    v_result JSON;
    v_checkin_dates DATE[];
BEGIN
    -- Get user stats
    SELECT * INTO v_stats
    FROM user_checkin_stats 
    WHERE user_id = p_user_id;
    
    -- Check if checked in today
    SELECT EXISTS(
        SELECT 1 FROM daily_checkins 
        WHERE user_id = p_user_id AND checkin_date = CURRENT_DATE
    ) INTO v_has_checked_in_today;
    
    -- Get last 30 days of check-ins for calendar
    SELECT ARRAY_AGG(checkin_date ORDER BY checkin_date) INTO v_checkin_dates
    FROM daily_checkins 
    WHERE user_id = p_user_id 
    AND checkin_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Build result
    v_result := json_build_object(
        'success', true,
        'data', json_build_object(
            'total_checkins', COALESCE(v_stats.total_checkins, 0),
            'current_streak', COALESCE(v_stats.current_streak, 0),
            'longest_streak', COALESCE(v_stats.longest_streak, 0),
            'total_bonus_points', COALESCE(v_stats.total_bonus_points, 0),
            'last_checkin_date', v_stats.last_checkin_date,
            'has_checked_in_today', v_has_checked_in_today,
            'recent_checkin_dates', COALESCE(v_checkin_dates, '{}')
        )
    );
    
    RETURN v_result;
END;
$$;

-- Create some sample data for testing (optional)
-- You can remove this section if you don't want test data

-- Test user check-ins (only if users exist)
-- Uncomment to add sample check-ins for user ID 1 if it exists
/*
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = 1) THEN
        -- Add some historical check-ins for testing
        INSERT INTO daily_checkins (user_id, checkin_date, bonus_points, streak_day) VALUES
        (1, CURRENT_DATE - INTERVAL '6 days', 5, 1),
        (1, CURRENT_DATE - INTERVAL '5 days', 5, 2),
        (1, CURRENT_DATE - INTERVAL '4 days', 5, 3),
        (1, CURRENT_DATE - INTERVAL '3 days', 5, 4),
        (1, CURRENT_DATE - INTERVAL '2 days', 5, 5),
        (1, CURRENT_DATE - INTERVAL '1 day', 5, 6)
        ON CONFLICT (user_id, checkin_date) DO NOTHING;
        
        -- Update stats for the test user
        PERFORM perform_daily_checkin(1);
    END IF;
END $$;
*/

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON daily_checkins TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON user_checkin_stats TO your_app_user;
-- GRANT EXECUTE ON FUNCTION perform_daily_checkin(INTEGER) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_user_checkin_stats(INTEGER) TO your_app_user;

COMMENT ON TABLE daily_checkins IS 'Stores individual daily check-in records for users';
COMMENT ON TABLE user_checkin_stats IS 'Aggregated check-in statistics per user for quick access';
COMMENT ON FUNCTION perform_daily_checkin(INTEGER) IS 'Performs daily check-in for a user and updates statistics';
COMMENT ON FUNCTION get_user_checkin_stats(INTEGER) IS 'Retrieves comprehensive check-in statistics for a user';

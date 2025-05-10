/**
 * Service for tracking user drive progress and working days
 */
const pool = require('../config/db');
const logger = require('../logger');

/**
 * Update drive completion for a user for the current day
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Object containing update status and data
 */
const updateDriveCompletion = async (userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have an entry for today
    const checkResult = await client.query(
      'SELECT drives_completed, is_working_day FROM user_drive_progress WHERE user_id = $1 AND date = $2',
      [userId, today]
    );
    
    let driveProgressResult;
    
    if (checkResult.rows.length === 0) {
      // First drive of the day
      driveProgressResult = await client.query(
        'INSERT INTO user_drive_progress (user_id, date, drives_completed) VALUES ($1, $2, 1) RETURNING *',
        [userId, today]
      );
      logger.info(`First drive of the day recorded for user ${userId}`);
    } else {
      // Already has drives today, update the count
      const currentDrives = checkResult.rows[0].drives_completed;
      const isWorkingDay = checkResult.rows[0].is_working_day;
      const newDriveCount = currentDrives + 1;
      
      // Check if this completes the daily requirement (2 drives)
      const completesWorkingDay = newDriveCount >= 2 && !isWorkingDay;
      
      driveProgressResult = await client.query(
        'UPDATE user_drive_progress SET drives_completed = $1, is_working_day = $2, updated_at = NOW() WHERE user_id = $3 AND date = $4 RETURNING *',
        [newDriveCount, completesWorkingDay || isWorkingDay, userId, today]
      );
      
      // If this drive completes the daily requirement, update the working days count
      if (completesWorkingDay) {
        logger.info(`User ${userId} completed working day requirement`);
        
        // Check if user has a working days record
        const workingDaysCheck = await client.query(
          'SELECT id, weekly_progress, total_working_days FROM user_working_days WHERE user_id = $1',
          [userId]
        );
        
        if (workingDaysCheck.rows.length === 0) {
          // First working day for this user
          await client.query(
            'INSERT INTO user_working_days (user_id, weekly_progress, total_working_days, last_reset_date) VALUES ($1, 1, 1, $2)',
            [userId, today]
          );
        } else {
          // Increment existing working days count
          const { weekly_progress, total_working_days } = workingDaysCheck.rows[0];
          
          await client.query(
            'UPDATE user_working_days SET weekly_progress = $1, total_working_days = $2, updated_at = NOW() WHERE user_id = $3',
            [Math.min(weekly_progress + 1, 7), total_working_days + 1, userId]
          );
          
          // If weekly progress reaches 7, we could implement additional logic here if needed
        }
      }
    }
    
    // Get the current working days info
    const workingDaysInfo = await client.query(
      'SELECT weekly_progress, total_working_days FROM user_working_days WHERE user_id = $1',
      [userId]
    );
    
    const result = {
      driveProgress: driveProgressResult.rows[0],
      workingDays: workingDaysInfo.rows.length > 0 ? workingDaysInfo.rows[0] : { weekly_progress: 0, total_working_days: 0 }
    };
    
    await client.query('COMMIT');
    return result;
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error updating drive completion for user ${userId}: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get user's drive progress data
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Progress data
 */
const getUserDriveProgress = async (userId) => {
  const client = await pool.connect();
  
  try {
    // Get today's progress
    const today = new Date().toISOString().split('T')[0];
    const todayResult = await client.query(
      'SELECT drives_completed, is_working_day FROM user_drive_progress WHERE user_id = $1 AND date = $2',
      [userId, today]
    );
    
    // Get overall progress
    const overallResult = await client.query(
      'SELECT weekly_progress, total_working_days, last_reset_date FROM user_working_days WHERE user_id = $1',
      [userId]
    );
    
    // Format and return the results
    return {
      today: todayResult.rows.length > 0 ? todayResult.rows[0] : { drives_completed: 0, is_working_day: false },
      overall: overallResult.rows.length > 0 ? overallResult.rows[0] : { weekly_progress: 0, total_working_days: 0, last_reset_date: null }
    };
  } catch (error) {
    logger.error(`Error getting drive progress for user ${userId}: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reset weekly progress if needed (e.g., at the start of a new week)
 * Could be called by a scheduled job
 */
const checkAndResetWeeklyProgress = async (userId) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT last_reset_date FROM user_working_days WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return; // No record to reset
    }
    
    const lastResetDate = result.rows[0].last_reset_date;
    if (!lastResetDate) {
      // Never reset before, set it now
      await client.query(
        'UPDATE user_working_days SET last_reset_date = NOW() WHERE user_id = $1',
        [userId]
      );
      return;
    }
    
    // Check if a week has passed since the last reset
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
    
    if (daysSinceReset >= 7) {
      // Reset weekly progress
      await client.query(
        'UPDATE user_working_days SET weekly_progress = 0, last_reset_date = NOW() WHERE user_id = $1',
        [userId]
      );
      logger.info(`Weekly progress reset for user ${userId}`);
    }
  } catch (error) {
    logger.error(`Error checking/resetting weekly progress for user ${userId}: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  updateDriveCompletion,
  getUserDriveProgress,
  checkAndResetWeeklyProgress
};

const pool = require('../config/db');

// @desc    Get current user profile (including accounts and registration date)
// @route   GET /api/user/profile
// @access  Private
const getUserProfile = async (req, res) => {
  // req.user is attached by the 'protect' middleware
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  const userId = req.user.id;

  try {
    // Fetch full user details including registration date and mobile
    const userResult = await pool.query(
      'SELECT id, username, email, referral_code, tier, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Add total profits calculation
    const profitsResult = await pool.query(`
      SELECT SUM(commission_amount) as total_profits
      FROM commission_logs
      WHERE user_id = $1
    `, [userId]);
    
    const user = userResult.rows[0];
    user.total_profits = profitsResult.rows[0].total_profits || 0;
    
    res.json({ success: true, user });
    
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update user profile (currently only mobile number)
// @route   PUT /api/user/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  const userId = req.user.id;
  const { mobile_number } = req.body;

  // Basic validation
  if (!mobile_number) {
    return res.status(400).json({ success: false, message: 'Mobile number is required' });
  }
  // Add more robust validation if needed (e.g., regex for phone number format)

  try {
    const updateResult = await pool.query(
      'UPDATE users SET mobile_number = $1 WHERE id = $2 RETURNING id, username, email, created_at, tier, referral_code',
      [mobile_number, userId]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found or no update made' });
    }

    // Fetch accounts again to return the full updated profile
     const accountsResult = await pool.query(
      'SELECT type, balance, commission, frozen, cap, is_active FROM accounts WHERE user_id = $1',
      [userId]
    );
    const accounts = accountsResult.rows.reduce((acc, row) => {
      acc[row.type] = {
        balance: parseFloat(row.balance),
        commission: parseFloat(row.commission),
        frozen: parseFloat(row.frozen),
        cap: row.cap ? parseFloat(row.cap) : null,
        isActive: row.is_active,
      };
      return acc;
    }, {});

    const updatedUser = {
        ...updateResult.rows[0],
        accounts: accounts
    };


    res.status(200).json({ success: true, message: 'Profile updated successfully', user: updatedUser });

  } catch (error) {
    console.error('Update profile error:', error);
    // Check for specific DB errors if needed (e.g., unique constraint)
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

// Add this function to your existing user.js controller
/**
 * @desc    Get user account information
 * @route   GET /api/user/account
 * @access  Private
 */
const getAccountInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user account details including username and referral code
    const userResult = await pool.query(`
      SELECT 
        username, 
        referral_code
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get account balances
    const accountResult = await pool.query(`
      SELECT 
        COALESCE(main.balance, 0) as main_balance,
        COALESCE(main.frozen_balance, 0) as frozen_balance
      FROM users u
      LEFT JOIN accounts main ON u.id = main.user_id AND main.type = 'main'
      WHERE u.id = $1
    `, [userId]);

    // Calculate daily profits (last 24 hours)
    const dailyProfitsResult = await pool.query(`
      SELECT COALESCE(SUM(commission_amount), 0) as daily_profits
      FROM commission_logs
      WHERE user_id = $1 
      AND created_at >= NOW() - INTERVAL '24 HOURS'
    `, [userId]);

    // Combine all data
    res.json({
      success: true,
      account: {
        ...userResult.rows[0],
        ...accountResult.rows[0],
        daily_profits: dailyProfitsResult.rows[0].daily_profits
      }
    });
    
  } catch (error) {
    console.error('Error fetching account info:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Remember to export the new function
module.exports = {
  getUserProfile,
  updateUserProfile,
  getAccountInfo
};

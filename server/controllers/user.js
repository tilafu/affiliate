const pool = require('../config/db');

// @desc    Get current user profile (including accounts)
// @route   GET /api/user/profile
// @access  Private
const getUserProfile = async (req, res) => {
  // req.user is attached by the 'protect' middleware
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  const userId = req.user.id;

  try {
    // Fetch user details (already partially available in req.user)
    const user = req.user; // Contains id, username, email, referral_code, tier

    // Fetch associated account details
    const accountsResult = await pool.query(
      'SELECT type, balance, commission, frozen, cap, is_active FROM accounts WHERE user_id = $1',
      [userId]
    );

    // Structure the accounts data
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

    // Combine user and account data
    const userProfile = {
      ...user, // Spread basic user details
      accounts: accounts, // Add structured account details
    };

    res.status(200).json({ success: true, user: userProfile });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
};

module.exports = {
  getUserProfile,
};

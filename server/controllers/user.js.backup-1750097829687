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
      'SELECT id, username, email, referral_code, tier, mobile_number, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userResult.rows[0];

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
      ...user, // Spread full user details (id, username, email, referral_code, tier, mobile_number, created_at)
      accounts: accounts, // Add structured account details
    };

    res.status(200).json({ success: true, user: userProfile });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
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
      'UPDATE users SET mobile_number = $1 WHERE id = $2 RETURNING id, username, email, mobile_number, created_at, tier, referral_code',
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


module.exports = {
  getUserProfile,
  updateUserProfile, // Export the new function
};

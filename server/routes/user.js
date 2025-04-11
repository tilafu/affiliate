const express = require('express');
const { getUserProfile, updateUserProfile } = require('../controllers/user'); // Import updateUserProfile
const { protect } = require('../middlewares/auth'); // Import the auth middleware
const { getUserDeposits, getUserWithdrawals, getWithdrawableBalance, getWithdrawHistory, getUserBalances, getUserBalance } = require('../controllers/userController'); // Import getUserDeposits, getUserWithdrawals, getWithdrawableBalance, getWithdrawHistory, getUserBalances, and getUserBalance

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get current user profile data
// @access  Private (requires token)
router.get('/profile', protect, async (req, res) => {
  try {
    // The 'protect' middleware should attach the user object to req.user
    if (!req.user) {
      // This case might occur if 'protect' middleware fails unexpectedly
      console.error('User data not found on request object after protect middleware.');
      return res.status(401).json({ message: 'Unauthorized or user data missing' });
    }
    // Send the user data attached by the middleware
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('Error fetching profile in route handler:', error);
    res.status(500).json({ message: 'Could not fetch profile data' });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile data (e.g., mobile number)
// @access  Private (requires token)
router.put('/profile', protect, async (req, res) => {
  try {
    const { mobile_number } = req.body;
    // Make sure the field name matches what you're sending from the frontend
    
    // Update logic...
    
    res.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Could not update profile' });
  }
});

// @route   GET /api/user/deposits
// @desc    Get user's deposited amount
// @access  Private (requires token)
router.get('/deposits', protect, getUserDeposits);

// @route   GET /api/user/withdrawals
// @desc    Get user's withdrawn amount
// @access  Private (requires token)
router.get('/withdrawals', protect, getUserWithdrawals);

// @route   GET /api/user/withdrawable-balance
// @desc    Get user's withdrawable balance
// @access  Private (requires token)
router.get('/withdrawable-balance', protect, getWithdrawableBalance);

// @route   GET /api/user/withdraw-history
// @desc    Get user's withdraw history
// @access  Private (requires token)
router.get('/withdraw-history', protect, getWithdrawHistory);

// Unified route to get all balances for a user
router.get('/balances', protect, getUserBalances);

// Route to get user's balance
router.get('/balance', protect, getUserBalance);

module.exports = router;

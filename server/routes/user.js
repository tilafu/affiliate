const express = require('express');
const { getUserProfile } = require('../controllers/user');
const { protect } = require('../middlewares/auth'); // Import the auth middleware

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get current user profile data
// @access  Private (requires token)
router.get('/profile', protect, getUserProfile); // Apply protect middleware

module.exports = router;

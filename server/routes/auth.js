const express = require('express');
const { register, login, forgotPassword, logout, saveOnboardingResponses } = require('../controllers/auth');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', login);

// @route   POST /api/auth/onboarding
// @desc    Save onboarding responses
// @access  Public
router.post('/onboarding', saveOnboardingResponses);

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate token if needed)
// @access  Private
router.post('/logout', protect, logout);

module.exports = router;

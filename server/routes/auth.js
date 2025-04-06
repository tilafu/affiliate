const express = require('express');
const { register, login, adminLogin } = require('../controllers/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', login);

// Now you can uncomment this line after implementing the function
router.post('/admin-login', adminLogin);

module.exports = router;

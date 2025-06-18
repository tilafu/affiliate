const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect, admin } = require('../middlewares/auth');

// Apply authentication middleware to all routes
router.use(protect, admin);

// Get dashboard statistics
router.get('/dashboard-stats', dashboardController.getDashboardStats);

module.exports = router; 
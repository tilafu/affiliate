// Tier Management Routes
// Routes for admin tier configuration management

const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/auth');
const tierManagementController = require('../controllers/tierManagementController');

// All routes require admin authentication
router.use(protect, admin);

// @route   GET /api/admin/tier-management/configurations
// @desc    Get all tier configurations
// @access  Admin only
router.get('/configurations', tierManagementController.getTierConfigurations);

// @route   POST /api/admin/tier-management/configurations
// @desc    Create new tier configuration
// @access  Admin only
router.post('/configurations', tierManagementController.createTierConfiguration);

// @route   PUT /api/admin/tier-management/configurations/:id
// @desc    Update tier configuration
// @access  Admin only
router.put('/configurations/:id', tierManagementController.updateTierConfiguration);

// @route   DELETE /api/admin/tier-management/configurations/:id
// @desc    Delete tier configuration
// @access  Admin only
router.delete('/configurations/:id', tierManagementController.deleteTierConfiguration);

// @route   GET /api/admin/tier-management/statistics
// @desc    Get tier usage statistics
// @access  Admin only
router.get('/statistics', tierManagementController.getTierStatistics);

module.exports = router;

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, admin } = require('../middlewares/auth');

// Apply authentication middleware to all routes
router.use(protect, admin);

// Get all notification categories
router.get('/notification-categories', notificationController.getNotificationCategories);

// Create a new notification category
router.post('/notification-categories', notificationController.createNotificationCategory);

// Update a notification category
router.put('/notification-categories/:id', notificationController.updateNotificationCategory);

// Delete a notification category
router.delete('/notification-categories/:id', notificationController.deleteNotificationCategory);

module.exports = router; 
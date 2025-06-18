const express = require('express');
const router = express.Router();
const adminDriveController = require('../controllers/adminDriveController');
const { protect, admin } = require('../middlewares/auth');

// Apply authentication middleware to all routes
router.use(protect, admin);

// Basic routes that we know exist in the controller
router.get('/drives', adminDriveController.getAllDrives);
router.get('/drives/:driveId', adminDriveController.getDriveDetails);
router.put('/drives/:driveId/status', adminDriveController.updateDriveStatus);
router.post('/drives/:driveId/tasks', adminDriveController.addTaskToDrive);
router.put('/drives/:driveId/tasks/:taskId/status', adminDriveController.updateTaskStatus);

module.exports = router;

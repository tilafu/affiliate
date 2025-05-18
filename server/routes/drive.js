const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth'); // Assuming auth middleware exists
const {
  startDrive,
  getOrder,
  saveOrder,
  saveComboOrder,
  getDriveOrders,
  saveComboProduct, // Added based on task.html logic
  getDriveStatus, // Added new function
  getDriveProgress, // Added for tracking progress
  getActiveDriveSessionDetails // Added for fetching active session details
} = require('../controllers/driveController'); // Controller to be created

// Route to start a new drive session (mimics task/suborder)
router.post('/start', protect, startDrive);

// Route to get the current drive status and potentially the next order
router.get('/status', protect, getDriveStatus); // New route

// Route to get user's drive progress (for dashboard)
router.get('/progress', protect, getDriveProgress);

// Route to get the next order/product details (mimics task/getorder)
router.post('/getorder', protect, getOrder); // Changed to POST based on task.html usage

// Route to save a completed single order (mimics task/saveorder)
router.post('/saveorder', protect, saveOrder);

// Route to save a completed combo order (mimics task/savecomboorder)
router.post('/savecomboorder', protect, saveComboOrder);

// Route to save individual products within a combo (mimics task/savecomboproduct)
router.post('/savecomboproduct', protect, saveComboProduct);

// Route to get drive orders with filtering
router.post('/orders', protect, getDriveOrders);

// New route to get details of the current active drive session
router.get('/active-session-details', protect, getActiveDriveSessionDetails);


module.exports = router;

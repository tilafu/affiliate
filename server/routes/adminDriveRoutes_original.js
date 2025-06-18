const express = require('express');
const router = express.Router();
const adminDriveController = require('../controllers/adminDriveController');
const { protect, admin } = require('../middlewares/auth');

// Apply authentication middleware to all routes
router.use(protect, admin);

// Drive Configuration Routes
router.post('/configurations', adminDriveController.createDriveConfiguration);
router.get('/configurations', adminDriveController.getDriveConfigurations);
router.get('/configurations/:id', adminDriveController.getDriveConfigurationById);
router.put('/configurations/:id', adminDriveController.updateDriveConfiguration);
router.delete('/configurations/:id', adminDriveController.deleteDriveConfiguration);

// Get products for a configuration
router.get('/configurations/:configId/products', adminDriveController.getProductsForConfiguration);

// Drive Task Set Routes
router.post('/tasksets', adminDriveController.createDriveTaskSet);
router.get('/configurations/:configurationId/tasksets', adminDriveController.getTaskSetsForConfiguration);
router.get('/tasksets/:id', adminDriveController.getDriveTaskSetById);
router.put('/tasksets/:id', adminDriveController.updateDriveTaskSet);
router.delete('/tasksets/:id', adminDriveController.deleteDriveTaskSet);

// Drive Task Set Product Routes
router.post('/taskset-products', adminDriveController.addProductToTaskSet);
router.get('/tasksets/:taskSetId/products', adminDriveController.getProductsForTaskSet);
router.get('/taskset-products/:id', adminDriveController.getDriveTaskSetProductById);
router.put('/taskset-products/:id', adminDriveController.updateProductInTaskSet);
router.delete('/taskset-products/:id', adminDriveController.removeProductFromTaskSet);

// User Drive Assignment
router.post('/users/:userId/drive/assign', adminDriveController.assignDriveToUser);

// Route for admin to directly assign/update a user's drive configuration (e.g. for override)
router.put('/users/:userId/assign-drive-config', adminDriveController.assignDriveConfigurationToUser);

// New route for tier-based auto-assignment of drive configuration
router.post('/users/:userId/assign-tier-based-drive', adminDriveController.assignTierBasedDriveToUser);

// User Active Drive Item Routes
router.get('/users/:userId/drive/active-items', adminDriveController.getActiveDriveItemsForUser);

// New route for user drive progress
router.get('/users/:userId/drive-progress', adminDriveController.getUserDriveProgress);

// Balance-based Drive Configuration Routes
router.post('/balance-config/create', adminDriveController.createBalanceBasedConfiguration);
router.get('/balance-config/products/:userId', adminDriveController.getBalanceBasedProducts);
router.post('/balance-config/validate', adminDriveController.validateBalanceConfig);

// Admin Combo Creation Routes
router.post('/combos/insert', adminDriveController.insertComboToTaskSet);
router.post('/combos/create-task-set', adminDriveController.createComboTaskSet);
router.post('/combos/add-after-task', adminDriveController.addComboTaskSetAfterTask);
router.get('/tasksets/:taskSetId/available-slots', adminDriveController.getAvailableComboSlots);
router.put('/active-items/:itemId/add-combo', adminDriveController.addComboToActiveItem);

// Enhanced Combo Creation Route - for creating combos directly in user's drive sequence
router.post('/users/:userId/drive/add-combo', adminDriveController.addComboToUserDrive);

// Tier Quantity Configuration Routes
router.get('/tier-configs', adminDriveController.getTierQuantityConfigs);
router.put('/tier-configs', adminDriveController.updateTierQuantityConfigs);

// Get all drives
router.get('/drives', adminDriveController.getAllDrives);

// Get drive details
router.get('/drives/:driveId', adminDriveController.getDriveDetails);

// Update drive status
router.put('/drives/:driveId/status', adminDriveController.updateDriveStatus);

// Add task to drive
router.post('/drives/:driveId/tasks', adminDriveController.addTaskToDrive);

// Update task status
router.put('/drives/:driveId/tasks/:taskId/status', adminDriveController.updateTaskStatus);

module.exports = router;

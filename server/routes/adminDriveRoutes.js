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

// User Drive Assignment Routes
router.post('/users/:userId/drive/assign', adminDriveController.assignDriveToUser);
router.put('/users/:userId/assign-drive-config', adminDriveController.assignDriveConfigurationToUser);
router.post('/users/:userId/assign-tier-based-drive', adminDriveController.assignTierBasedDriveToUser);

// User Active Drive Item Routes
router.get('/users/:userId/drive/active-items', adminDriveController.getActiveDriveItemsForUser);

// User drive progress route (this was missing and causing 404 errors)
router.get('/users/:userId/drive-progress', adminDriveController.getUserDriveProgress);

// Combo Task Set Route (this was missing and causing 404 errors)
router.post('/combo-task-set', adminDriveController.createComboTaskSet);

// Add combo after task route (this was missing and causing 404 errors)
router.post('/combos/add-after-task', adminDriveController.addComboTaskSetAfterTask);

// Drive Management Routes
router.get('/drives', adminDriveController.getAllDrives);
router.get('/drives/:driveId', adminDriveController.getDriveDetails);
router.put('/drives/:driveId/status', adminDriveController.updateDriveStatus);
router.post('/drives/:driveId/tasks', adminDriveController.addTaskToDrive);
router.put('/drives/:driveId/tasks/:taskId/status', adminDriveController.updateTaskStatus);

module.exports = router;

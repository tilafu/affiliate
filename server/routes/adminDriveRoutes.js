const express = require('express');
const router = express.Router();
const adminDriveController = require('../controllers/adminDriveController');
const authMiddleware = require('../middlewares/auth'); // Corrected path

// Drive Configuration Routes
router.post('/configurations', authMiddleware.protect, authMiddleware.admin, adminDriveController.createDriveConfiguration);
router.get('/configurations', authMiddleware.protect, authMiddleware.admin, adminDriveController.getDriveConfigurations);
router.get('/configurations/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.getDriveConfigurationById);
router.put('/configurations/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.updateDriveConfiguration);
router.delete('/configurations/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.deleteDriveConfiguration);

// Get products for a configuration
router.get('/configurations/:configId/products', authMiddleware.protect, authMiddleware.admin, adminDriveController.getProductsForConfiguration);

// Drive Task Set Routes
router.post('/tasksets', authMiddleware.protect, authMiddleware.admin, adminDriveController.createDriveTaskSet);
router.get('/configurations/:configurationId/tasksets', authMiddleware.protect, authMiddleware.admin, adminDriveController.getTaskSetsForConfiguration);
router.get('/tasksets/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.getDriveTaskSetById);
router.put('/tasksets/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.updateDriveTaskSet);
router.delete('/tasksets/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.deleteDriveTaskSet);

// Drive Task Set Product Routes
router.post('/taskset-products', authMiddleware.protect, authMiddleware.admin, adminDriveController.addProductToTaskSet);
router.get('/tasksets/:taskSetId/products', authMiddleware.protect, authMiddleware.admin, adminDriveController.getProductsForTaskSet);
router.get('/taskset-products/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.getDriveTaskSetProductById);
router.put('/taskset-products/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.updateProductInTaskSet);
router.delete('/taskset-products/:id', authMiddleware.protect, authMiddleware.admin, adminDriveController.removeProductFromTaskSet);

// User Drive Assignment
router.post('/users/:userId/drive/assign', authMiddleware.protect, authMiddleware.admin, adminDriveController.assignDriveToUser);

// Route for admin to directly assign/update a user's drive configuration (e.g. for override)
router.put('/users/:userId/assign-drive-config', authMiddleware.protect, authMiddleware.admin, adminDriveController.assignDriveConfigurationToUser);

// User Active Drive Item Routes
router.get('/users/:userId/drive/active-items', authMiddleware.protect, authMiddleware.admin, adminDriveController.getActiveDriveItemsForUser);
router.post('/users/:userId/drive/active-items/:driveItemId/add-combo', authMiddleware.protect, authMiddleware.admin, adminDriveController.addProductToDriveItemCombo);

// New route for user drive progress
router.get('/users/:userId/drive-progress', authMiddleware.protect, authMiddleware.admin, adminDriveController.getUserDriveProgress);

module.exports = router;

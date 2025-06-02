const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');

// Dashboard
router.get('/stats', protect, admin, adminController.getDashboardStats);

// User Management
router.get('/users', protect, admin, adminController.getUsers);
router.put('/users/:userId/tier', protect, admin, adminController.updateUserTier);
router.post('/users/:userId/transactions', protect, admin, adminController.manualTransaction);

// Product Management
router.get('/products', protect, admin, adminController.getProducts);
router.get('/products/:productId', protect, admin, adminController.getProductById); // Added route to get single product
router.post('/products', protect, admin, adminController.createProduct);
router.put('/products/:productId', protect, admin, adminController.updateProduct);
router.delete('/products/:productId', protect, admin, adminController.deleteProduct);

// Deposit Management
router.get('/deposits', protect, admin, adminController.getDeposits);
router.post('/deposits/:id/approve', protect, admin, adminController.approveDeposit);
router.post('/deposits/:id/reject', protect, admin, adminController.rejectDeposit);

// Withdrawal Management
router.get('/withdrawals', protect, admin, adminController.getWithdrawals);
router.post('/withdrawals/:id/approve', protect, admin, adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', protect, admin, adminController.rejectWithdrawal);

// Drive Management
router.get('/drives', protect, admin, adminController.getDrives);
router.get('/drives/:userId/logs', protect, admin, adminController.getDriveLogs);
router.post('/users/:userId/reset-drive', protect, admin, adminController.resetDrive);
router.post('/drives/:driveId/end', protect, admin, adminController.endDrive);

// Support Management
router.get('/support/messages', protect, admin, adminController.getAllSupportMessages);
router.post('/support/messages/reply', protect, admin, adminController.replyToSupportMessage);

// Notifications
router.post('/notifications', protect, admin, adminController.sendNotification);

// Membership Tiers Management
router.get('/membership-tiers', protect, admin, adminController.getMembershipTiers);
router.post('/membership-tiers', protect, admin, adminController.createMembershipTier);
router.put('/membership-tiers/:id', protect, admin, adminController.updateMembershipTier);
router.delete('/membership-tiers/:id', protect, admin, adminController.deleteMembershipTier);

// Tier Quantity Configuration Management
router.get('/tier-quantity-configs', protect, admin, adminController.getTierQuantityConfigs);
router.put('/tier-quantity-configs/:id', protect, admin, adminController.updateTierQuantityConfig);

module.exports = router;

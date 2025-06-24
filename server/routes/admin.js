const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');
const multer = require('multer');
const path = require('path');

// Configure multer for QR code uploads
const qrCodeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/assets/uploads/qr-codes/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'qr-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadQRCodeImage = multer({
  storage: qrCodeStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for QR codes
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG) are allowed'));
    }
  }
});

const { uploadQRCode } = require('../controllers/userController');

// Dashboard
router.get('/stats', protect, admin, adminController.getDashboardStats);

// User Management
router.get('/users', protect, admin, adminController.getUsers);
router.get('/users/frozen', protect, admin, adminController.getFrozenUsers);
router.put('/users/:userId/tier', protect, admin, adminController.updateUserTier);
router.post('/users/:userId/transactions', protect, admin, adminController.manualTransaction);
router.post('/users/:userId/unfreeze', protect, admin, adminController.unfreezeUser);

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

// Enhanced Notification System
// Notification Categories are handled by notificationRoutes.js

// General Notifications
router.get('/general-notifications', protect, admin, adminController.getGeneralNotifications);
router.post('/general-notifications', protect, admin, adminController.createGeneralNotification);
router.put('/general-notifications/:id', protect, admin, adminController.updateGeneralNotification);
router.delete('/general-notifications/:id', protect, admin, adminController.deleteGeneralNotification);

// Categorized Notifications
router.post('/notifications/categorized', protect, admin, adminController.sendCategorizedNotification);
router.post('/notifications/bulk', protect, admin, adminController.sendBulkNotifications);

// Membership Tiers Management
router.get('/membership-tiers', protect, admin, adminController.getMembershipTiers);
router.post('/membership-tiers', protect, admin, adminController.createMembershipTier);
router.put('/membership-tiers/:id', protect, admin, adminController.updateMembershipTier);
router.delete('/membership-tiers/:id', protect, admin, adminController.deleteMembershipTier);

// Tier Quantity Configuration Management
router.get('/tier-quantity-configs', protect, admin, adminController.getTierQuantityConfigs);
router.put('/tier-quantity-configs/:id', protect, admin, adminController.updateTierQuantityConfig);

// Onboarding Responses
router.get('/onboarding-responses', protect, admin, adminController.getOnboardingResponses);

// QR Code Management for Deposits
router.post('/qr-code/upload', protect, admin, uploadQRCodeImage.single('qrcode'), uploadQRCode);
router.get('/qr-codes', protect, admin, adminController.getQRCodes);
router.post('/qr-code/:id/activate', protect, admin, adminController.activateQRCode);
router.delete('/qr-code/:id', protect, admin, adminController.deleteQRCode);

module.exports = router;

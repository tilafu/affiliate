const express = require('express');
const pool = require('../config/db'); // Import database connection
// Import updateUserProfile from correct controller if it exists, otherwise remove
// const { getUserProfile, updateUserProfile } = require('../controllers/user'); 
const { protect } = require('../middlewares/auth'); // Import the auth middleware
const {
    getUserDeposits,
    getUserWithdrawals,
    getUserTotalDeposits, // Import new function
    getWithdrawableBalance,
    getWithdrawHistory,
    getUserBalances,
    getUserBalance,
    changeLoginPassword,
    changeWithdrawPassword,
    getWithdrawalAddress,
    updateWithdrawalAddress,
    createSupportMessage,    // Import new function
    getUserSupportMessages, // Import new function
    getUserNotifications, // Import new function
    markNotificationAsRead, // Import new function
    requestDeposit, // Import new function
    requestWithdrawal, // Import new function
    getDriveProgress, // Import new function
    getActiveProducts, // Import new function
    createCombo, // Import new function
    getHighValueProducts, // Import new function
    getActiveQRCode, // Import QR code function
    uploadQRCode, // Import QR code upload function
    createDepositWithImage, // Import deposit with image function
    processBankDepositSimple, // Import bank deposit function
    processBankDepositWithFile // Import bank deposit with file function
} = require('../controllers/userController');

const router = express.Router();

// --- Deposit & Withdrawal Requests ---
// @route   POST /api/user/deposit/request
// @desc    Submit a new deposit request
// @access  Private
router.post('/deposit/request', protect, requestDeposit);

// @route   POST /api/user/withdraw/request
// @desc    Submit a new withdrawal request
// @access  Private
router.post('/withdraw/request', protect, requestWithdrawal);

// --- End Deposit & Withdrawal Requests ---

// @route   GET /api/user/profile
// @desc    Get current user profile data
// @access  Private (requires token)
router.get('/profile', protect, async (req, res) => {
  try {
    // The 'protect' middleware should attach the user object to req.user
    if (!req.user) {
      // This case might occur if 'protect' middleware fails unexpectedly
      console.error('User data not found on request object after protect middleware.');
      return res.status(401).json({ message: 'Unauthorized or user data missing' });
    }
    // Send the user data attached by the middleware
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('Error fetching profile in route handler:', error);
    res.status(500).json({ message: 'Could not fetch profile data' });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile data (e.g., mobile number)
// @access  Private (requires token)
router.put('/profile', protect, async (req, res) => {
  try {
    const { mobile_number } = req.body;
    // Make sure the field name matches what you're sending from the frontend
    
    // Update logic...
    
    res.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Could not update profile' });
  }
});

// @route   GET /api/user/deposits
// @desc    Get user's deposited amount
// @access  Private (requires token)
router.get('/deposits', protect, getUserDeposits);

// @route   GET /api/user/deposits/total
// @desc    Get user's total deposited amount from accounts.deposit field
// @access  Private (requires token)
router.get('/deposits/total', protect, getUserTotalDeposits);

// @route   POST /api/user/deposits/bank-simple
// @desc    Process simple bank deposit
// @access  Private (requires token)
router.post('/deposits/bank-simple', protect, processBankDepositSimple);

// @route   GET /api/user/withdrawals
// @desc    Get user's withdrawn amount
// @access  Private (requires token)
router.get('/withdrawals', protect, getUserWithdrawals);

// @route   GET /api/user/withdrawable-balance
// @desc    Get user's withdrawable balance
// @access  Private (requires token)
router.get('/withdrawable-balance', protect, getWithdrawableBalance);

// @route   GET /api/user/withdraw-history
// @desc    Get user's withdraw history
// @access  Private (requires token)
router.get('/withdraw-history', protect, getWithdrawHistory);

// Unified route to get all balances for a user
router.get('/balances', protect, getUserBalances);

// Route to get user's balance
router.get('/balance', protect, getUserBalance);

// @route   PUT /api/user/password/login
// @desc    Change user's login password
// @access  Private
router.put('/password/login', protect, changeLoginPassword);

// @route   PUT /api/user/password/withdraw
// @desc    Change user's withdrawal password
// @access  Private
router.put('/password/withdraw', protect, changeWithdrawPassword);

// @route   GET /api/user/withdrawal-address
// @desc    Get user's withdrawal address
// @access  Private
router.get('/withdrawal-address', protect, getWithdrawalAddress);

// @route   PUT /api/user/withdrawal-address
// @desc    Update user's withdrawal address
// @access  Private
router.put('/withdrawal-address', protect, updateWithdrawalAddress);

// --- Support Messages ---
// @route   POST /api/user/support/messages
// @desc    Create a new support message
// @access  Private
router.post('/support/messages', protect, createSupportMessage);

// @route   GET /api/user/support/messages
// @desc    Get messages sent by the user
// @access  Private
router.get('/support/messages', protect, getUserSupportMessages);

// --- Notifications ---
// @route   GET /api/user/notifications
// @desc    Get notifications for the logged-in user
// @access  Private
router.get('/notifications', protect, getUserNotifications);

// @route   PUT /api/user/notifications/:id/read
// @desc    Mark a specific notification as read
// @access  Private
router.put('/notifications/:id/read', protect, markNotificationAsRead); // Added this line

// --- Drive Progress and Combo Creation ---
// @route   GET /api/user/drive-progress
// @desc    Get current user's drive progress
// @access  Private
router.get('/drive-progress', protect, getDriveProgress);

// @route   GET /api/user/products/active
// @desc    Get active products available for combo creation
// @access  Private
router.get('/products/active', protect, getActiveProducts);

// @route   GET /api/user/products/highvalue
// @desc    Get high-value products for dashboard carousel (price > 5000)
// @access  Private
router.get('/products/highvalue', protect, getHighValueProducts);

// @route   POST /api/user/combo/create
// @desc    Create a combo for current user
// @access  Private
router.post('/combo/create', protect, createCombo);

// --- QR Code and Deposit Image Routes ---

// @route   GET /api/deposits/qr-code
// @desc    Get active QR code for deposits page
// @access  Public (no authentication required)
router.get('/deposits/qr-code', getActiveQRCode);
router.get('/qr-code', getActiveQRCode); // Alternative route for admin panel

// @route   POST /api/user/deposit-with-image
// @desc    Create deposit request with client image
// @access  Private
const multer = require('multer');
const path = require('path');

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/assets/uploads/avatars/'));
  },
  filename: (req, file, cb) => {
    // Generate a unique filename without relying on req.user.id (which isn't available yet)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Configure multer for deposit images
const depositImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/assets/uploads/deposit-images/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'deposit-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadDepositImage = multer({
  storage: depositImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF) and PDF files are allowed'));
    }
  }
});

router.post('/deposit-with-image', protect, uploadDepositImage.single('image'), createDepositWithImage);

// @route   POST /api/user/deposits/bank-with-file
// @desc    Process bank deposit with file attachment
// @access  Private
router.post('/deposits/bank-with-file', protect, uploadDepositImage.single('receipt'), processBankDepositWithFile);

// @route   POST /api/user/upload-avatar
// @desc    Upload user avatar
// @access  Private
router.post('/upload-avatar', protect, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const avatarUrl = `/assets/uploads/avatars/${req.file.filename}`;
    
    // Update both avatar_url and profile_image fields for compatibility
    const query = 'UPDATE users SET avatar_url = $1, profile_image = $1 WHERE id = $2';
    const result = await pool.query(query, [avatarUrl, req.user.id]);

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during avatar upload' 
    });
  }
});

// --- End QR Code and Deposit Image Routes ---

module.exports = router;

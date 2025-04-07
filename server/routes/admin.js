const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

// Apply admin middleware to all routes in this file except login
router.use((req, res, next) => {
  if (req.path === '/auth/admin-login') {
    return next();
  }
  adminMiddleware(req, res, next);
});

// @route   POST /api/auth/admin-login
// @desc    Admin login route (DISABLED)
// @access  Public
// router.post('/auth/admin-login', adminController.adminLogin); 
// @route   GET /api/admin/dashboard
// @desc    Admin dashboard route (protected)
// @access  Private (Admin only)
router.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin dashboard access granted!' });
});

// --- User Management Routes ---
// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/users', adminController.getAllUsers);

// @route   PUT /api/admin/users/:userId/tier
// @desc    Update user tier
// @access  Private (Admin)
router.put('/users/:userId/tier', adminController.updateUserTier);


// --- Product Management Routes ---
// @route   GET /api/admin/products
// @desc    Get all products
// @access  Private (Admin)
router.get('/products', adminController.getAllProducts);

// @route   POST /api/admin/products
// @desc    Add a new product
// @access  Private (Admin)
router.post('/products', adminController.addProduct);

// @route   PUT /api/admin/products/:productId
// @desc    Update an existing product
// @access  Private (Admin)
router.put('/products/:productId', adminController.updateProduct);

// @route   DELETE /api/admin/products/:productId
// @desc    Delete a product
// @access  Private (Admin)
router.delete('/products/:productId', adminController.deleteProduct);


// --- Account Management Routes ---
// @route   POST /api/admin/accounts/:userId/deposit
// @desc    Manually add deposit to user account
// @access  Private (Admin)
router.post('/accounts/:userId/deposit', adminController.addDeposit);

// @route   POST /api/admin/accounts/:userId/withdrawal
// @desc    Manually record withdrawal from user account
// @access  Private (Admin)
router.post('/accounts/:userId/withdrawal', adminController.recordWithdrawal);


module.exports = router;

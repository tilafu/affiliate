const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middlewares/auth'); // Assuming admin middleware exists or will be created
const {
  updateUserTier,
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  manualTransaction,
  getUsers // Add controller for getting users
  /* other admin controllers */
} = require('../controllers/adminController'); // Assuming controller exists or will be created

// --- User Management ---

// @route   GET /api/admin/users
// @desc    Get all users (for admin panel)
// @access  Private/Admin
router.get('/users', protect, admin, getUsers);

// @route   PUT /api/admin/users/:userId/tier
// @desc    Update a user's membership tier
// @access  Private/Admin
router.put('/users/:userId/tier', protect, admin, updateUserTier);


// --- Product Management ---
// @route   POST /api/admin/products
// @desc    Create a new data drive product
// @access  Private/Admin
router.post('/products', protect, admin, createProduct);

// @route   GET /api/admin/products
// @desc    Get all data drive products
// @access  Private/Admin
router.get('/products', protect, admin, getProducts);

// @route   PUT /api/admin/products/:productId
// @desc    Update an existing data drive product
// @access  Private/Admin
router.put('/products/:productId', protect, admin, updateProduct);

// @route   DELETE /api/admin/products/:productId
// @desc    Delete a data drive product
// @access  Private/Admin
router.delete('/products/:productId', protect, admin, deleteProduct);


// --- Transaction Management ---
// @route   POST /api/admin/users/:userId/transactions
// @desc    Manually add a deposit or withdrawal for a user
// @access  Private/Admin
router.post('/users/:userId/transactions', protect, admin, manualTransaction);


module.exports = router;

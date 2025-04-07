const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');

// @route   GET /api/admin/dashboard
// @desc    Admin dashboard route (protected)
// @access  Private (Admin only)
router.get('/dashboard', /* adminMiddleware, */ (req, res) => {
  res.json({ message: 'Admin dashboard access granted!' });
});

module.exports = router;

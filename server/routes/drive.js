const express = require('express');
const { startDrive, completeDrive, listCombos } = require('../controllers/drive'); // Import listCombos
const { protect } = require('../middlewares/auth'); // Assuming auth middleware is in middlewares/auth.js

const router = express.Router();

// @route   POST /api/drive/start
// @desc    Start a new drive session
// @access  Private
router.post('/start', protect, startDrive);

// @route   POST /api/drive/complete/:sessionId
// @desc    Complete an active drive session
// @access  Private
router.post('/complete/:sessionId', protect, completeDrive);

// @route   GET /api/drive/combos
// @desc    List available product combos
// @access  Private (or public if needed - using protect for now)
router.get('/combos', protect, listCombos);

module.exports = router;

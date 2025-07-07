const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const pool = require('../config/db');
const logger = require('../utils/logger');

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        // The protect middleware attaches the user object to req.user
        // We'll fetch additional details about the user if needed
        const userId = req.user.id;
        
        const query = `
            SELECT 
                id, 
                username, 
                email, 
                role, 
                created_at, 
                tier,
                profile_image_url,
                (SELECT COUNT(*) FROM chat_group_members WHERE user_id = users.id) as group_count
            FROM users 
            WHERE id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Return the user data
        res.json({
            success: true,
            user: result.rows[0]
        });
        
    } catch (error) {
        logger.error(`Error fetching user profile: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching user profile' 
        });
    }
});

module.exports = router;

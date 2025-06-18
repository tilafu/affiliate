const pool = require('../config/db');
const logger = require('../logger');

const notificationController = {
    // Get all notification categories
    getNotificationCategories: async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT * FROM notification_categories ORDER BY name ASC'
            );
            res.json({ success: true, categories: result.rows });
        } catch (error) {
            logger.error('Error fetching notification categories:', error);
            res.status(500).json({ 
                success: false, // Add success flag
                error: 'Failed to fetch notification categories',
                details: error.message 
            });
        }
    },

    // Create a new notification category
    createNotificationCategory: async (req, res) => {
        const { name, description } = req.body;
        try {
            const result = await pool.query(
                'INSERT INTO notification_categories (name, description) VALUES ($1, $2) RETURNING *',
                [name, description]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            logger.error('Error creating notification category:', error);
            res.status(500).json({ 
                error: 'Failed to create notification category',
                details: error.message 
            });
        }
    },

    // Update a notification category
    updateNotificationCategory: async (req, res) => {
        const { id } = req.params;
        const { name, description } = req.body;
        try {
            const result = await pool.query(
                'UPDATE notification_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
                [name, description, id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Notification category not found' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            logger.error('Error updating notification category:', error);
            res.status(500).json({ 
                error: 'Failed to update notification category',
                details: error.message 
            });
        }
    },

    // Delete a notification category
    deleteNotificationCategory: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query(
                'DELETE FROM notification_categories WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Notification category not found' });
            }
            res.json({ message: 'Notification category deleted successfully' });
        } catch (error) {
            logger.error('Error deleting notification category:', error);
            res.status(500).json({ 
                error: 'Failed to delete notification category',
                details: error.message 
            });
        }
    }
};

module.exports = notificationController;
const pool = require('../config/db');
const logger = require('../logger');

const dashboardController = {
    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        try {
            // Get total users count
            const usersResult = await pool.query(
                'SELECT COUNT(*) as total_users FROM users'
            );

            // Get total drives count
            const drivesResult = await pool.query(
                'SELECT COUNT(*) as total_drives FROM drive_sessions'
            );            // Get total commission paid
            const commissionResult = await pool.query(
                'SELECT COALESCE(SUM(commission_amount), 0) as total_commission FROM commission_logs'
            );

            // Get recent activities (last 5)
            const activitiesResult = await pool.query(
                `SELECT 
                    'drive' as type,
                    ds.id,
                    ds.created_at,
                    u.username,
                    ds.status
                FROM drive_sessions ds
                JOIN users u ON ds.user_id = u.id
                UNION ALL
                SELECT 
                    'commission' as type,
                    ct.id,
                    ct.created_at,
                    u.username,
                    ct.status
                FROM commission_transactions ct
                JOIN users u ON ct.user_id = u.id
                ORDER BY created_at DESC
                LIMIT 5`
            );

            // Get drive status distribution
            const driveStatusResult = await pool.query(
                `SELECT 
                    status,
                    COUNT(*) as count
                FROM drive_sessions
                GROUP BY status`
            );

            // Get user tier distribution
            const userTierResult = await pool.query(
                `SELECT 
                    tier,
                    COUNT(*) as count
                FROM users
                GROUP BY tier`
            );

            res.json({
                total_users: parseInt(usersResult.rows[0].total_users),
                total_drives: parseInt(drivesResult.rows[0].total_drives),
                total_commission: parseFloat(commissionResult.rows[0].total_commission),
                recent_activities: activitiesResult.rows,
                drive_status_distribution: driveStatusResult.rows,
                user_tier_distribution: userTierResult.rows
            });
        } catch (error) {
            logger.error('Error fetching dashboard statistics:', error);
            res.status(500).json({ 
                error: 'Failed to fetch dashboard statistics',
                details: error.message 
            });
        }
    }
};

module.exports = dashboardController; 
// Enhanced Tier Management Controller
// This handles all tier configuration operations for the admin panel

const pool = require('../config/db');
const logger = require('../logger');

/**
 * Get all tier configurations
 */
const getTierConfigurations = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                tier_name,
                quantity_limit,
                num_single_tasks,
                num_combo_tasks,
                min_price_single,
                max_price_single,
                min_price_combo,
                max_price_combo,
                commission_rate,
                description,
                is_active,
                created_at,
                updated_at
            FROM tier_quantity_configs 
            ORDER BY 
                CASE tier_name 
                    WHEN 'bronze' THEN 1
                    WHEN 'silver' THEN 2
                    WHEN 'gold' THEN 3
                    WHEN 'platinum' THEN 4
                    ELSE 5
                END
        `);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching tier configurations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tier configurations',
            error: error.message
        });
    }
};

/**
 * Update tier configuration
 */
const updateTierConfiguration = async (req, res) => {
    const { id } = req.params;
    const {
        tier_name,
        quantity_limit,
        num_single_tasks,
        num_combo_tasks,
        min_price_single,
        max_price_single,
        min_price_combo,
        max_price_combo,
        commission_rate,
        description,
        is_active
    } = req.body;

    // Validation
    if (!tier_name || quantity_limit === undefined || num_single_tasks === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: tier_name, quantity_limit, num_single_tasks'
        });
    }

    // Validate numeric values
    if (quantity_limit < 0 || num_single_tasks < 0 || 
        min_price_single < 0 || max_price_single < 0 ||
        min_price_single > max_price_single) {
        return res.status(400).json({
            success: false,
            message: 'Invalid numeric values or min_price_single > max_price_single'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if tier exists
        const existingTier = await client.query(
            'SELECT id FROM tier_quantity_configs WHERE id = $1',
            [id]
        );

        if (existingTier.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Tier configuration not found'
            });
        }

        // Check for duplicate tier_name (excluding current record)
        const duplicateTier = await client.query(
            'SELECT id FROM tier_quantity_configs WHERE tier_name = $1 AND id != $2',
            [tier_name, id]
        );

        if (duplicateTier.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Tier name already exists'
            });
        }

        // Update tier configuration
        const updateResult = await client.query(`
            UPDATE tier_quantity_configs 
            SET 
                tier_name = $1,
                quantity_limit = $2,
                num_single_tasks = $3,
                num_combo_tasks = $4,
                min_price_single = $5,
                max_price_single = $6,
                min_price_combo = $7,
                max_price_combo = $8,
                commission_rate = $9,
                description = $10,
                is_active = $11,
                updated_at = NOW()
            WHERE id = $12
            RETURNING *
        `, [
            tier_name,
            quantity_limit,
            num_single_tasks || 0,
            num_combo_tasks || 0,
            min_price_single || 0,
            max_price_single || 100,
            min_price_combo || 0,
            max_price_combo || 500,
            commission_rate || 5,
            description || '',
            is_active !== undefined ? is_active : true,
            id
        ]);

        await client.query('COMMIT');

        logger.info(`Tier configuration updated: ${tier_name} (ID: ${id}) by admin`);

        res.status(200).json({
            success: true,
            message: 'Tier configuration updated successfully',
            data: updateResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error updating tier configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update tier configuration',
            error: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * Create new tier configuration
 */
const createTierConfiguration = async (req, res) => {
    const {
        tier_name,
        quantity_limit,
        num_single_tasks,
        num_combo_tasks,
        min_price_single,
        max_price_single,
        min_price_combo,
        max_price_combo,
        commission_rate,
        description
    } = req.body;

    // Validation
    if (!tier_name || quantity_limit === undefined || num_single_tasks === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: tier_name, quantity_limit, num_single_tasks'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check for duplicate tier_name
        const existingTier = await client.query(
            'SELECT id FROM tier_quantity_configs WHERE tier_name = $1',
            [tier_name]
        );

        if (existingTier.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Tier name already exists'
            });
        }

        // Create new tier configuration
        const createResult = await client.query(`
            INSERT INTO tier_quantity_configs (
                tier_name,
                quantity_limit,
                num_single_tasks,
                num_combo_tasks,
                min_price_single,
                max_price_single,
                min_price_combo,
                max_price_combo,
                commission_rate,
                description,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            tier_name,
            quantity_limit,
            num_single_tasks,
            num_combo_tasks || 0,
            min_price_single || 0,
            max_price_single || 100,
            min_price_combo || 0,
            max_price_combo || 500,
            commission_rate || 5,
            description || '',
            true
        ]);

        await client.query('COMMIT');

        logger.info(`New tier configuration created: ${tier_name} by admin`);

        res.status(201).json({
            success: true,
            message: 'Tier configuration created successfully',
            data: createResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating tier configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create tier configuration',
            error: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * Delete tier configuration
 */
const deleteTierConfiguration = async (req, res) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if tier exists
        const existingTier = await client.query(
            'SELECT tier_name FROM tier_quantity_configs WHERE id = $1',
            [id]
        );

        if (existingTier.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Tier configuration not found'
            });
        }

        const tierName = existingTier.rows[0].tier_name;

        // Check if tier is being used by users
        const usersUsingTier = await client.query(
            'SELECT COUNT(*) as count FROM users WHERE tier = $1',
            [tierName]
        );

        if (usersUsingTier.rows[0].count > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: `Cannot delete tier '${tierName}' - ${usersUsingTier.rows[0].count} users are currently assigned to this tier`
            });
        }

        // Delete tier configuration
        await client.query('DELETE FROM tier_quantity_configs WHERE id = $1', [id]);

        await client.query('COMMIT');

        logger.info(`Tier configuration deleted: ${tierName} (ID: ${id}) by admin`);

        res.status(200).json({
            success: true,
            message: 'Tier configuration deleted successfully'
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error deleting tier configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete tier configuration',
            error: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * Get tier usage statistics
 */
const getTierStatistics = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                tqc.tier_name,
                tqc.is_active,
                COUNT(u.id) as user_count,
                COUNT(CASE WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d,
                AVG(a.balance) as avg_balance
            FROM tier_quantity_configs tqc
            LEFT JOIN users u ON u.tier = tqc.tier_name
            LEFT JOIN accounts a ON a.user_id = u.id AND a.type = 'main'
            GROUP BY tqc.tier_name, tqc.is_active
            ORDER BY 
                CASE tqc.tier_name 
                    WHEN 'bronze' THEN 1
                    WHEN 'silver' THEN 2
                    WHEN 'gold' THEN 3
                    WHEN 'platinum' THEN 4
                    ELSE 5
                END
        `);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching tier statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tier statistics',
            error: error.message
        });
    }
};

module.exports = {
    getTierConfigurations,
    updateTierConfiguration,
    createTierConfiguration,
    deleteTierConfiguration,
    getTierStatistics
};

const pool = require('../config/db');
const logger = require('../logger');

// --- Drive Configuration Management ---

// Create a new Drive Configuration
exports.createDriveConfiguration = async (req, res) => {
    const { name, description, tasks_required, is_active = true } = req.body;

    if (!name || typeof tasks_required !== 'number' || tasks_required <= 0) {
        return res.status(400).json({ message: 'Name and a positive tasks_required are mandatory.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO drive_configurations (name, description, tasks_required, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
            [name, description, tasks_required, is_active]
        );
        logger.info(`Drive configuration created: ${result.rows[0].id} - ${name}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating drive configuration:', error);
        res.status(500).json({ message: 'Failed to create drive configuration', error: error.message });
    }
};

// Get all Drive Configurations
exports.getDriveConfigurations = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM drive_configurations ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error('Error fetching drive configurations:', error);
        res.status(500).json({ message: 'Failed to fetch drive configurations', error: error.message });
    }
};

// Get a single Drive Configuration by ID
exports.getDriveConfigurationById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM drive_configurations WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Drive configuration not found.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error(`Error fetching drive configuration ${id}:`, error);
        res.status(500).json({ message: 'Failed to fetch drive configuration', error: error.message });
    }
};

// Update a Drive Configuration
exports.updateDriveConfiguration = async (req, res) => {
    const { id } = req.params;
    const { name, description, tasks_required, is_active } = req.body;

    if (!name || typeof tasks_required !== 'number' || tasks_required <= 0) {
        return res.status(400).json({ message: 'Name and a positive tasks_required are mandatory.' });
    }
    
    try {
        const result = await pool.query(
            'UPDATE drive_configurations SET name = $1, description = $2, tasks_required = $3, is_active = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, description, tasks_required, is_active, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Drive configuration not found.' });
        }
        logger.info(`Drive configuration updated: ${id} - ${name}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error(`Error updating drive configuration ${id}:`, error);
        res.status(500).json({ message: 'Failed to update drive configuration', error: error.message });
    }
};

// Delete a Drive Configuration
// Consider implications: what happens to task sets, user sessions using this config?
// For now, a simple delete. Might need soft delete or checks later.
exports.deleteDriveConfiguration = async (req, res) => {
    const { id } = req.params;
    try {
        // Before deleting, check if it's in use or if there are related records that need handling.
        // For example, check drive_task_sets or drive_sessions.
        // This is a placeholder for more complex logic.
        
        // Simple check: if task sets exist for this configuration, prevent deletion or handle cascade.
        const taskSetsCheck = await pool.query('SELECT id FROM drive_task_sets WHERE drive_configuration_id = $1 LIMIT 1', [id]);
        if (taskSetsCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Cannot delete configuration with active task sets. Please remove task sets first.' });
        }

        const result = await pool.query('DELETE FROM drive_configurations WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Drive configuration not found.' });
        }
        logger.info(`Drive configuration deleted: ${id}`);
        res.status(200).json({ message: 'Drive configuration deleted successfully.', deletedConfiguration: result.rows[0] });
    } catch (error) {
        logger.error(`Error deleting drive configuration ${id}:`, error);
        res.status(500).json({ message: 'Failed to delete drive configuration', error: error.message });
    }
};

// --- Drive Task Set Management ---

// Create a new Drive Task Set for a Drive Configuration
exports.createDriveTaskSet = async (req, res) => {
    const { drive_configuration_id, name, description, order_in_drive, is_combo = false } = req.body;

    if (!drive_configuration_id || !name || typeof order_in_drive !== 'number') {
        return res.status(400).json({ message: 'drive_configuration_id, name, and order_in_drive are mandatory.' });
    }

    try {
        // Check if drive_configuration_id exists
        const configExists = await pool.query('SELECT id FROM drive_configurations WHERE id = $1', [drive_configuration_id]);
        if (configExists.rows.length === 0) {
            return res.status(404).json({ message: 'Drive Configuration not found.' });
        }

        const result = await pool.query(
            'INSERT INTO drive_task_sets (drive_configuration_id, name, description, order_in_drive, is_combo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
            [drive_configuration_id, name, description, order_in_drive, is_combo]
        );
        logger.info(`Drive task set created: ${result.rows[0].id} for configuration ${drive_configuration_id}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating drive task set:', error);
        res.status(500).json({ message: 'Failed to create drive task set', error: error.message });
    }
};

// Get all Drive Task Sets for a specific Drive Configuration
exports.getTaskSetsForConfiguration = async (req, res) => {
    const { configurationId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM drive_task_sets WHERE drive_configuration_id = $1 ORDER BY order_in_drive ASC',
            [configurationId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error(`Error fetching task sets for configuration ${configurationId}:`, error);
        res.status(500).json({ message: 'Failed to fetch task sets', error: error.message });
    }
};

// Get a single Drive Task Set by ID
exports.getDriveTaskSetById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM drive_task_sets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Drive task set not found.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error(`Error fetching drive task set ${id}:`, error);
        res.status(500).json({ message: 'Failed to fetch drive task set', error: error.message });
    }
};

// Update a Drive Task Set
exports.updateDriveTaskSet = async (req, res) => {
    const { id } = req.params;
    const { name, description, order_in_drive, is_combo } = req.body;

    // Add validation as needed, e.g., ensuring order_in_drive is a number
    if (name === undefined && description === undefined && order_in_drive === undefined && is_combo === undefined) {
        return res.status(400).json({ message: 'No update fields provided.'});
    }

    // Fetch current values to only update provided fields
    let currentTaskSet;
    try {
        const currentResult = await pool.query('SELECT * FROM drive_task_sets WHERE id = $1', [id]);
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Drive task set not found.' });
        }
        currentTaskSet = currentResult.rows[0];
    } catch (error) {
        logger.error(`Error fetching task set ${id} for update:`, error);
        return res.status(500).json({ message: 'Failed to fetch task set for update', error: error.message });
    }

    const newName = name !== undefined ? name : currentTaskSet.name;
    const newDescription = description !== undefined ? description : currentTaskSet.description;
    const newOrderInDrive = order_in_drive !== undefined ? order_in_drive : currentTaskSet.order_in_drive;
    const newIsCombo = is_combo !== undefined ? is_combo : currentTaskSet.is_combo;

    try {
        const result = await pool.query(
            'UPDATE drive_task_sets SET name = $1, description = $2, order_in_drive = $3, is_combo = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [newName, newDescription, newOrderInDrive, newIsCombo, id]
        );
        
        logger.info(`Drive task set updated: ${id}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error(`Error updating drive task set ${id}:`, error);
        res.status(500).json({ message: 'Failed to update drive task set', error: error.message });
    }
};

// Delete a Drive Task Set
// Consider implications: what happens to products in this set (drive_task_set_products)?
exports.deleteDriveTaskSet = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Check if products are associated with this task set
        const productsCheck = await client.query('SELECT id FROM drive_task_set_products WHERE task_set_id = $1 LIMIT 1', [id]);
        if (productsCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot delete task set with associated products. Please remove products first.' });
        }

        const result = await client.query('DELETE FROM drive_task_sets WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Drive task set not found.' });
        }
        await client.query('COMMIT');
        logger.info(`Drive task set deleted: ${id}`);
        res.status(200).json({ message: 'Drive task set deleted successfully.', deletedTaskSet: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error deleting drive task set ${id}:`, error);
        res.status(500).json({ message: 'Failed to delete drive task set', error: error.message });
    } finally {
        client.release();
    }
};

// --- Drive Task Set Product Management ---

// Add a product to a Drive Task Set
exports.addProductToTaskSet = async (req, res) => {
    const { task_set_id, product_id, order_in_set, price_override, commission_override } = req.body;

    if (!task_set_id || !product_id || typeof order_in_set !== 'number') {
        return res.status(400).json({ message: 'task_set_id, product_id, and order_in_set are mandatory.' });
    }

    try {
        // Check if task_set_id exists
        const taskSetExists = await pool.query('SELECT id, is_combo FROM drive_task_sets WHERE id = $1', [task_set_id]);
        if (taskSetExists.rows.length === 0) {
            return res.status(404).json({ message: 'Drive Task Set not found.' });
        }

        // Check if product_id exists in the main products table
        const productExists = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
        if (productExists.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        
        // If the task set is a combo, only one product can be added.
        if (taskSetExists.rows[0].is_combo) {
            const existingProductsInCombo = await pool.query('SELECT id FROM drive_task_set_products WHERE task_set_id = $1', [task_set_id]);
            if (existingProductsInCombo.rows.length > 0) {
                return res.status(400).json({ message: 'Combo task sets can only have one product entry.' });
            }
        }

        const result = await pool.query(
            'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, price_override, commission_override, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *',
            [task_set_id, product_id, order_in_set, price_override, commission_override]
        );
        logger.info(`Product ${product_id} added to task set ${task_set_id}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error adding product to task set:', error);
        // Check for unique constraint violation (product_id, task_set_id, order_in_set)
        if (error.code === '23505') { // Unique violation
             return res.status(409).json({ message: 'This product and order_in_set combination already exists for this task set or order_in_set is already taken.', error: error.message });
        }
        res.status(500).json({ message: 'Failed to add product to task set', error: error.message });
    }
};

// Get all products for a specific Drive Task Set
exports.getProductsForTaskSet = async (req, res) => {
    const { taskSetId } = req.params;
    try {
        const result = await pool.query(
            `SELECT dtsp.*, p.name as product_name, p.description as product_description, p.price as original_price, p.commission_rate as original_commission
             FROM drive_task_set_products dtsp
             JOIN products p ON dtsp.product_id = p.id
             WHERE dtsp.task_set_id = $1
             ORDER BY dtsp.order_in_set ASC`,
            [taskSetId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error(`Error fetching products for task set ${taskSetId}:`, error);
        res.status(500).json({ message: 'Failed to fetch products for task set', error: error.message });
    }
};

// Get a specific product within a Drive Task Set by its own ID
exports.getDriveTaskSetProductById = async (req, res) => {
    const { id } = req.params; // This is the ID from drive_task_set_products table
    try {
        const result = await pool.query(
            `SELECT dtsp.*, p.name as product_name, p.description as product_description, p.price as original_price, p.commission_rate as original_commission
             FROM drive_task_set_products dtsp
             JOIN products p ON dtsp.product_id = p.id
             WHERE dtsp.id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Drive task set product not found.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error(`Error fetching drive task set product ${id}:`, error);
        res.status(500).json({ message: 'Failed to fetch drive task set product', error: error.message });
    }
};

// Update a product within a Drive Task Set
exports.updateProductInTaskSet = async (req, res) => {
    const { id } = req.params; // This is the ID from drive_task_set_products table
    const { order_in_set, price_override, commission_override } = req.body;

    if (order_in_set === undefined && price_override === undefined && commission_override === undefined) {
        return res.status(400).json({ message: 'No update fields provided.'});
    }

    let currentProductInSet;
    try {
        const currentResult = await pool.query('SELECT * FROM drive_task_set_products WHERE id = $1', [id]);
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ message: 'Product in task set not found.' });
        }
        currentProductInSet = currentResult.rows[0];
    } catch (error) {
        logger.error(`Error fetching product in task set ${id} for update:`, error);
        return res.status(500).json({ message: 'Failed to fetch product in task set for update', error: error.message });
    }

    const newOrderInSet = order_in_set !== undefined ? order_in_set : currentProductInSet.order_in_set;
    const newPriceOverride = price_override !== undefined ? price_override : currentProductInSet.price_override;
    const newCommissionOverride = commission_override !== undefined ? commission_override : currentProductInSet.commission_override;

    try {
        const result = await pool.query(
            'UPDATE drive_task_set_products SET order_in_set = $1, price_override = $2, commission_override = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [newOrderInSet, newPriceOverride, newCommissionOverride, id]
        );
        logger.info(`Product in task set updated: ${id}`);
        res.status(200).json(result.rows[0]);
    } catch (error) {
        logger.error(`Error updating product in task set ${id}:`, error);
         // Check for unique constraint violation (task_set_id, order_in_set)
        if (error.code === '23505') { // Unique violation for (task_set_id, order_in_set)
            return res.status(409).json({ message: 'This order_in_set is already taken for this task set.', error: error.message });
        }
        res.status(500).json({ message: 'Failed to update product in task set', error: error.message });
    }
};

// Remove a product from a Drive Task Set
exports.removeProductFromTaskSet = async (req, res) => {
    const { id } = req.params; // This is the ID from drive_task_set_products table
    try {
        const result = await pool.query('DELETE FROM drive_task_set_products WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product in task set not found.' });
        }
        logger.info(`Product ${result.rows[0].product_id} removed from task set ${result.rows[0].task_set_id} (entry ${id})`);
        res.status(200).json({ message: 'Product removed from task set successfully.', removedProductEntry: result.rows[0] });
    } catch (error) {
        logger.error(`Error removing product from task set (entry ${id}):`, error);
        res.status(500).json({ message: 'Failed to remove product from task set', error: error.message });
    }
};

// --- User Drive Assignment and Customization ---

// Assign a Drive Configuration to a User and create their active drive items
exports.assignDriveToUser = async (req, res) => {
    const { userId } = req.params;
    const { drive_configuration_id } = req.body;

    if (!drive_configuration_id) {
        return res.status(400).json({ message: 'drive_configuration_id is mandatory.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verify user exists
        const userExists = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userExists.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found.' });
        }

        // 2. Verify drive configuration exists and get tasks_required
        const configResult = await client.query('SELECT tasks_required FROM drive_configurations WHERE id = $1 AND is_active = TRUE', [drive_configuration_id]);
        if (configResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active drive configuration not found.' });
        }
        const tasksRequired = configResult.rows[0].tasks_required;

        // 3. Create a new drive_sessions record
        const sessionInsertResult = await client.query(
            `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at, updated_at)
             VALUES ($1, $2, 'active', $3, NOW(), NOW(), NOW()) RETURNING id`,
            [userId, drive_configuration_id, tasksRequired]
        );
        const newDriveSessionId = sessionInsertResult.rows[0].id;

        // 4. Fetch task set products for the configuration
        // This query assumes that each 'task set' effectively defines one step in the drive.
        // And each step initially has one primary product.
        const taskSetProductsResult = await client.query(
            `SELECT ts.id as task_set_id, tsp.product_id, ts.order_in_drive, ts.name as task_set_name
             FROM drive_task_sets ts
             JOIN drive_task_set_products tsp ON ts.id = tsp.task_set_id
             WHERE ts.drive_configuration_id = $1
             AND tsp.order_in_set = 1 -- Assuming the primary product for a step is order_in_set = 1
             ORDER BY ts.order_in_drive ASC`,
            [drive_configuration_id]
        );

        if (taskSetProductsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.warn(`No task set products (primary items) found for drive_configuration_id: ${drive_configuration_id} when assigning to user ${userId}`);
            return res.status(400).json({ message: 'Drive configuration has no primary task set products defined.' });
        }

        // 5. Populate user_active_drive_items
        let firstUserActiveDriveItemId = null;
        for (let i = 0; i < taskSetProductsResult.rows.length; i++) {
            const productInfo = taskSetProductsResult.rows[i];
            const overallOrder = productInfo.order_in_drive; // Use the order_in_drive from the task_set

            const activeItemInsertResult = await client.query(
                `INSERT INTO user_active_drive_items (user_id, drive_session_id, product_id_1, order_in_drive, user_status, task_type, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'PENDING', 'order', NOW(), NOW()) RETURNING id`,
                [userId, newDriveSessionId, productInfo.product_id, overallOrder]
            );
            if (i === 0) { // The first item in the ordered list
                firstUserActiveDriveItemId = activeItemInsertResult.rows[0].id;
            }
        }

        // 6. Update drive_sessions with current_user_active_drive_item_id
        if (firstUserActiveDriveItemId) {
            await client.query(
                'UPDATE drive_sessions SET current_user_active_drive_item_id = $1, updated_at = NOW() WHERE id = $2',
                [firstUserActiveDriveItemId, newDriveSessionId]
            );
        } else {
            logger.warn(`No firstUserActiveDriveItemId set for session ${newDriveSessionId}. This implies no task set products were processed.`);
            // Depending on business logic, this might be an error or a valid state if a drive can be empty.
            // For now, we assume a drive should have items if products were found.
        }

        await client.query('COMMIT');
        logger.info(`Drive configuration ${drive_configuration_id} assigned to user ${userId}. New drive session ID: ${newDriveSessionId}`);
        res.status(201).json({ 
            message: 'Drive assigned successfully.', 
            drive_session_id: newDriveSessionId,
            first_active_drive_item_id: firstUserActiveDriveItemId 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error assigning drive to user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to assign drive configuration', error: error.message });
    } finally {
        client.release();
    }
};

// Get active drive items for a user
exports.getActiveDriveItemsForUser = async (req, res) => {
    const { userId } = req.params;
    // Optional: could also take drive_session_id if a user can have multiple past sessions
    // For now, assumes we're interested in the latest 'active' or 'pending_reset' session

    try {
        // First, find the relevant active drive session for the user
        const sessionResult = await pool.query(
            `SELECT id FROM drive_sessions 
             WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen') 
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ message: 'No active drive session found for this user.' });
        }
        const driveSessionId = sessionResult.rows[0].id;

        const itemsResult = await pool.query(
            `SELECT uadi.*, 
                    p1.name as product_1_name, p1.image_url as product_1_image_url, 
                    p2.name as product_2_name, p2.image_url as product_2_image_url,
                    p3.name as product_3_name, p3.image_url as product_3_image_url
             FROM user_active_drive_items uadi
             LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
             LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
             LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
             WHERE uadi.user_id = $1 AND uadi.drive_session_id = $2
             ORDER BY uadi.order_in_drive ASC`,
            [userId, driveSessionId]
        );

        res.status(200).json(itemsResult.rows);

    } catch (error) {
        logger.error(`Error fetching active drive items for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch active drive items', error: error.message });
    }
};

// Add a product to a combo for a specific user_active_drive_item
exports.addProductToDriveItemCombo = async (req, res) => {
    const { userId, driveItemId } = req.params; // driveItemId is user_active_drive_items.id
    const { product_id } = req.body;

    if (!product_id) {
        return res.status(400).json({ message: 'product_id is mandatory.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verify user_active_drive_item exists, belongs to the user, and is part of an active session
        const itemResult = await client.query(
            `SELECT uadi.*, ds.status as session_status
             FROM user_active_drive_items uadi
             JOIN drive_sessions ds ON uadi.drive_session_id = ds.id
             WHERE uadi.id = $1 AND uadi.user_id = $2`,
            [driveItemId, userId]
        );

        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active drive item not found for this user.' });
        }

        const driveItem = itemResult.rows[0];
        if (!['active', 'pending_reset', 'frozen'].includes(driveItem.session_status)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Drive session is not active. Cannot modify items.' });
        }
        // Optional: Add check for driveItem.user_status if items can only be modified when PENDING/CURRENT
        if (driveItem.user_status !== 'PENDING' && driveItem.user_status !== 'CURRENT') {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: `Cannot modify item with status ${driveItem.user_status}.` });
        }

        // 2. Verify product exists
        const productExists = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
        if (productExists.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Product to add not found.' });
        }

        // 3. Determine which slot to add the product to (product_id_2 or product_id_3)
        let updateColumn = null;
        if (driveItem.product_id_1 == product_id || driveItem.product_id_2 == product_id || driveItem.product_id_3 == product_id) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Product already exists in this drive item.' });
        }

        if (driveItem.product_id_2 === null) {
            updateColumn = 'product_id_2';
        } else if (driveItem.product_id_3 === null) {
            updateColumn = 'product_id_3';
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot add more than two additional products (3 total) to this drive item.' });
        }

        // 4. Update the user_active_drive_item
        const updateResult = await client.query(
            `UPDATE user_active_drive_items SET ${updateColumn} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [product_id, driveItemId]
        );

        await client.query('COMMIT');
        logger.info(`Product ${product_id} added to drive item ${driveItemId} for user ${userId} in slot ${updateColumn}`);
        res.status(200).json(updateResult.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error adding product to drive item combo for user ${userId}, item ${driveItemId}:`, error);
        res.status(500).json({ message: 'Failed to add product to drive item combo', error: error.message });
    } finally {
        client.release();
    }
};

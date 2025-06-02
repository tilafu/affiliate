const pool = require('../config/db');
const logger = require('../logger');
const tierCommissionService = require('../services/tierCommissionService');
const balanceBasedFilterService = require('../services/balanceBasedFilterService');

// --- Drive Configuration Management ---

// Create a new Drive Configuration
exports.createDriveConfiguration = async (req, res) => {
    const { name, description, tasks_required, is_active = true, product_ids = [] } = req.body;

    if (!name || typeof tasks_required !== 'number' || tasks_required <= 0) {
        return res.status(400).json({ message: 'Name and a positive tasks_required are mandatory.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Create the drive configuration
        const result = await client.query(
            'INSERT INTO drive_configurations (name, description, tasks_required, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
            [name, description, tasks_required, is_active]
        );
        
        const configId = result.rows[0].id;
        
        // If product_ids were provided, create task sets for these products
        if (Array.isArray(product_ids) && product_ids.length > 0) {
            for (let i = 0; i < product_ids.length; i++) {
                const productId = product_ids[i];
                
                // Create a task set for this product
                const taskSetResult = await client.query(
                    'INSERT INTO drive_task_sets (drive_configuration_id, name, order_in_drive, is_combo, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
                    [configId, `Task Set ${i+1}`, i+1, false]
                );
                
                const taskSetId = taskSetResult.rows[0].id;
                
                // Add the product to the task set
                await client.query(
                    'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, $3, NOW())',
                    [taskSetId, productId, 1]  // order_in_set is 1-based index
                );
            }
        }
        
        await client.query('COMMIT');
        logger.info(`Drive configuration created: ${configId} - ${name}`);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating drive configuration:', error);
        res.status(500).json({ message: 'Failed to create drive configuration', error: error.message });
    } finally {
        client.release();
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
    const { name, description, tasks_required, is_active, product_ids = [] } = req.body;

    if (!name || typeof tasks_required !== 'number' || tasks_required <= 0) {
        return res.status(400).json({ message: 'Name and a positive tasks_required are mandatory.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. Check if the configuration exists before attempting update
        const configCheck = await client.query('SELECT id FROM drive_configurations WHERE id = $1', [id]);
        if (configCheck.rows.length === 0) { // Corrected: Added parentheses
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Drive configuration not found.' });
        }

        // 1. Update the basic drive configuration details
        const updatedConfigResult = await client.query(
            'UPDATE drive_configurations SET name = $1, description = $2, tasks_required = $3, is_active = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
            [name, description, tasks_required, is_active, id]
        );
        
        // This check is technically redundant due to the one above, but good for safety if logic changes.
        // if (updatedConfigResult.rows.length === 0) {
        //     await client.query('ROLLBACK');
        //     return res.status(404).json({ message: 'Drive configuration not found during update attempt.' });
        // }
        logger.info(`Drive configuration ${id} basic details updated.`);

        // 2. Fetch existing auto-generated task sets and their products for this configuration
        const existingTaskSetsResult = await client.query(
            `SELECT dts.id as task_set_id, dtsp.product_id
             FROM drive_task_sets dts
             JOIN drive_task_set_products dtsp ON dts.id = dtsp.task_set_id
             WHERE dts.drive_configuration_id = $1 AND dts.is_combo = FALSE`,
            [id]
        );
        const existingProductLinks = existingTaskSetsResult.rows.map(r => ({ task_set_id: r.task_set_id, product_id: r.product_id }));
        const existingProductIds = existingProductLinks.map(link => link.product_id);

        // 3. Determine products to add and remove
        const productsToAdd = product_ids.filter(pid => !existingProductIds.includes(pid));
        const productLinksToRemove = existingProductLinks.filter(link => !product_ids.includes(link.product_id));
        
        logger.info(`Updating products for drive config ${id}. To add: ${productsToAdd.join(', ') || 'none'}. To remove links for products: ${productLinksToRemove.map(l => l.product_id).join(', ') || 'none'}`);

        // 4. Remove old product associations (drive_task_set_products and then drive_task_sets)
        for (const link of productLinksToRemove) {
            logger.info(`Removing product link: product_id ${link.product_id} from task_set_id ${link.task_set_id} for config ${id}`);
            await client.query('DELETE FROM drive_task_set_products WHERE task_set_id = $1 AND product_id = $2', [link.task_set_id, link.product_id]);
            await client.query('DELETE FROM drive_task_sets WHERE id = $1', [link.task_set_id]);
            logger.info(`Deleted auto-generated task_set ${link.task_set_id} for product ${link.product_id}`);
        }

        // 5. Add new product associations and re-sequence all auto-generated task sets
        let orderCounter = 1;
        for (const productId of product_ids) {
            let taskSetId;
            const existingLinkForCurrentProduct = existingProductLinks.find(link => link.product_id === productId && !productLinksToRemove.some(rtl => rtl.task_set_id === link.task_set_id));

            if (existingLinkForCurrentProduct) {
                taskSetId = existingLinkForCurrentProduct.task_set_id;
                logger.info(`Updating order for existing task_set ${taskSetId} (product ${productId}) to ${orderCounter} for config ${id}`);
                await client.query(
                    'UPDATE drive_task_sets SET order_in_drive = $1, name = $2 WHERE id = $3',
                    [orderCounter, `Task Set ${orderCounter}`, taskSetId]
                );
            } else {
                logger.info(`Creating new task_set for product ${productId} at order ${orderCounter} for config ${id}`);
                const taskSetResult = await client.query(
                    'INSERT INTO drive_task_sets (drive_configuration_id, name, order_in_drive, is_combo, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
                    [id, `Task Set ${orderCounter}`, orderCounter, false]
                );
                taskSetId = taskSetResult.rows[0].id;

                await client.query(
                    'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, $3, NOW())',
                    [taskSetId, productId, 1] 
                );
                logger.info(`Created task_set ${taskSetId} and linked product ${productId} for config ${id}`);
            }
            orderCounter++;
        }
        
        await client.query('COMMIT');
        logger.info(`Drive configuration ${id} - '${name}' updated successfully with product associations.`);
        
        const finalConfigResult = await pool.query('SELECT * FROM drive_configurations WHERE id = $1', [id]);
        res.status(200).json(finalConfigResult.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error updating drive configuration ${id}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: 'Failed to update drive configuration', error: error.message });
    } finally {
        client.release();
    }
};

// Delete a Drive Configuration
// Consider implications: what happens to task sets, user sessions using this config?
// For now, a simple delete. Might need soft delete or checks later.
exports.deleteDriveConfiguration = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check for active drive sessions using this configuration
        const activeSessionsCheck = await client.query(
            'SELECT id FROM drive_sessions WHERE drive_configuration_id = $1 AND status IN (\'active\', \'pending_reset\', \'frozen\') LIMIT 1', 
            [id]
        );
        if (activeSessionsCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: 'Cannot delete configuration with active drive sessions. Please end all active drive sessions first.' 
            });
        }
        
        // Check for users with this assigned configuration
        const usersCheck = await client.query(
            'SELECT id FROM users WHERE assigned_drive_configuration_id = $1 LIMIT 1', 
            [id]
        );
        if (usersCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: 'Cannot delete configuration assigned to users. Please unassign all users first.' 
            });
        }
        
        // Check for task sets
        const taskSetsCheck = await client.query(
            'SELECT id FROM drive_task_sets WHERE drive_configuration_id = $1 LIMIT 1', 
            [id]
        );
        if (taskSetsCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: 'Cannot delete configuration with active task sets. Please remove task sets first.' 
            });
        }

        // If all checks pass, delete the configuration
        const result = await client.query(
            'DELETE FROM drive_configurations WHERE id = $1 RETURNING *', 
            [id]
        );
        
        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Drive configuration not found.' });
        }
        
        await client.query('COMMIT');
        logger.info(`Drive configuration deleted: ${id}`);
        res.status(200).json({ 
            message: 'Drive configuration deleted successfully.', 
            deletedConfiguration: result.rows[0] 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error deleting drive configuration ${id}:`, error);
        res.status(500).json({ 
            message: 'Failed to delete drive configuration', 
            error: error.message 
        });
    } finally {
        client.release();
    }
};

// --- Drive Task Set Management ---

// Create a new Drive Task Set for a Drive Configuration
exports.createDriveTaskSet = async (req, res) => {
    const { drive_configuration_id, name, description, order_in_drive, is_combo = false, user_id, product_ids } = req.body;

    if (!drive_configuration_id || !name || typeof order_in_drive !== 'number') {
        return res.status(400).json({ message: 'drive_configuration_id, name, and order_in_drive are mandatory.' });
    }

    // Validate product_ids if provided
    if (product_ids && (!Array.isArray(product_ids) || product_ids.length === 0)) {
        return res.status(400).json({ message: 'product_ids must be an array with at least one product ID.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if drive_configuration_id exists
        const configExists = await client.query('SELECT id FROM drive_configurations WHERE id = $1', [drive_configuration_id]);
        if (configExists.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Drive Configuration not found.' });
        }

        // Create the task set
        const taskSetResult = await client.query(
            'INSERT INTO drive_task_sets (drive_configuration_id, name, description, order_in_drive, is_combo, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
            [drive_configuration_id, name, description, order_in_drive, is_combo]
        );
        
        const taskSetId = taskSetResult.rows[0].id;
        
        // Add products to the task set if provided
        if (product_ids && product_ids.length > 0) {
            for (let i = 0; i < product_ids.length; i++) {
                const productId = product_ids[i];
                // Verify product exists
                const productExists = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
                if (productExists.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: `Product with ID ${productId} not found.` });
                }
                
                // Add product to the task set
                await client.query(
                    'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, $3, NOW())',
                    [taskSetId, productId, i + 1]  // order_in_set is 1-based index
                );
            }
        }

        // If user_id is provided, we're creating a custom task set for this user
        if (user_id) {
            // Verify user exists
            const userExists = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
            if (userExists.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: `User with ID ${user_id} not found.` });
            }
            
            // Check if user has an active drive session for this configuration
            const sessionResult = await client.query(
                `SELECT id FROM drive_sessions 
                 WHERE user_id = $1 AND drive_configuration_id = $2 AND status = 'active'
                 ORDER BY started_at DESC LIMIT 1`,
                [user_id, drive_configuration_id]
            );
            
            // If user doesn't have an active session, we might want to create one or just associate the task set
            // This depends on your specific business logic
            // For now, we'll just log it
            if (sessionResult.rows.length === 0) {
                logger.info(`No active drive session found for user ${user_id} with configuration ${drive_configuration_id} when creating task set ${taskSetId}`);
            }
        }
        
        await client.query('COMMIT');
        logger.info(`Drive task set created: ${taskSetId} for configuration ${drive_configuration_id}`);
        res.status(201).json(taskSetResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating drive task set:', error);
        res.status(500).json({ message: 'Failed to create drive task set', error: error.message });
    } finally {
        client.release();
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
            'UPDATE drive_task_sets SET name = $1, description = $2, order_in_drive = $3, is_combo = $4 WHERE id = $5 RETURNING *',
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
    const { task_set_id, product_id, order_in_set, price_override } = req.body;

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
            'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, price_override, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [task_set_id, product_id, order_in_set, price_override]
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
            `SELECT dtsp.*, p.name as product_name, p.description as product_description, p.price as original_price
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
    try {        const result = await pool.query(
            `SELECT dtsp.*, p.name as product_name, p.description as product_description, p.price as original_price
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
    const { order_in_set, price_override } = req.body;

    if (order_in_set === undefined && price_override === undefined) {
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

    try {
        const result = await pool.query(
            'UPDATE drive_task_set_products SET order_in_set = $1, price_override = $2 WHERE id = $3 RETURNING *',
            [newOrderInSet, newPriceOverride, id]
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
        logger.info(`Product ${result.rows[0].product_id} removed from task set ${result.rows[0].task_set_id}`);
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
            `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at)
             VALUES ($1, $2, 'active', $3, NOW(), NOW()) RETURNING id`,
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
                'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
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

// Assign a Drive Configuration to a User (for admin override or direct assignment)
exports.assignDriveConfigurationToUser = async (req, res) => {
    const { userId } = req.params;
    const { drive_configuration_id } = req.body;

    if (!drive_configuration_id) {
        return res.status(400).json({ message: 'drive_configuration_id is mandatory.' });
    }

    const client = await pool.connect(); // Use a client for transaction

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Verify user exists
        const userResult = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ message: 'User not found.' });
        }

        // 2. Verify drive configuration exists and get tasks_required
        const configDetailsResult = await client.query(
            'SELECT id, tasks_required FROM drive_configurations WHERE id = $1 AND is_active = TRUE',
            [drive_configuration_id]
        );
        if (configDetailsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ message: 'Active drive configuration not found.' });
        }
        const tasksRequired = configDetailsResult.rows[0].tasks_required;

        // 3. Update the user's assigned_drive_configuration_id
        const updateUserConfigResult = await client.query(
            'UPDATE users SET assigned_drive_configuration_id = $1 WHERE id = $2 RETURNING id, username, email, assigned_drive_configuration_id',
            [drive_configuration_id, userId]
        );
        if (updateUserConfigResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(500).json({ message: 'Failed to update user with drive configuration.' });
        }

        // 4. Check if there's an existing active drive session for this user
        const existingSessionResult = await client.query(
            `SELECT id FROM drive_sessions 
             WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
             ORDER BY started_at DESC LIMIT 1`,
            [userId]
        );        // If no active session exists, create one for this configuration
        if (existingSessionResult.rows.length === 0) {
            logger.debug(`assignDriveConfigurationToUser: No existing active session for user ${userId}. Creating new session.`);
            
            // First, fetch task set products for the configuration to ensure we have valid data            // First, fetch task set products for the configuration to ensure we have valid data
            const taskSetProductsResult = await client.query(
                `SELECT ts.id as task_set_id, tsp.product_id, ts.order_in_drive, ts.name as task_set_name
                 FROM drive_task_sets ts
                 JOIN drive_task_set_products tsp ON ts.id = tsp.task_set_id
                 WHERE ts.drive_configuration_id = $1
                 AND tsp.order_in_set = 1 
                 ORDER BY ts.order_in_drive ASC`,
                [drive_configuration_id]
            );

            if (taskSetProductsResult.rows.length === 0) {
                await client.query('ROLLBACK');
                logger.warn(`assignDriveConfigurationToUser: No task set products found for drive_configuration_id: ${drive_configuration_id}. Cannot create session.`);
                client.release();
                return res.status(400).json({ 
                    message: 'Drive configuration has no products defined. Cannot start drive. Please contact an administrator.' 
                });
            }            logger.info(`assignDriveConfigurationToUser: Found ${taskSetProductsResult.rows.length} task set products for config ${drive_configuration_id}.`);            // Create drive session without current_user_active_drive_item_id initially (it's nullable)
            const sessionInsertResult = await client.query(
                `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at)
                 VALUES ($1, $2, 'active', $3, NOW(), NOW()) RETURNING id`,
                [userId, drive_configuration_id, tasksRequired]
            );
            
            const newDriveSessionId = sessionInsertResult.rows[0].id;
            logger.info(`assignDriveConfigurationToUser: New drive_session created with ID: ${newDriveSessionId} for user ${userId}`);

            // Now create the user_active_drive_items
            let firstUserActiveDriveItemId = null;
            for (let i = 0; i < taskSetProductsResult.rows.length; i++) {
                const productInfo = taskSetProductsResult.rows[i];
                const overallOrder = productInfo.order_in_drive;
                
                const activeItemInsertResult = await client.query(
                    `INSERT INTO user_active_drive_items (user_id, drive_session_id, product_id_1, order_in_drive, user_status, task_type, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, 'order', NOW(), NOW()) RETURNING id`,
                    [userId, newDriveSessionId, productInfo.product_id, overallOrder, i === 0 ? 'CURRENT' : 'PENDING']
                );
                
                const insertedItemId = activeItemInsertResult.rows[0]?.id;
                logger.debug(`assignDriveConfigurationToUser: Inserted user_active_drive_item for session ${newDriveSessionId}, product ${productInfo.product_id}, order ${overallOrder}. Returned ID: ${insertedItemId}`);

                if (i === 0) {
                    if (insertedItemId) {
                        firstUserActiveDriveItemId = insertedItemId;
                        logger.info(`assignDriveConfigurationToUser: firstUserActiveDriveItemId set to: ${firstUserActiveDriveItemId}`);
                    } else {
                        logger.error(`assignDriveConfigurationToUser: CRITICAL - Inserted first user_active_drive_item (i=0) but RETURNING id was null/undefined for session ${newDriveSessionId}.`);
                    }
                }
            }

            if (!firstUserActiveDriveItemId) {
                await client.query('ROLLBACK');
                logger.error(`assignDriveConfigurationToUser: CRITICAL_ERROR - Task set products were found (${taskSetProductsResult.rows.length}), but firstUserActiveDriveItemId was NOT set. Rolling back for session ${newDriveSessionId}.`);
                client.release();
                return res.status(500).json({ 
                    message: 'Failed to initialize drive items correctly. The drive session could not be started properly.'
                });
            }

            // Finally, update the drive_session with the firstUserActiveDriveItemId
            const updateSessionResult = await client.query(
                'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                [firstUserActiveDriveItemId, newDriveSessionId]
            );

            if (updateSessionResult.rowCount === 0) {
                await client.query('ROLLBACK');
                logger.error(`assignDriveConfigurationToUser: CRITICAL_ERROR - Failed to update drive_session ${newDriveSessionId} with firstUserActiveDriveItemId ${firstUserActiveDriveItemId}. Rolling back.`);
                client.release();
                return res.status(500).json({ 
                    message: 'Failed to finalize drive session initialization.'
                });
            }
            logger.info(`assignDriveConfigurationToUser: Successfully updated drive_session ${newDriveSessionId} with current_user_active_drive_item_id ${firstUserActiveDriveItemId}.`);

        } else {
            const sessionId = existingSessionResult.rows[0].id;
            logger.info(`assignDriveConfigurationToUser: User ${userId} already has active session ${sessionId}. Not creating a new one, but assigned_drive_configuration_id in users table is updated.`);
        }

        await client.query('COMMIT'); // Commit transaction
        logger.info(`Admin assigned drive configuration ${drive_configuration_id} to user ${userId}. User's record updated and new session (if applicable) initialized.`);
        res.status(200).json({ 
            message: 'User drive configuration assigned successfully.', 
            user: updateUserConfigResult.rows[0] 
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on any error
        logger.error(`Error assigning drive configuration ${drive_configuration_id} to user ${userId}:`, error);
        res.status(500).json({ 
            message: 'Failed to assign drive configuration to user', 
            error: error.message,
            code: error.code // Pass along SQL error code if available
        });
    } finally {
        client.release(); // Release client in all cases
    }
};

// Get all products for a drive configuration
exports.getProductsForConfiguration = async (req, res) => {
    const { configId } = req.params;
    try {
        // First, check if the configuration exists
        const configCheck = await pool.query('SELECT id FROM drive_configurations WHERE id = $1', [configId]);
        if (configCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Drive configuration not found.' });
        }

        // Get all products associated with task sets in this configuration
        const productsResult = await pool.query(
            `SELECT DISTINCT p.id, p.name, p.price, p.description, p.image_url
             FROM products p
             JOIN drive_task_set_products dtsp ON p.id = dtsp.product_id
             JOIN drive_task_sets dts ON dtsp.task_set_id = dts.id
             WHERE dts.drive_configuration_id = $1 AND p.is_active = TRUE
             ORDER BY p.name`,
            [configId]
        );

        // If no products found specifically for task sets, get all active products as fallback
        if (productsResult.rows.length === 0) {
            const allProductsResult = await pool.query(
                'SELECT id, name, price, description, image_url FROM products WHERE is_active = TRUE ORDER BY name'
            );
            
            return res.status(200).json({ 
                success: true, 
                products: allProductsResult.rows,
                message: 'No products specifically assigned to this configuration. Showing all active products.'
            });
        }

        return res.status(200).json({ 
            success: true, 
            products: productsResult.rows 
        });
    } catch (error) {
        logger.error(`Error fetching products for configuration ${configId}:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch products for configuration', 
            error: error.message 
        });
    }
};

// New function to get user drive progress
exports.getUserDriveProgress = async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: "User ID is required." });
    }    // Updated SQL query to fetch more details for task items
    const query = `
        SELECT
            ds.user_id,
            ds.id AS drive_session_id,
            dc.id AS drive_configuration_id,
            dc.name AS drive_configuration_name,
            uadi.id AS task_item_id,
            uadi.order_in_drive,
            uadi.user_status,
            uadi.product_id_1,
            p1.id AS product_1_id, p1.name AS product_1_name,
            uadi.product_id_2,
            p2.id AS product_2_id, p2.name AS product_2_name,
            uadi.product_id_3,
            p3.id AS product_3_id, p3.name AS product_3_name,
            (SELECT COUNT(*) FROM user_active_drive_items uadi_count WHERE uadi_count.drive_session_id = ds.id AND uadi_count.user_id = ds.user_id) AS total_task_items
        FROM
            drive_sessions ds
        JOIN
            drive_configurations dc ON ds.drive_configuration_id = dc.id
        LEFT JOIN
            user_active_drive_items uadi ON ds.id = uadi.drive_session_id AND uadi.user_id = ds.user_id
        LEFT JOIN
            products p1 ON uadi.product_id_1 = p1.id
        LEFT JOIN
            products p2 ON uadi.product_id_2 = p2.id
        LEFT JOIN
            products p3 ON uadi.product_id_3 = p3.id
        WHERE
            ds.user_id = $1
            AND ds.status = 'active'
        ORDER BY
            ds.started_at DESC, uadi.order_in_drive ASC
    `;
    try {
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No active drive session found for this user.' });
        }

        const firstRowWithSessionData = result.rows[0]; // All rows share same session info if result.rows is not empty

        // Filter out rows that don't represent actual task items (e.g., session exists but no items yet)
        const taskItemsData = result.rows.filter(row => row.task_item_id !== null);

        const response = {
            user_id: firstRowWithSessionData.user_id,
            drive_session_id: firstRowWithSessionData.drive_session_id,
            drive_configuration_id: firstRowWithSessionData.drive_configuration_id,
            drive_configuration_name: firstRowWithSessionData.drive_configuration_name,
            total_task_items: firstRowWithSessionData.total_task_items, // From subquery, accurate count in DB
            completed_task_items: taskItemsData.filter(row => row.user_status === 'COMPLETED').length,
            current_task_item_id: taskItemsData.find(row => row.user_status === 'CURRENT')?.task_item_id || null,            task_items: taskItemsData.map(row => {
                // Since override functionality has been removed, treat all items as regular product-based tasks
                let taskNameDisplay = 'Task'; // Default task name
                let itemProducts = [];
                
                // Populate products based on available product_id_X and product_X_name fields
                if (row.product_id_1 && row.product_1_name) itemProducts.push({ id: row.product_1_id, name: row.product_1_name });
                if (row.product_id_2 && row.product_2_name) itemProducts.push({ id: row.product_2_id, name: row.product_2_name });
                if (row.product_id_3 && row.product_3_name) itemProducts.push({ id: row.product_3_id, name: row.product_3_name });

                if (itemProducts.length > 0) {
                    taskNameDisplay = itemProducts.map(p => p.name).join(' / ');
                } else {
                    // Fallback if no products are found
                    taskNameDisplay = 'Unnamed Task'; 
                }
                
                return {
                    task_item_id: row.task_item_id,
                    order_in_drive: row.order_in_drive,
                    user_status: row.user_status,
                    task_name: taskNameDisplay, 
                    task_description: null, // No specific description for product sets
                    products: itemProducts,
                    is_combo: false // Override functionality removed, so no combos
                };
            })
        };

        res.status(200).json(response);
    } catch (error) {
        logger.error(`Error fetching drive progress for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch drive progress', error: error.message });
    }
};



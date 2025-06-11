const pool = require('../config/db');
const logger = require('../logger');
const tierCommissionService = require('../services/tierCommissionService');
const balanceBasedFilterService = require('../services/balanceBasedFilterService');

// --- Drive Configuration Management ---

// Create a new Drive Configuration
const createDriveConfiguration = async (req, res) => {
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
const getDriveConfigurations = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM drive_configurations ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error('Error fetching drive configurations:', error);
        res.status(500).json({ message: 'Failed to fetch drive configurations', error: error.message });
    }
};

// Get a single Drive Configuration by ID
const getDriveConfigurationById = async (req, res) => {
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
const updateDriveConfiguration = async (req, res) => {
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
const deleteDriveConfiguration = async (req, res) => {
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

// Get all products for a specific Drive Configuration
const getProductsForConfiguration = async (req, res) => {
    const { configId } = req.params;
    try {
        // First, check if the configuration exists
        const configExists = await pool.query('SELECT id FROM drive_configurations WHERE id = $1', [configId]);
        if (configExists.rows.length === 0) {
            return res.status(404).json({ message: 'Drive configuration not found.' });
        }

        const result = await pool.query(
            `SELECT DISTINCT p.id as product_id, p.name as product_name, p.description as product_description, p.price as original_price,
                     dts.id as task_set_id, dts.name as task_set_name, dtsp.order_in_set
             FROM products p
             JOIN drive_task_set_products dtsp ON p.id = dtsp.product_id
             JOIN drive_task_sets dts ON dtsp.task_set_id = dts.id
             WHERE dts.drive_configuration_id = $1
             ORDER BY dts.id, dtsp.order_in_set ASC`,
            [configId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error(`Error fetching products for configuration ${configId}:`, error);
        res.status(500).json({ message: 'Failed to fetch products for configuration', error: error.message });
    }
};

// --- Drive Task Set Management ---

// Create a new Drive Task Set for a Drive Configuration
const createDriveTaskSet = async (req, res) => {
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
const getTaskSetsForConfiguration = async (req, res) => {
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
const getDriveTaskSetById = async (req, res) => {
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
const updateDriveTaskSet = async (req, res) => {
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
const deleteDriveTaskSet = async (req, res) => {
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

// Add a product to a Drive Task Set
const addProductToTaskSet = async (req, res) => {
    const { task_set_id, product_id, order_in_set, price_override } = req.body;

    if (!task_set_id || !product_id || typeof order_in_set !== 'number') {
        return res.status(400).json({ message: 'task_set_id, product_id, and order_in_set are mandatory.' });
    }

    try {
        // Check if task_set_id exists
        const taskSetResult = await pool.query('SELECT id, name, is_combo FROM drive_task_sets WHERE id = $1', [task_set_id]);
        if (taskSetResult.rows.length === 0) {
            return res.status(404).json({ message: 'Drive Task Set not found.' });
        }
        const taskSet = taskSetResult.rows[0];

        // Check if product_id exists in the main products table
        const productExists = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
        if (productExists.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        
        // If the task set is a combo, check product limit (max 3)
        if (taskSet.is_combo) {
            const existingProductsCountResult = await pool.query('SELECT COUNT(*) AS count FROM drive_task_set_products WHERE task_set_id = $1', [task_set_id]);
            const existingProductCount = parseInt(existingProductsCountResult.rows[0].count, 10);
            if (existingProductCount >= 3) {
                return res.status(400).json({ message: `Failed to add product to combo task set: Task set "${taskSet.name || task_set_id}" already has ${existingProductCount} product(s). Cannot add more (max 3 products per task set).` });
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
const getProductsForTaskSet = async (req, res) => {
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
const getDriveTaskSetProductById = async (req, res) => {
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
const updateProductInTaskSet = async (req, res) => {
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
const removeProductFromTaskSet = async (req, res) => {
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
const assignDriveToUser = async (req, res) => {
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
        logger.info(`assignDriveToUser: New drive_session created with ID: ${newDriveSessionId} for user ${userId}, config ID: ${drive_configuration_id}`);

        // Fetch all task sets for the configuration
        const driveTaskSetsResult = await client.query(
            `SELECT id, order_in_drive, is_combo, name as task_set_name 
             FROM drive_task_sets 
             WHERE drive_configuration_id = $1 
             ORDER BY order_in_drive ASC`,
            [drive_configuration_id]
        );

        logger.debug(`assignDriveToUser: Found ${driveTaskSetsResult.rows.length} task sets for configuration ${drive_configuration_id}. Tasks required by config: ${tasksRequired}`);

        if (driveTaskSetsResult.rows.length === 0 && tasksRequired > 0) {
            await client.query('ROLLBACK');
            logger.error(`assignDriveToUser: CRITICAL_ERROR - Drive configuration ${drive_configuration_id} requires ${tasksRequired} tasks but has no drive_task_sets defined. Rolling back.`);
            client.release();
            return res.status(400).json({ message: 'Drive configuration is incomplete: no task sets defined for a configuration that requires tasks.' });
        }

        let firstUserActiveDriveItemId = null;

        for (let i = 0; i < driveTaskSetsResult.rows.length; i++) {
            const taskSet = driveTaskSetsResult.rows[i];
            logger.debug(`assignDriveToUser: Processing taskSet ID: ${taskSet.id} ('${taskSet.task_set_name}'), order_in_drive: ${taskSet.order_in_drive}, is_combo: ${taskSet.is_combo}`);

            const productsInTaskSetResult = await client.query(
                `SELECT product_id, order_in_set 
                 FROM drive_task_set_products 
                 WHERE task_set_id = $1 
                 ORDER BY order_in_set ASC`,
                [taskSet.id]
            );

            logger.debug(`assignDriveToUser: Found ${productsInTaskSetResult.rows.length} products for taskSet ID: ${taskSet.id}`);

            let productId1 = null;
            let productId2 = null;
            let productId3 = null;

            if (productsInTaskSetResult.rows.length > 0) {
                if (taskSet.is_combo) {
                    productId1 = productsInTaskSetResult.rows[0]?.product_id || null;
                    productId2 = productsInTaskSetResult.rows[1]?.product_id || null;
                    productId3 = productsInTaskSetResult.rows[2]?.product_id || null;
                    logger.debug(`assignDriveToUser: Combo task set ${taskSet.id} products: p1=${productId1}, p2=${productId2}, p3=${productId3}`);
                } else {
                    productId1 = productsInTaskSetResult.rows[0]?.product_id || null; // Primary product for non-combo
                    logger.debug(`assignDriveToUser: Non-combo task set ${taskSet.id} product: p1=${productId1}`);
                }
            } else {
                logger.warn(`assignDriveToUser: Task set ${taskSet.id} (order ${taskSet.order_in_drive}, name '${taskSet.task_set_name}') has no products defined in drive_task_set_products. product_id fields will be null.`);
            }

            const userStatus = i === 0 ? 'CURRENT' : 'PENDING';
            const taskType = taskSet.is_combo ? 'combo_order' : 'single_order';

            const activeItemInsertResult = await client.query(
                `INSERT INTO user_active_drive_items 
                    (user_id, drive_session_id, product_id_1, product_id_2, product_id_3, 
                     order_in_drive, user_status, task_type, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id`,
                [userId, newDriveSessionId, productId1, productId2, productId3, 
                 taskSet.order_in_drive, userStatus, taskType]
            );
            
            const insertedItemId = activeItemInsertResult.rows[0]?.id;
            if (!insertedItemId) {
                await client.query('ROLLBACK');
                logger.error(`assignDriveToUser: CRITICAL_ERROR - Failed to insert user_active_drive_item for task_set ${taskSet.id}. Rollback.`);
                client.release();
                return res.status(500).json({ message: 'Failed to create active drive item.' });
            }
            logger.debug(`assignDriveToUser: Inserted user_active_drive_item ID: ${insertedItemId} for task_set ${taskSet.id} (order ${taskSet.order_in_drive}), type: ${taskType}`);

            if (i === 0) {
                firstUserActiveDriveItemId = insertedItemId;
            }
        }
        
        // 6. Update drive_sessions with current_user_active_drive_item_id
        if (firstUserActiveDriveItemId) {
            await client.query(
                'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                [firstUserActiveDriveItemId, newDriveSessionId]
            );
            logger.info(`assignDriveToUser: Successfully updated drive_session ${newDriveSessionId} with current_user_active_drive_item_id ${firstUserActiveDriveItemId}.`);
        } else if (tasksRequired > 0) { // Only a critical error if tasks were expected but no first item was set
            await client.query('ROLLBACK');
            logger.error(`assignDriveToUser: CRITICAL_ERROR - Drive requires ${tasksRequired} tasks, but firstUserActiveDriveItemId was NOT set. Session ${newDriveSessionId}. Rolling back.`);
            client.release();
            return res.status(500).json({ 
                message: 'Failed to initialize drive items correctly for a drive that requires tasks.'
            });
        } else {
            logger.info(`assignDriveToUser: No firstUserActiveDriveItemId to set for session ${newDriveSessionId} (likely tasksRequired is 0 and no task sets).`);
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
const getActiveDriveItemsForUser = async (req, res) => {
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
const assignDriveConfigurationToUser = async (req, res) => {
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
            
            const sessionInsertResult = await client.query(
                `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at)
                 VALUES ($1, $2, 'active', $3, NOW(), NOW()) RETURNING id`,
                [userId, drive_configuration_id, tasksRequired]
            );
            
            const newDriveSessionId = sessionInsertResult.rows[0].id;
            logger.info(`assignDriveConfigurationToUser: New drive_session created with ID: ${newDriveSessionId} for user ${userId}, config ID: ${drive_configuration_id}`);

            // Fetch all task sets for the configuration
            const driveTaskSetsResult = await client.query(
                `SELECT id, order_in_drive, is_combo, name as task_set_name 
                 FROM drive_task_sets 
                 WHERE drive_configuration_id = $1 
                 ORDER BY order_in_drive ASC`,
                [drive_configuration_id]
            );

            logger.debug(`assignDriveConfigurationToUser: Found ${driveTaskSetsResult.rows.length} task sets for configuration ${drive_configuration_id}. Tasks required by config: ${tasksRequired}`);

            if (driveTaskSetsResult.rows.length === 0 && tasksRequired > 0) {
                await client.query('ROLLBACK');
                logger.error(`assignDriveConfigurationToUser: CRITICAL_ERROR - Drive configuration ${drive_configuration_id} requires ${tasksRequired} tasks but has no drive_task_sets defined. Rolling back.`);
                client.release();
                return res.status(400).json({ message: 'Drive configuration is incomplete: no task sets defined for a configuration that requires tasks.' });
            }

            let firstUserActiveDriveItemId = null;

            for (let i = 0; i < driveTaskSetsResult.rows.length; i++) {
                const taskSet = driveTaskSetsResult.rows[i];
                logger.debug(`assignDriveConfigurationToUser: Processing taskSet ID: ${taskSet.id} ('${taskSet.task_set_name}'), order_in_drive: ${taskSet.order_in_drive}, is_combo: ${taskSet.is_combo}`);

                const productsInTaskSetResult = await client.query(
                    `SELECT product_id, order_in_set 
                     FROM drive_task_set_products 
                     WHERE task_set_id = $1 
                     ORDER BY order_in_set ASC`,
                    [taskSet.id]
                );

                logger.debug(`assignDriveConfigurationToUser: Found ${productsInTaskSetResult.rows.length} products for taskSet ID: ${taskSet.id}`);

                let productId1 = null;
                let productId2 = null;
                let productId3 = null;

                if (productsInTaskSetResult.rows.length > 0) {
                    if (taskSet.is_combo) {
                        productId1 = productsInTaskSetResult.rows[0]?.product_id || null;
                        productId2 = productsInTaskSetResult.rows[1]?.product_id || null;
                        productId3 = productsInTaskSetResult.rows[2]?.product_id || null;
                        logger.debug(`assignDriveConfigurationToUser: Combo task set ${taskSet.id} products: p1=${productId1}, p2=${productId2}, p3=${productId3}`);
                    } else {
                        productId1 = productsInTaskSetResult.rows[0]?.product_id || null; // Primary product for non-combo
                        logger.debug(`assignDriveConfigurationToUser: Non-combo task set ${taskSet.id} product: p1=${productId1}`);
                    }
                } else {
                    logger.warn(`assignDriveConfigurationToUser: Task set ${taskSet.id} (order ${taskSet.order_in_drive}, name '${taskSet.task_set_name}') has no products defined in drive_task_set_products. product_id fields will be null.`);
                }

                const userStatus = i === 0 ? 'CURRENT' : 'PENDING';
                const taskType = taskSet.is_combo ? 'combo_order' : 'single_order';

                const activeItemInsertResult = await client.query(
                    `INSERT INTO user_active_drive_items 
                        (user_id, drive_session_id, product_id_1, product_id_2, product_id_3, 
                         order_in_drive, user_status, task_type, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id`,
                    [userId, newDriveSessionId, productId1, productId2, productId3, 
                     taskSet.order_in_drive, userStatus, taskType]
                );
                
                const insertedItemId = activeItemInsertResult.rows[0]?.id;
                if (!insertedItemId) {
                    await client.query('ROLLBACK');
                    logger.error(`assignDriveConfigurationToUser: CRITICAL_ERROR - Failed to insert user_active_drive_item for task_set ${taskSet.id}. Rollback.`);
                    client.release();
                    return res.status(500).json({ message: 'Failed to create active drive item.' });
                }
                logger.debug(`assignDriveConfigurationToUser: Inserted user_active_drive_item ID: ${insertedItemId} for task_set ${taskSet.id} (order ${taskSet.order_in_drive}), type: ${taskType}`);

                if (i === 0) {
                    firstUserActiveDriveItemId = insertedItemId;
                }
            }

            if (tasksRequired > 0 && !firstUserActiveDriveItemId) {
                await client.query('ROLLBACK');
                logger.error(`assignDriveConfigurationToUser: CRITICAL_ERROR - Drive requires ${tasksRequired} tasks, but firstUserActiveDriveItemId was NOT set. Session ${newDriveSessionId}. Rolling back.`);
                client.release();
                return res.status(500).json({ 
                    message: 'Failed to initialize drive items correctly for a drive that requires tasks.'
                });
            }

            if (firstUserActiveDriveItemId) {
                await client.query(
                    'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                    [firstUserActiveDriveItemId, newDriveSessionId]
                );
                logger.info(`assignDriveConfigurationToUser: Successfully updated drive_session ${newDriveSessionId} with current_user_active_drive_item_id ${firstUserActiveDriveItemId}.`);
            } else {
                logger.info(`assignDriveConfigurationToUser: No firstUserActiveDriveItemId to set for session ${newDriveSessionId} (likely tasksRequired is 0 and no task sets).`);
            }

        } else {
            const sessionId = existingSessionResult.rows[0].id;
            logger.info(`assignDriveConfigurationToUser: User ${userId} already has active session ${sessionId}. Not creating a new one, but assigned_drive_configuration_id in users table is updated.`);
        }

        await client.query('COMMIT'); // Commit transaction
        logger.info(`Admin assigned drive configuration ${drive_configuration_id} to user ${userId}. User's record updated and new session (if applicable) initialized.`);
        res.status(200).json({
            message: 'Drive configuration assigned successfully to user.',
            user: updateUserConfigResult.rows[0],
            drive_session_id: newDriveSessionId || (existingSessionResult.rows.length > 0 ? existingSessionResult.rows[0].id : null),
            first_active_drive_item_id: firstUserActiveDriveItemId // This will be null if an existing session was used or no tasks
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction on error
        logger.error(`Error in assignDriveConfigurationToUser for user ${userId} and config ${drive_configuration_id}:`, error);
        res.status(500).json({ message: 'Failed to assign drive configuration to user', error: error.message });
    } finally {
        if (client) client.release(); // Release client in finally block
    }
};

// --- Tier-Based Drive Assignment ---

// Assign a tier-based Drive Configuration to a user
const assignTierBasedDriveToUser = async (req, res) => {
    const { userId } = req.params;
    let newDriveConfigurationId = null; // Declare here

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        logger.info(`assignTierBasedDriveToUser: Initiating for user ${userId}.`);

        // 1. Fetch user details, including tier
        const userResult = await client.query('SELECT id, username, tier FROM users WHERE id = $1', [userId]); // Changed user_tier_id to tier
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.warn(`assignTierBasedDriveToUser: User ${userId} not found.`);
            return res.status(404).json({ message: 'User not found.' });
        }
        const user = userResult.rows[0];
        const userTierName = user.tier; // Changed userTierId to userTierName

        if (!userTierName) {
            await client.query('ROLLBACK');
            logger.warn(`assignTierBasedDriveToUser: User ${userId} (username: ${user.username}) does not have a tier assigned.`);
            return res.status(400).json({ message: `User ${user.username} does not have a tier assigned. Cannot auto-generate drive.` });
        }        // 2. Fetch tier quantity configuration (case-insensitive)
        const tierConfigResult = await client.query('SELECT * FROM tier_quantity_configs WHERE LOWER(tier_name) = LOWER($1) AND is_active = TRUE', [userTierName]);
        if (tierConfigResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.warn(`assignTierBasedDriveToUser: Tier quantity configuration not found for tier_name ${userTierName}.`);
            return res.status(400).json({ message: 'Tier quantity configuration not found for this user\'s tier.' });
        }
        const tierConfig = tierConfigResult.rows[0];
        const totalTasksRequired = tierConfig.quantity_limit;
        
        // Calculate task distribution (50/50 split between single and combo tasks)
        const num_single_tasks = Math.floor(totalTasksRequired / 2);
        const num_combo_tasks = totalTasksRequired - num_single_tasks;
        
        // Set price ranges based on tier
        const priceRanges = {
            'Bronze': { min_price_single: 1.00, max_price_single: 30.00, min_price_combo: 5.00, max_price_combo: 80.00 },
            'Silver': { min_price_single: 2.00, max_price_single: 50.00, min_price_combo: 10.00, max_price_combo: 120.00 },
            'Gold': { min_price_single: 3.00, max_price_single: 75.00, min_price_combo: 15.00, max_price_combo: 180.00 },
            'Platinum': { min_price_single: 5.00, max_price_single: 100.00, min_price_combo: 20.00, max_price_combo: 250.00 }
        };
        const { min_price_single, max_price_single, min_price_combo, max_price_combo } = priceRanges[userTierName] || priceRanges['Bronze'];

        logger.info(`assignTierBasedDriveToUser: User ${userId} (Tier: ${userTierName}) requires ${num_single_tasks} single tasks and ${num_combo_tasks} combo tasks. Total: ${totalTasksRequired}.`);
        logger.debug(`assignTierBasedDriveToUser: Price ranges - Single: ${min_price_single}-${max_price_single}, Combo: ${min_price_combo}-${max_price_combo}`);        // 3. Create a new Drive Configuration for this tier
        const newConfigName = `Tier ${userTierName} Auto-Config - User ${userId}`;
        const newConfigDescription = `Automatically generated drive configuration for User ID ${userId} based on their tier (${userTierName}). Product selection based on tier quantity rules.`;        const newConfigResult = await client.query(
            `INSERT INTO drive_configurations (name, description, tasks_required, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, TRUE, NOW(), NOW()) RETURNING id`,
            [newConfigName, newConfigDescription, totalTasksRequired]
        );
        newDriveConfigurationId = newConfigResult.rows[0].id; // Assign here
        logger.info(`assignTierBasedDriveToUser: Created new tier-based drive_configuration ${newDriveConfigurationId} for user ${userId}, tier ${userTierName}.`);

        // 4. Select products and create task sets based on tier_quantity_configs
        let orderInDriveCounter = 1;

        // 4. Select and create Drive Task Sets for single tasks
        if (num_single_tasks > 0) {
            const singleProductsResult = await client.query(
                `SELECT id FROM products 
                  WHERE price >= $1 AND price <= $2 AND is_active = TRUE AND is_combo_only = FALSE
                  ORDER BY RANDOM() LIMIT $3`,
                [min_price_single, max_price_single, num_single_tasks]
            );

            if (singleProductsResult.rows.length < num_single_tasks) {
                await client.query('ROLLBACK');
                logger.warn(`assignTierBasedDriveToUser: Not enough suitable single products found for tier ${userTierName}. Found ${singleProductsResult.rows.length}, needed ${num_single_tasks}.`);
                return res.status(400).json({ message: 'Not enough suitable single products found to generate drive configuration for this tier.' });
            }
            logger.debug(`assignTierBasedDriveToUser: Selected ${singleProductsResult.rows.length} single products.`);

            for (const product of singleProductsResult.rows) {
                const taskSetName = `Auto Single Task ${orderInDriveCounter}`;                const taskSetResult = await client.query(
                    'INSERT INTO drive_task_sets (drive_configuration_id, name, order_in_drive, is_combo, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
                    [newDriveConfigurationId, taskSetName, orderInDriveCounter, false]
                );
                const taskSetId = taskSetResult.rows[0].id;

                await client.query(
                    'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, 1, NOW())',
                    [taskSetId, product.id]
                );
                logger.debug(`assignTierBasedDriveToUser: Created single task_set ID ${taskSetId} (${taskSetName}) with product ID ${product.id} at order ${orderInDriveCounter}.`);
                orderInDriveCounter++;
            }
        }

        // 5. Select and create Drive Task Sets for combo tasks
        // For combo tasks, we need to select products that can be part of a combo.
        // The current tier_quantity_configurations doesn't specify how many products per combo.
        // Assuming a combo task uses 2-3 products. For simplicity, let's aim for 2 products per combo for now.
        // This logic might need refinement based on how combo products are defined (e.g., specific "combo_package" products or just regular products grouped).
        // For now, let's assume a "combo task" means a task_set with is_combo=TRUE, and it will contain multiple products.
        // We will pick products within the combo price range.
        
        if (num_combo_tasks > 0) {
            // Fetch products suitable for combos. This might need a flag like 'can_be_in_combo' or rely on 'is_combo_only = TRUE' or a broader price range.
            // For this example, let's assume any product in the combo price range can be part of a combo.
            // We'll pick 2 products per combo task.
            const productsPerCombo = 2; // Define how many products per combo task
            const totalComboProductsNeeded = num_combo_tasks * productsPerCombo;

            const comboProductsResult = await client.query(
                `SELECT id FROM products 
                  WHERE price >= $1 AND price <= $2 AND is_active = TRUE 
                  ORDER BY RANDOM() LIMIT $3`,
                [min_price_combo, max_price_combo, totalComboProductsNeeded]
            );

            if (comboProductsResult.rows.length < totalComboProductsNeeded) {
                await client.query('ROLLBACK');
                logger.warn(`assignTierBasedDriveToUser: Not enough suitable products found for combo tasks for tier ${userTierName}. Found ${comboProductsResult.rows.length}, needed ${totalComboProductsNeeded}.`);
                return res.status(400).json({ message: 'Not enough suitable products found to generate combo tasks for this tier.' });
            }
            logger.debug(`assignTierBasedDriveToUser: Selected ${comboProductsResult.rows.length} products for ${num_combo_tasks} combo tasks.`);            for (let i = 0; i < num_combo_tasks; i++) {
                const taskSetName = `Auto Combo Task ${orderInDriveCounter}`;
                const taskSetResult = await client.query(
                    'INSERT INTO drive_task_sets (drive_configuration_id, name, order_in_drive, is_combo, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
                    [newDriveConfigurationId, taskSetName, orderInDriveCounter, true]
                );
                const taskSetId = taskSetResult.rows[0].id;
                logger.debug(`assignTierBasedDriveToUser: Created combo task_set ID ${taskSetId} (${taskSetName}) at order ${orderInDriveCounter}.`);

                for (let j = 0; j < productsPerCombo; j++) {
                    const productIndex = i * productsPerCombo + j;
                    if (comboProductsResult.rows[productIndex]) {
                        const productId = comboProductsResult.rows[productIndex].id;
                        await client.query(
                            'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, $3, NOW())',
                            [taskSetId, productId, j + 1] // order_in_set is 1-based
                        );
                        logger.debug(`assignTierBasedDriveToUser: Added product ID ${productId} to combo task_set ID ${taskSetId} at order_in_set ${j + 1}.`);
                    } else {
                        // This case should ideally not be hit if totalComboProductsNeeded was met
                        logger.error(`assignTierBasedDriveToUser: Ran out of products for combo task ${taskSetId} unexpectedly.`);
                    }
                }
                orderInDriveCounter++;
            }
        }
        
        // 6. Now that the drive_configuration and its task_sets are created,
        //    call a modified version of assignDriveConfigurationToUser or reuse its core logic
        //    to create the drive_session and user_active_drive_items.

        // For simplicity, we'll replicate the relevant parts of assignDriveConfigurationToUser's session/item creation logic here.
        // This avoids issues with res.json() being called multiple times if we directly call it.

        // 6a. Update user's assigned_drive_configuration_id
        await client.query(
            'UPDATE users SET assigned_drive_configuration_id = $1 WHERE id = $2',
            [newDriveConfigurationId, userId]
        );
        logger.info(`assignTierBasedDriveToUser: Updated user ${userId} assigned_drive_configuration_id to ${newDriveConfigurationId}.`);

        // 6b. Create new drive_session (always create a new one for auto-assignment, replacing any old active one)
        // First, mark any existing active/pending_reset/frozen sessions for this user as 'replaced' or 'ended'
        const updateOldSessionsResult = await client.query(
            `UPDATE drive_sessions 
             SET status = 'completed', ended_at = NOW(), notes = COALESCE(notes, '') || 'Replaced by auto-tier assignment on ' || NOW()
             WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
             RETURNING id`,
            [userId]
        );
        if (updateOldSessionsResult.rowCount > 0) {
            logger.info(`assignTierBasedDriveToUser: Marked ${updateOldSessionsResult.rowCount} old session(s) as 'completed' for user ${userId}.`);
        }


        const sessionInsertResult = await client.query(
            `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at, notes)
             VALUES ($1, $2, 'active', $3, NOW(), NOW(), $4) RETURNING id`,
            [userId, newDriveConfigurationId, totalTasksRequired, `Auto-generated for tier ${userTierName}`]
        );
        const newDriveSessionId = sessionInsertResult.rows[0].id;
        logger.info(`assignTierBasedDriveToUser: New drive_session created with ID: ${newDriveSessionId} for user ${userId}, config ID: ${newDriveConfigurationId}`);

        // 6c. Create user_active_drive_items
        const driveTaskSetsResult = await client.query(
            `SELECT id, order_in_drive, is_combo, name as task_set_name 
             FROM drive_task_sets 
             WHERE drive_configuration_id = $1 
             ORDER BY order_in_drive ASC`,
            [newDriveConfigurationId]
        );

        let firstUserActiveDriveItemId = null;
        for (let i = 0; i < driveTaskSetsResult.rows.length; i++) {
            const taskSet = driveTaskSetsResult.rows[i];
            const productsInTaskSetResult = await client.query(
                `SELECT product_id, order_in_set 
                 FROM drive_task_set_products 
                 WHERE task_set_id = $1 
                 ORDER BY order_in_set ASC`,
                [taskSet.id]
            );

            let productId1 = null, productId2 = null, productId3 = null;
            if (productsInTaskSetResult.rows.length > 0) {
                if (taskSet.is_combo) {
                    productId1 = productsInTaskSetResult.rows[0]?.product_id || null;
                    productId2 = productsInTaskSetResult.rows[1]?.product_id || null;
                    productId3 = productsInTaskSetResult.rows[2]?.product_id || null;
                } else {
                    productId1 = productsInTaskSetResult.rows[0]?.product_id || null;
                }
            }

            const userStatus = i === 0 ? 'CURRENT' : 'PENDING';
            const taskType = taskSet.is_combo ? 'combo_order' : 'single_order';

            const activeItemInsertResult = await client.query(
                `INSERT INTO user_active_drive_items 
                    (user_id, drive_session_id, product_id_1, product_id_2, product_id_3, 
                     order_in_drive, user_status, task_type, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id`,
                [userId, newDriveSessionId, productId1, productId2, productId3, 
                 taskSet.order_in_drive, userStatus, taskType]
            );
            
            const insertedItemId = activeItemInsertResult.rows[0]?.id;
            if (!insertedItemId) {
                await client.query('ROLLBACK');
                logger.error(`assignTierBasedDriveToUser: CRITICAL_ERROR - Failed to insert user_active_drive_item for task_set ${taskSet.id}. Rollback.`);
                return res.status(500).json({ message: 'Failed to create active drive item during auto-assignment.' });
            }
            if (i === 0) firstUserActiveDriveItemId = insertedItemId;
        }

        if (totalTasksRequired > 0 && !firstUserActiveDriveItemId) {
            await client.query('ROLLBACK');
            logger.error(`assignTierBasedDriveToUser: CRITICAL_ERROR - Drive requires ${totalTasksRequired} tasks, but firstUserActiveDriveItemId was NOT set for session ${newDriveSessionId}. Rolling back.`);
            return res.status(500).json({ message: 'Failed to initialize drive items correctly for a drive that requires tasks.' });
        }

        if (firstUserActiveDriveItemId) {
            await client.query(
                'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                [firstUserActiveDriveItemId, newDriveSessionId]
            );
            logger.info(`assignTierBasedDriveToUser: Successfully updated drive_session ${newDriveSessionId} with current_user_active_drive_item_id ${firstUserActiveDriveItemId}.`);
        }        await client.query('COMMIT');
        logger.info(`assignTierBasedDriveToUser: Successfully generated and assigned tier-based drive for user ${userId}. New config ID: ${newDriveConfigurationId}, New session ID: ${newDriveSessionId}.`);
        res.status(201).json({
            success: true,
            message: 'Tier-based drive configuration generated and assigned successfully!',
            drive_configuration_id: newDriveConfigurationId,
            drive_session_id: newDriveSessionId,
            first_active_drive_item_id: firstUserActiveDriveItemId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`assignTierBasedDriveToUser: Error for user ${userId} and config ${newDriveConfigurationId || 'not generated'}:`, error); // Use newDriveConfigurationId here
        res.status(500).json({ message: 'Failed to assign tier-based drive configuration.', error: error.message });
    } finally {
        client.release();
    }
};

// --- Tier Quantity Configuration ---

// Get Tier Quantity Configurations
const getTierQuantityConfigs = async (req, res) => {
    try {
        const result = await pool.query('SELECT tqc.*, ut.name as tier_name FROM tier_quantity_configs tqc JOIN user_tiers ut ON tqc.tier_id = ut.id ORDER BY ut.id');
        res.status(200).json(result.rows);
    } catch (error) {
        logger.error('Error fetching tier quantity configurations:', error);
        res.status(500).json({ message: 'Failed to fetch tier quantity configurations', error: error.message });
    }
};

// Update Tier Quantity Configurations
const updateTierQuantityConfigs = async (req, res) => {
    const configs = req.body; // Expecting an array of { tier_id, num_single_tasks, ... }

    if (!Array.isArray(configs) || configs.length === 0) {
        return res.status(400).json({ message: 'Request body must be an array of configurations.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const config of configs) {
            const {
                tier_id,
                num_single_tasks,
                num_combo_tasks,
                min_price_single,
                max_price_single,
                min_price_combo,
                max_price_combo
            } = config;

            // Validate data types and presence
            if (tier_id === undefined || num_single_tasks === undefined || num_combo_tasks === undefined ||
                min_price_single === undefined || max_price_single === undefined ||
                min_price_combo === undefined || max_price_combo === undefined) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Missing fields for tier_id ${tier_id}. All fields are required.` });
            }
            
            // Add more specific validation if needed (e.g., numbers are positive)

            await client.query(
                `UPDATE tier_quantity_configs 
                 SET num_single_tasks = $1, num_combo_tasks = $2, 
                     min_price_single = $3, max_price_single = $4, 
                     min_price_combo = $5, max_price_combo = $6,
                     updated_at = NOW()
                 WHERE tier_id = $7`,
                [
                    num_single_tasks, num_combo_tasks,
                    min_price_single, max_price_single,
                    min_price_combo, max_price_combo,
                    tier_id
                ]
            );
        }
        await client.query('COMMIT');
        logger.info('Tier quantity configurations updated successfully.');
        res.status(200).json({ message: 'Tier quantity configurations updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error updating tier quantity configurations:', error);
        res.status(500).json({ message: 'Failed to update tier quantity configurations', error: error.message });
    } finally {
        client.release();
    }
};

// Add the missing functions getUserDriveProgress, createBalanceBasedConfiguration, getBalanceBasedProducts, validateBalanceConfig, insertComboToTaskSet, getAvailableComboSlots, addComboToActiveItem

const getUserDriveProgress = async (req, res) => {
    const { userId } = req.params;
    try {
        // Find the latest active or pending_reset session for the user
        const sessionRes = await pool.query(
            `SELECT id, drive_configuration_id, tasks_required, tasks_completed 
             FROM drive_sessions 
             WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionRes.rows.length === 0) {
            return res.status(404).json({ message: 'No active drive session found for this user.' });
        }
        const session = sessionRes.rows[0];

        // Get details of the drive configuration
        const configRes = await pool.query(
            'SELECT name FROM drive_configurations WHERE id = $1',
            [session.drive_configuration_id]
        );
        const configName = configRes.rows.length > 0 ? configRes.rows[0].name : 'Unknown Configuration';

        // Get task items (user_active_drive_items) for this session with product details
        const taskItemsRes = await pool.query(
            `SELECT 
                uadi.id,
                uadi.order_in_drive,
                uadi.user_status,
                uadi.product_id_1,
                uadi.product_id_2,
                uadi.product_id_3,
                p1.name AS product_1_name,
                p1.price AS product_1_price,
                p2.name AS product_2_name,
                p2.price AS product_2_price,
                p3.name AS product_3_name,
                p3.price AS product_3_price
             FROM user_active_drive_items uadi
             LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
             LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
             LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
             WHERE uadi.drive_session_id = $1
             ORDER BY uadi.order_in_drive ASC`,
            [session.id]
        );

        // Count completed tasks
        const completedTasks = taskItemsRes.rows.filter(item => item.user_status === 'COMPLETED').length;
        const totalTasks = taskItemsRes.rows.length;

        res.status(200).json({
            drive_session_id: session.id,
            drive_configuration_id: session.drive_configuration_id,
            drive_configuration_name: configName,
            tasks_required: session.tasks_required,
            tasks_completed: session.tasks_completed,
            completed_task_items: completedTasks,
            total_task_items: totalTasks,
            task_items: taskItemsRes.rows,
            progress_percentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        });

    } catch (error) {
        logger.error(`Error fetching drive progress for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch drive progress', error: error.message });
    }
};

const createBalanceBasedConfiguration = async (req, res) => {
    const { userId, products, totalAmount, configName } = req.body;

    if (!userId || !products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: 'userId, products array, and other required fields are mandatory.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create the drive configuration
        const driveConfigResult = await client.query(
            `INSERT INTO drive_configurations (name, description, tasks_required, is_active, created_at, updated_at, is_auto_generated, associated_user_id) 
             VALUES ($1, $2, $3, TRUE, NOW(), NOW(), TRUE, $4) RETURNING id`,
            [configName, `Balance-based config for user ${userId}`, products.length, userId]
        );
        const newDriveConfigurationId = driveConfigResult.rows[0].id;

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const taskSetName = `Task ${i + 1} for ${configName}`;
            const taskSetResult = await client.query(
                'INSERT INTO drive_task_sets (drive_configuration_id, name, order_in_drive, is_combo, created_at) VALUES ($1, $2, $3, FALSE, NOW()) RETURNING id',
                [newDriveConfigurationId, taskSetName, i + 1]
            );
            const taskSetId = taskSetResult.rows[0].id;

            await client.query(
                'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, price_override, created_at) VALUES ($1, $2, 1, $3, NOW())',
                [taskSetId, product.id, product.price_override || product.price] // Use price_override if available
            );
        }
          // Assign this new configuration to the user and create a session
        // This part reuses logic from assignDriveConfigurationToUser
        await client.query(
            'UPDATE users SET assigned_drive_configuration_id = $1 WHERE id = $2',
            [newDriveConfigurationId, userId]
        );
        
        const updateOldSessionsResult = await client.query(
            `UPDATE drive_sessions 
             SET status = 'completed', ended_at = NOW(), notes = COALESCE(notes, '') || 'Replaced by balance-based config on ' || NOW()
             WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
             RETURNING id`,
            [userId]
        );
         if (updateOldSessionsResult.rowCount > 0) {
            logger.info(`createBalanceBasedConfiguration: Marked ${updateOldSessionsResult.rowCount} old session(s) as 'completed' for user ${userId}.`);
        }


        const sessionInsertResult = await client.query(
            `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at, notes)
             VALUES ($1, $2, 'active', $3, NOW(), NOW(), $4) RETURNING id`,
            [userId, newDriveConfigurationId, products.length, `Balance-based for ${configName}`]
        );
        const newDriveSessionId = sessionInsertResult.rows[0].id;

        const driveTaskSetsResult = await client.query(
            `SELECT id, order_in_drive, is_combo FROM drive_task_sets 
             WHERE drive_configuration_id = $1 ORDER BY order_in_drive ASC`,
            [newDriveConfigurationId]
        );

        let firstUserActiveDriveItemId = null;
        for (let i = 0; i < driveTaskSetsResult.rows.length; i++) {
            const taskSet = driveTaskSetsResult.rows[i];
            const productsInTaskSetResult = await client.query(
                `SELECT product_id, order_in_set 
                 FROM drive_task_set_products 
                 WHERE task_set_id = $1 
                 ORDER BY order_in_set ASC`,
                [taskSet.id]
            );
            
            const productId1 = productsInTaskSetResult.rows[0]?.product_id || null;
            const userStatus = i === 0 ? 'CURRENT' : 'PENDING';
            const taskType = taskSet.is_combo ? 'combo_order' : 'single_order';            
            const activeItemInsertResult = await client.query(
                `INSERT INTO user_active_drive_items 
                    (user_id, drive_session_id, product_id_1, order_in_drive, user_status, task_type, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
                [userId, newDriveSessionId, productId1, taskSet.order_in_drive, userStatus, taskType]
            );
            
            if (i === 0) {
                firstUserActiveDriveItemId = activeItemInsertResult.rows[0]?.id;
            }
        }

        if (products.length > 0 && !firstUserActiveDriveItemId) {
            await client.query('ROLLBACK');
            return res.status(500).json({ message: 'Failed to initialize drive items for balance-based config.' });
        }
        if (firstUserActiveDriveItemId) {
            await client.query(
                'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                [firstUserActiveDriveItemId, newDriveSessionId]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: 'Balance-based drive configuration created and assigned successfully.',
            drive_configuration_id: newDriveConfigurationId,
            drive_session_id: newDriveSessionId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating balance-based drive configuration:', error);
        res.status(500).json({ message: 'Failed to create balance-based configuration', error: error.message });
    } finally {
        client.release();
    }
};

const getBalanceBasedProducts = async (req, res) => {
    const { userId } = req.params;
    const { desired_sum } = req.query; // Get desired_sum from query parameters

    if (!userId || !desired_sum) {
        return res.status(400).json({ message: 'User ID and desired_sum (query parameter) are required.' });
    }

    const targetSum = parseFloat(desired_sum);
    if (isNaN(targetSum) || targetSum <= 0) {
        return res.status(400).json({ message: 'desired_sum must be a positive number.' });
    }
    
    logger.info(`getBalanceBasedProducts called for userId: ${userId}, desired_sum: ${targetSum}`);

    try {
        const user = await pool.query('SELECT id, user_tier_id FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const userTierId = user.rows[0].user_tier_id;

        if (!userTierId) {
             return res.status(400).json({ message: 'User does not have an assigned tier. Cannot determine product price limits.' });
        }

        const tierConfig = await pool.query('SELECT min_price_single, max_price_single FROM tier_quantity_configs WHERE tier_id = $1', [userTierId]);
        if (tierConfig.rows.length === 0) {
            return res.status(400).json({ message: 'Tier configuration not found for user\\\'s tier. Cannot determine product price limits.' });
        }
        const { min_price_single, max_price_single } = tierConfig.rows[0];
        
        logger.debug(`User ${userId} (Tier ID: ${userTierId}) price limits for single products: ${min_price_single} - ${max_price_single}`);


        // Call the service function
        const products = await balanceBasedFilterService.selectProductsForSum(
            userId, 
            targetSum, 
            parseFloat(min_price_single), // Ensure these are numbers
            parseFloat(max_price_single)  // Ensure these are numbers
        );

        if (!products || products.length === 0) {
            return res.status(404).json({ message: 'No suitable products found to match the desired sum within the user\\\'s tier price range.' });
        }
        
        const actualSum = products.reduce((sum, p) => sum + parseFloat(p.price_override || p.price), 0);
        logger.info(`getBalanceBasedProducts: Found ${products.length} products for user ${userId} with actual sum ${actualSum.toFixed(2)} (target: ${targetSum})`);

        res.status(200).json({
            products: products,
            actual_sum: parseFloat(actualSum.toFixed(2)), // Ensure it's a number
            target_sum: targetSum
        });

    } catch (error) {
        logger.error(`Error in getBalanceBasedProducts for user ${userId}:`, error);
        if (error.message.includes("No products found in the specified price range")) {
             return res.status(404).json({ message: 'No products available within your tier\\\'s price range to fulfill the request.' });
        }
        res.status(500).json({ message: 'Failed to get balance-based products', error: error.message });
    }
};

const validateBalanceConfig = async (req, res) => {
    const { userId, products } = req.body;

    if (!userId || !products || !Array.isArray(products)) {
        return res.status(400).json({ message: 'User ID and products array are required.' });
    }

    try {
        const user = await pool.query('SELECT id, user_tier_id FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const userTierId = user.rows[0].user_tier_id;

        if (!userTierId) {
            return res.status(400).json({ message: 'User does not have an assigned tier.' });
        }

        const tierConfig = await pool.query(
            'SELECT min_price_single, max_price_single FROM tier_quantity_configs WHERE tier_id = $1',
            [userTierId]
        );

        if (tierConfig.rows.length === 0) {
            return res.status(400).json({ message: 'Tier configuration not found for user\\\'s tier.' });
        }
        const { min_price_single, max_price_single } = tierConfig.rows[0];

        for (const product of products) {
            const productPrice = parseFloat(product.price_override || product.price);
            if (productPrice < parseFloat(min_price_single) || productPrice > parseFloat(max_price_single)) {
                return res.status(400).json({
                    message: `Product '${product.name}' (Price: ${productPrice}) is outside the allowed price range (${min_price_single} - ${max_price_single}) for the user's tier.`,
                    valid: false
                });
            }
        }

        res.status(200).json({ message: 'Product selection is valid for the user\\\'s tier.', valid: true });

    } catch (error) {
        logger.error('Error validating balance config:', error);
        res.status(500).json({ message: 'Failed to validate balance configuration', error: error.message, valid: false });
    }
};

const insertComboToTaskSet = async (req, res) => {
    const { task_set_id, product_ids, order_in_drive } = req.body;

    if (!task_set_id || !Array.isArray(product_ids) || product_ids.length === 0 || product_ids.length > 3 || order_in_drive === undefined) {
        return res.status(400).json({ message: 'task_set_id, product_ids (array of 1-3 IDs), and order_in_drive are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if task_set_id exists and is a combo task set
        const taskSetCheck = await client.query('SELECT is_combo, drive_configuration_id FROM drive_task_sets WHERE id = $1', [task_set_id]);
        if (taskSetCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Task set not found.' });
        }
        if (!taskSetCheck.rows[0].is_combo) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'This task set is not a combo task set. Products must be added individually.' });
        }
        const driveConfigurationId = taskSetCheck.rows[0].drive_configuration_id;

        // Verify all products exist
        for (const productId of product_ids) {
            const productExists = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
            if (productExists.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: `Product with ID ${productId} not found.` });
            }
        }
        
        // Remove existing products from this combo task set to replace them
        await client.query('DELETE FROM drive_task_set_products WHERE task_set_id = $1', [task_set_id]);

        // Insert new products
        for (let i = 0; i < product_ids.length; i++) {
            await client.query(
                'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, $3, NOW())',
                [task_set_id, product_ids[i], i + 1]
            );
        }
        
        // Update order_in_drive for the task set itself
        await client.query('UPDATE drive_task_sets SET order_in_drive = $1 WHERE id = $2', [order_in_drive, task_set_id]);

        await client.query('COMMIT');
        logger.info(`Combo products ${product_ids.join(',')} inserted into task set ${task_set_id} for drive config ${driveConfigurationId}`);
        res.status(201).json({ message: 'Combo products inserted successfully into task set.' });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error inserting combo to task set:', error);
        res.status(500).json({ message: 'Failed to insert combo products', error: error.message });
    } finally {
        client.release();
    }
};

const getAvailableComboSlots = async (req, res) => {
    const { taskSetId } = req.params;
    try {
        const taskSet = await pool.query('SELECT is_combo FROM drive_task_sets WHERE id = $1', [taskSetId]);
        if (taskSet.rows.length === 0) {
            return res.status(404).json({ message: 'Task set not found.' });
        }
        if (!taskSet.rows[0].is_combo) {
            return res.status(400).json({ message: 'This task set is not designated for combos.' });
        }

        const productsInSet = await pool.query('SELECT COUNT(*) as count FROM drive_task_set_products WHERE task_set_id = $1', [taskSetId]);
        const currentProductCount = parseInt(productsInSet.rows[0].count, 10);
        
        // Assuming max 3 products per combo
        const maxSlots = 3;
        const availableSlots = maxSlots - currentProductCount;

        res.status(200).json({
            task_set_id: taskSetId,
            current_product_count: currentProductCount,
            available_slots: availableSlots > 0 ? availableSlots : 0,
            max_slots: maxSlots
        });
    } catch (error) {
        logger.error(`Error getting available combo slots for task set ${taskSetId}:`, error);
        res.status(500).json({ message: 'Failed to get available combo slots', error: error.message });
    }
};

const addComboToActiveItem = async (req, res) => {
    const { itemId } = req.params; // This is user_active_drive_items.id
    const { product_id_1, product_id_2, product_id_3 } = req.body;

    // Basic validation: at least product_id_1 must be present for a combo.
    if (!product_id_1) {
        return res.status(400).json({ message: 'At least product_id_1 is required to define a combo for the active item.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch the active item to ensure it exists and is a combo type
        const activeItemRes = await client.query(
            "SELECT id, task_type, user_id, drive_session_id FROM user_active_drive_items WHERE id = $1 AND task_type = 'combo_order' FOR UPDATE",
            [itemId]
        );

        if (activeItemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active drive item not found or is not a combo type task.' });
        }
        const activeItem = activeItemRes.rows[0];

        // Validate product IDs if they are provided (they should exist in products table)
        const productIdsToValidate = [product_id_1, product_id_2, product_id_3].filter(id => id != null);
        if (productIdsToValidate.length > 0) {
            const productCheckQuery = `SELECT id FROM products WHERE id = ANY($1::int[])`;
            const productCheckRes = await client.query(productCheckQuery, [productIdsToValidate]);
            if (productCheckRes.rows.length !== productIdsToValidate.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'One or more provided product IDs are invalid or do not exist.' });
            }
        }
        
        // Update the user_active_drive_item with the new combo product IDs
        const updateRes = await client.query(
            `UPDATE user_active_drive_items 
             SET product_id_1 = $1, product_id_2 = $2, product_id_3 = $3, updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [product_id_1, product_id_2 || null, product_id_3 || null, itemId]
        );

        await client.query('COMMIT');
        logger.info(`Admin added/updated combo products for active drive item ${itemId}. User: ${activeItem.user_id}, Session: ${activeItem.drive_session_id}`);
        res.status(200).json({ 
            message: 'Combo products successfully added/updated for the active drive item.',
            updated_item: updateRes.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error adding combo to active item ${itemId}:`, error);
        res.status(500).json({ message: 'Failed to add/update combo products for active item', error: error.message });
    } finally {
        client.release();
    }
};

// Enhanced Combo Creation - Add combo products to existing task sets
const addComboToUserDrive = async (req, res) => {
    const { userId } = req.params;
    const { comboName, comboDescription, productIds, insertAfterTaskSetId, insertAtOrder } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ 
            success: false,
            message: 'productIds (array) is required.' 
        });
    }

    if (productIds.length > 2) {
        return res.status(400).json({ 
            success: false,
            message: 'Maximum 2 additional products allowed per task set (1 original + 2 combo = 3 total).' 
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verify user exists and has an active drive session
        const userResult = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const sessionResult = await client.query(
            `SELECT id, drive_configuration_id FROM drive_sessions 
             WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen') 
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false,
                message: 'No active drive session found for this user.' 
            });
        }

        const { id: driveSessionId, drive_configuration_id: driveConfigId } = sessionResult.rows[0];

        // 2. Verify all products exist
        for (const productId of productIds) {
            const productExists = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
            if (productExists.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    success: false,
                    message: `Product with ID ${productId} not found.` 
                });
            }
        }

        // 3. Find the target task set to add products to
        let targetTaskSetId = null;
        let targetActiveItemId = null;        if (insertAfterTaskSetId) {
            // Find the user's active drive item that corresponds to the specified task set
            const targetItemResult = await client.query(
                `SELECT uadi.id as active_item_id, uadi.order_in_drive
                 FROM user_active_drive_items uadi
                 WHERE uadi.id = $1 AND uadi.drive_session_id = $2`,
                [insertAfterTaskSetId, driveSessionId]
            );

            if (targetItemResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    success: false,
                    message: 'Target task item not found in user\'s drive.' 
                });
            }

            targetActiveItemId = targetItemResult.rows[0].active_item_id;            // Find the associated task set for this active item
            // We need to properly match the active item to its original task set
            const taskSetResult = await client.query(
                `SELECT dts.id, dts.name, 
                        (SELECT COUNT(*) FROM drive_task_set_products WHERE task_set_id = dts.id) as current_product_count
                 FROM drive_task_sets dts
                 WHERE dts.drive_configuration_id = $2
                   AND dts.order_in_drive = (SELECT order_in_drive FROM user_active_drive_items WHERE id = $1)
                 LIMIT 1`,
                [targetActiveItemId, driveConfigId]
            );

            if (taskSetResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ 
                    success: false,
                    message: 'Could not find associated task set for the target item.' 
                });
            }

            const taskSet = taskSetResult.rows[0];
            const currentProductCount = parseInt(taskSet.current_product_count);

            // Check if task set has available capacity
            if (currentProductCount + productIds.length > 3) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    message: `Task set "${taskSet.name}" already has ${currentProductCount} product(s). Cannot add ${productIds.length} more (max 3 products per task set).` 
                });
            }

            targetTaskSetId = taskSet.id;

        } else {
            // Find any existing task set with available capacity
            const availableTaskSetResult = await client.query(
                `SELECT dts.id, dts.name, 
                        (SELECT COUNT(*) FROM drive_task_set_products WHERE task_set_id = dts.id) as current_product_count
                 FROM drive_task_sets dts
                 WHERE dts.drive_configuration_id = $1
                 HAVING (SELECT COUNT(*) FROM drive_task_set_products WHERE task_set_id = dts.id) + $2 <= 3
                 ORDER BY dts.order_in_drive ASC
                 LIMIT 1`,
                [driveConfigId, productIds.length]
            );

            if (availableTaskSetResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false,
                    message: 'No existing task sets have enough capacity for the combo products. All task sets are at maximum capacity (3 products).' 
                });
            }

            targetTaskSetId = availableTaskSetResult.rows[0].id;
        }

        // 4. Get current product count for the target task set
        const currentProductsResult = await client.query(
            'SELECT MAX(order_in_set) as max_order FROM drive_task_set_products WHERE task_set_id = $1',
            [targetTaskSetId]
        );
        
        const currentMaxOrder = currentProductsResult.rows[0].max_order || 0;

        // 5. Add combo products to the existing task set
        const addedProductIds = [];
        for (let i = 0; i < productIds.length; i++) {
            const newOrder = currentMaxOrder + i + 1;
            await client.query(
                'INSERT INTO drive_task_set_products (task_set_id, product_id, order_in_set, created_at) VALUES ($1, $2, $3, NOW())',
                [targetTaskSetId, productIds[i], newOrder]
            );
            addedProductIds.push(productIds[i]);
        }

        // 6. Update the user's active drive item to include the new combo products
        if (targetActiveItemId) {
            // Get current product configuration
            const currentItemResult = await client.query(
                'SELECT product_id_1, product_id_2, product_id_3 FROM user_active_drive_items WHERE id = $1',
                [targetActiveItemId]
            );
            
            if (currentItemResult.rows.length > 0) {
                const currentItem = currentItemResult.rows[0];
                
                // Build new product configuration (preserve existing, add new)
                const newProductId2 = currentItem.product_id_2 || productIds[0] || null;
                const newProductId3 = currentItem.product_id_3 || productIds[1] || (productIds.length === 1 ? null : productIds[1]);

                // Update the active item with combo products
                await client.query(
                    `UPDATE user_active_drive_items 
                     SET product_id_2 = $1, product_id_3 = $2, task_type = 'combo_order', updated_at = NOW()
                     WHERE id = $3`,
                    [newProductId2, newProductId3, targetActiveItemId]
                );
            }
        }

        // 7. Mark the task set as a combo if it now has multiple products
        const finalProductCountResult = await client.query(
            'SELECT COUNT(*) as count FROM drive_task_set_products WHERE task_set_id = $1',
            [targetTaskSetId]
        );
        
        const finalProductCount = parseInt(finalProductCountResult.rows[0].count);
        
        if (finalProductCount > 1) {
            await client.query(
                'UPDATE drive_task_sets SET is_combo = true WHERE id = $1',
                [targetTaskSetId]
            );
        }

        await client.query('COMMIT');
        
        logger.info(`Combo products ${productIds.join(',')} added to existing task set ${targetTaskSetId} for user ${userId}. Active item: ${targetActiveItemId}`);
        
        res.status(201).json({
            success: true,
            message: 'Combo products added to existing task set successfully!',
            data: {
                taskSetId: targetTaskSetId,
                activeItemId: targetActiveItemId,
                addedProductIds: addedProductIds,
                finalProductCount: finalProductCount,
                driveSessionId: driveSessionId
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error adding combo to user ${userId}'s drive:`, error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to add combo to user\'s drive', 
            error: error.message 
        });
    } finally {
        client.release();
    }
};


module.exports = {
    createDriveConfiguration,
    getDriveConfigurations,
    getDriveConfigurationById,
    updateDriveConfiguration,
    deleteDriveConfiguration,
    getProductsForConfiguration,
    createDriveTaskSet,
    getTaskSetsForConfiguration,
    getDriveTaskSetById,
    updateDriveTaskSet,
    deleteDriveTaskSet,
    addProductToTaskSet,
    getProductsForTaskSet,
    getDriveTaskSetProductById,
    updateProductInTaskSet,
    removeProductFromTaskSet,
    assignDriveToUser,
    getActiveDriveItemsForUser,
    assignDriveConfigurationToUser,
    assignTierBasedDriveToUser,
    getUserDriveProgress,
    createBalanceBasedConfiguration,
    getBalanceBasedProducts,
    validateBalanceConfig,
    insertComboToTaskSet,
    getAvailableComboSlots,
    addComboToActiveItem,
    addComboToUserDrive,
    getTierQuantityConfigs, 
    updateTierQuantityConfigs
};



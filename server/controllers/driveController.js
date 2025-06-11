const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const { calculateCommission } = require('../utils/commission');
const { logDriveOperation } = require('../utils/driveLogger');
const driveProgressService = require('../services/driveProgressService');
const tierCommissionService = require('../services/tierCommissionService');

// --- Helper Functions ---
async function getUserDriveInfo(userId, client = pool) { // Added client parameter
  const userResult = await client.query('SELECT tier FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) throw new Error('User not found');
  const tier = userResult.rows[0].tier || 'bronze';  const accountResult = await client.query(
    'SELECT balance FROM accounts WHERE user_id = $1 AND type = $2',
    [userId, 'main']
  );
  const balance = accountResult.rows.length > 0 ? parseFloat(accountResult.rows[0].balance) : 0;
  return { tier, balance };
}

async function getAvailableProduct(userId, tier, balance) {
  const query = 'SELECT * FROM products WHERE is_active = true ORDER BY RANDOM() LIMIT 1';
  const productsResult = await pool.query(query);
  if (productsResult.rows.length === 0) return null;
  return productsResult.rows[0];
}

// --- Controller Functions ---
const startDrive = async (req, res) => {
    const userId = req.user.id;
    logger.debug(`Entering startDrive for user ID: ${userId} (sequential combo processing)`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check for existing active, pending_reset, or frozen drive_sessions
        let existingSessionResult = await client.query(
            `SELECT ds.id, ds.status, ds.drive_configuration_id, ds.current_user_active_drive_item_id
             FROM drive_sessions ds
             WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
             ORDER BY ds.started_at DESC LIMIT 1`,
            [userId]
        );
        
        if (existingSessionResult.rows.length > 0) {
            const existingSession = existingSessionResult.rows[0];
            await client.query('ROLLBACK');
            logger.warn(`User ${userId} attempted to start a new drive, but a session (status: ${existingSession.status}) already exists.`);
            return res.status(200).json({ 
                code: 0, // Consistent with successful status check
                message: `A drive session (status: ${existingSession.status}) is already assigned. Please continue.`,
                existing_session: true,
                session_id: existingSession.id,
                status: existingSession.status, // Return current status
                drive_configuration_id: existingSession.drive_configuration_id,
                current_user_active_drive_item_id: existingSession.current_user_active_drive_item_id
            });
        }

        // 2. Check if user has an assigned_drive_configuration_id
        const userConfigResult = await client.query(
            'SELECT assigned_drive_configuration_id FROM users WHERE id = $1',
            [userId]
        );
        
        if (!userConfigResult.rows.length || !userConfigResult.rows[0].assigned_drive_configuration_id) {
            await client.query('ROLLBACK');
            logger.info(`User ${userId} has no assigned drive configuration.`);
            return res.status(403).json({ message: 'No drive configuration assigned. Please contact an administrator.' });
        }
        const configId = userConfigResult.rows[0].assigned_drive_configuration_id;

        // 3. Get configuration details (tasks_required refers to total task_sets)
        const configResult = await client.query(
            'SELECT tasks_required FROM drive_configurations WHERE id = $1 AND is_active = TRUE',
            [configId]
        );
        if (configResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Assigned drive configuration is not active or not found.' });
        }
        const totalTaskSetsInDrive = configResult.rows[0].tasks_required;

        // 4. Create new drive_session
        const sessionInsertResult = await client.query(
            `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at)
             VALUES ($1, $2, 'active', $3, NOW(), NOW()) RETURNING id`,
            [userId, configId, totalTaskSetsInDrive]
        );
        const newDriveSessionId = sessionInsertResult.rows[0].id;
        logger.info(`startDrive: New drive_session ID: ${newDriveSessionId} for user ${userId}, config ${configId}`);

        // 5. Populate user_active_drive_items based on the drive_configuration
        // This involves fetching task_sets and their products
        const taskSetsResult = await client.query(
            `SELECT ts.id as task_set_id, ts.is_combo, ts.order_in_drive,
                    (SELECT array_agg(tsp.product_id ORDER BY tsp.order_in_set ASC) 
                     FROM drive_task_set_products tsp 
                     WHERE tsp.task_set_id = ts.id) as product_ids_in_set
             FROM drive_task_sets ts
             WHERE ts.drive_configuration_id = $1
             ORDER BY ts.order_in_drive ASC`,
            [configId]
        );

        if (taskSetsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.warn(`No task sets found for drive_configuration_id: ${configId}`);
            return res.status(400).json({ message: 'Drive configuration has no task sets defined.' });
        }

        let firstUserActiveDriveItemId = null;
        for (let i = 0; i < taskSetsResult.rows.length; i++) {
            const taskSet = taskSetsResult.rows[i];
            const productIds = taskSet.product_ids_in_set || [];
            
            if (productIds.length === 0) {
                logger.warn(`Task set ${taskSet.task_set_id} in config ${configId} has no products. Skipping.`);
                continue;
            }

            const activeItemInsertResult = await client.query(
                `INSERT INTO user_active_drive_items 
                 (user_id, drive_session_id, product_id_1, product_id_2, product_id_3, 
                  order_in_drive, user_status, task_type, drive_task_set_id_override, current_product_slot_processed, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'order', $8, 0, NOW(), NOW()) RETURNING id`,
                [
                    userId, newDriveSessionId, 
                    productIds[0] || null, productIds[1] || null, productIds[2] || null,
                    taskSet.order_in_drive, 
                    i === 0 ? 'CURRENT' : 'PENDING', // First item is CURRENT
                    taskSet.task_set_id, // Link to the original task_set
                ]
            );
            const insertedItemId = activeItemInsertResult.rows[0]?.id;
            if (i === 0 && insertedItemId) {
                firstUserActiveDriveItemId = insertedItemId;
            }
            logger.debug(`startDrive: Inserted user_active_drive_item ID: ${insertedItemId} for task_set ${taskSet.task_set_id}`);
        }

        if (!firstUserActiveDriveItemId) {
            await client.query('ROLLBACK');
            logger.error(`CRITICAL: No user_active_drive_items were created or first item ID not captured for session ${newDriveSessionId}.`);
            return res.status(500).json({ message: 'Failed to initialize drive items. Drive not started.' });
        }
        
        await client.query(
            'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
            [firstUserActiveDriveItemId, newDriveSessionId]
        );

        // 6. Prepare response with details of the first sub-product of the first item
        const firstItemDetailsResult = await client.query(
            `SELECT
               uadi.id as uadi_id, uadi.product_id_1, uadi.product_id_2, uadi.product_id_3,
               uadi.drive_task_set_id_override as task_set_id,
               p1.name as p1_name, p1.price as p1_price, p1.image_url as p1_image_url, p1.description as p1_description,
               (SELECT COUNT(*) FROM drive_task_set_products dtsp WHERE dtsp.task_set_id = uadi.drive_task_set_id_override) as total_products_in_task_set
             FROM user_active_drive_items uadi
             LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
             WHERE uadi.id = $1`,
            [firstUserActiveDriveItemId]
        );

        if (firstItemDetailsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.error(`Failed to fetch details for the first active item ${firstUserActiveDriveItemId}.`);
            return res.status(500).json({ message: 'Error retrieving initial task details.' });
        }
        const firstItemData = firstItemDetailsResult.rows[0];
        
        // The first sub-product is always product_id_1 for a new item
        const firstSubProduct = {
            product_id: firstItemData.product_id_1,
            product_name: firstItemData.p1_name,
            product_image: firstItemData.p1_image_url || './assets/uploads/products/newegg-1.jpg',
            product_price: parseFloat(firstItemData.p1_price).toFixed(2),
            product_description: firstItemData.p1_description
        };

        const { tier } = await getUserDriveInfo(userId, client);
        const commissionData = await tierCommissionService.calculateCommissionForUser(userId, parseFloat(firstSubProduct.product_price), false); // Commission for the first single product

        await client.query('COMMIT');
        
        res.status(200).json({
            code: 0,
            message: 'Drive started successfully!',
            drive_session_id: newDriveSessionId,
            tasks_in_configuration: totalTaskSetsInDrive, // Total task_sets in this drive config
            tasks_completed_in_session: 0, // Overall task_sets completed in session
            total_session_commission: "0.00",
            current_order: { // Details of the first sub-product to process
                user_active_drive_item_id: firstItemData.uadi_id, // ID of the parent user_active_drive_item
                task_set_id: firstItemData.task_set_id,
                product_id: firstSubProduct.product_id,
                product_name: `${firstSubProduct.product_name}${firstItemData.total_products_in_task_set > 1 ? ' (1/' + firstItemData.total_products_in_task_set + ')' : ''}`,
                product_image: firstSubProduct.product_image,
                product_price: firstSubProduct.product_price, // Price of this specific sub-product
                order_commission: commissionData.commissionAmount.toFixed(2), // Commission for this specific sub-product
                order_id: uuidv4(), // Unique ID for this sub-transaction attempt (can be generated on client too)
                is_combo_product: firstItemData.total_products_in_task_set > 1,
                combo_product_index: 1, // This is the 1st product of the item
                combo_total_products: parseInt(firstItemData.total_products_in_task_set, 10),
                // For frontend compatibility, some fields from the old structure:
                fund_amount: firstSubProduct.product_price, 
                product_number: uuidv4().substring(0, 18), 
                premium_status: 0 
            }
        });

    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rbError) { logger.error('Rollback error in startDrive:', rbError); }
        }
        logger.error(`Error in startDrive for user ID: ${userId} - ${error.message}`, { stack: error.stack, userId });
        res.status(500).json({ message: 'Failed to start drive', error: error.message, code: 1 });
    } finally {
        if (client) client.release();
    }
};

const getDriveStatus = async (req, res) => {
    const userId = req.user.id;
    logger.debug(`getDriveStatus called for user ID: ${userId} (sequential combo processing)`);    
    const client = await pool.connect();
    try {
        // 1. Fetch the latest relevant drive session
        const sessionResult = await client.query(
            `SELECT
               ds.id AS drive_session_id, ds.status AS session_status,
               ds.drive_configuration_id, ds.current_user_active_drive_item_id,
               ds.frozen_amount_needed,
               dc.tasks_required AS total_task_sets_in_drive
             FROM drive_sessions ds
             JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
             WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
             ORDER BY ds.started_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            client.release();
            return res.json({ code: 0, status: 'no_session' });
        }
        const session = sessionResult.rows[0];
        const driveSessionId = session.drive_session_id;

        // 2. Count completed user_active_drive_items (overall task sets) for this session
        const completedTaskSetsResult = await client.query(
            `SELECT COUNT(*) as count FROM user_active_drive_items
             WHERE drive_session_id = $1 AND user_status = 'COMPLETED'`,
            [driveSessionId]
        );
        const taskSetsCompletedCount = parseInt(completedTaskSetsResult.rows[0].count, 10);

        // 3. Calculate total commission earned in this drive session
        const commissionResult = await client.query(
            `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
             FROM commission_logs WHERE drive_session_id = $1`,
            [driveSessionId]
        );
        const totalSessionCommission = parseFloat(commissionResult.rows[0]?.total_commission || 0);

        // 4. Handle 'pending_reset' (all task sets completed) status
        if (session.session_status === 'pending_reset') {
            client.release();
            return res.json({
                code: 0, status: 'complete',
                tasks_completed: taskSetsCompletedCount,
                tasks_required: parseInt(session.total_task_sets_in_drive, 10),
                total_commission: totalSessionCommission.toFixed(2),
                drive_session_id: driveSessionId,
                info: 'Drive completed. Pending admin reset.'
            });
        }

        // 5. Handle 'frozen' status
        if (session.session_status === 'frozen') {
            client.release();
            return res.json({
                code: 0, status: 'frozen',
                tasks_completed: taskSetsCompletedCount,
                tasks_required: parseInt(session.total_task_sets_in_drive, 10),
                total_commission: totalSessionCommission.toFixed(2),
                frozen_amount_needed: session.frozen_amount_needed ? parseFloat(session.frozen_amount_needed).toFixed(2) : null,
                drive_session_id: driveSessionId,
                info: 'Drive frozen. Please deposit funds and contact admin.'
            });
        }
        
        // 6. Handle 'active' status
        if (session.session_status === 'active') {
            if (!session.current_user_active_drive_item_id) {
                client.release();
                logger.error(`Active session ${driveSessionId} for user ${userId} has no current_user_active_drive_item_id.`);
                return res.status(500).json({ code: 1, info: 'Active session is in an inconsistent state (no current item).' });
            }

            // Fetch details for the current_user_active_drive_item and its sub-product state
            const currentItemStateResult = await client.query(
                `SELECT
                   uadi.id as uadi_id, uadi.product_id_1, uadi.product_id_2, uadi.product_id_3,
                   uadi.current_product_slot_processed, uadi.drive_task_set_id_override as task_set_id,
                   (SELECT COUNT(*) FROM drive_task_set_products dtsp WHERE dtsp.task_set_id = uadi.drive_task_set_id_override) as total_products_in_task_set,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN uadi.product_id_1
                       WHEN uadi.current_product_slot_processed = 1 THEN uadi.product_id_2
                       WHEN uadi.current_product_slot_processed = 2 THEN uadi.product_id_3
                       ELSE NULL 
                   END as next_sub_product_id,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN p1.name
                       WHEN uadi.current_product_slot_processed = 1 THEN p2.name
                       WHEN uadi.current_product_slot_processed = 2 THEN p3.name
                       ELSE NULL
                   END as next_sub_product_name,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN p1.price
                       WHEN uadi.current_product_slot_processed = 1 THEN p2.price
                       WHEN uadi.current_product_slot_processed = 2 THEN p3.price
                       ELSE NULL
                   END as next_sub_product_price,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN p1.image_url
                       WHEN uadi.current_product_slot_processed = 1 THEN p2.image_url
                       WHEN uadi.current_product_slot_processed = 2 THEN p3.image_url
                       ELSE NULL
                   END as next_sub_product_image_url
                 FROM user_active_drive_items uadi
                 LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
                 LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
                 LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
                 WHERE uadi.id = $1`,
                [session.current_user_active_drive_item_id]
            );

            if (currentItemStateResult.rows.length === 0) {
                client.release();
                logger.error(`Details for current_user_active_drive_item_id ${session.current_user_active_drive_item_id} not found.`);
                return res.status(404).json({ code: 1, info: 'Current active drive item details not found.' });
            }
            const itemState = currentItemStateResult.rows[0];

            if (!itemState.next_sub_product_id) {
                client.release();
                // This implies the current item is finished, but saveOrder hasn't moved to the next one.
                // Or, it's the end of the drive. getOrder should reflect this.
                // For now, treat as an error or "no more products in current item"
                logger.warn(`getDriveStatus: Item ${itemState.uadi_id} has no next sub-product. current_product_slot_processed: ${itemState.current_product_slot_processed}`);
                // This might mean the drive is complete if this was the last product of the last item.
                // saveOrder handles advancing. If getOrder is called and there's no sub-product, it's tricky.
                // Let's assume saveOrder correctly sets 'pending_reset' if all done.
                // If we are here, it means an active item has no more sub-products, which is an issue.
                return res.status(500).json({ code: 1, info: 'No further products in the current task, or inconsistent state.' });
            }
            
            const currentSubProductPrice = parseFloat(itemState.next_sub_product_price);
            const { tier } = await getUserDriveInfo(userId, client);
            const commissionData = await tierCommissionService.calculateCommissionForUser(userId, currentSubProductPrice, false);
            const currentSubProductCommission = commissionData.commissionAmount;
            
            const totalProductsInItem = parseInt(itemState.total_products_in_task_set, 10);
            const currentSubProductIndex = parseInt(itemState.current_product_slot_processed, 10) + 1;

            client.release();
            return res.json({
                code: 0,
                status: 'active',
                tasks_completed: taskSetsCompletedCount, // Overall task sets completed
                tasks_required: parseInt(session.total_task_sets_in_drive, 10),
                total_commission: totalSessionCommission.toFixed(2), // Overall session commission
                drive_session_id: driveSessionId,
                current_order: {
                    user_active_drive_item_id: itemState.uadi_id,
                    task_set_id: itemState.task_set_id,
                    product_id: itemState.next_sub_product_id,
                    product_name: `${itemState.next_sub_product_name}${totalProductsInItem > 1 ? ` (${currentSubProductIndex}/${totalProductsInItem})` : ''}`,
                    product_image: itemState.next_sub_product_image_url || './assets/uploads/products/newegg-1.jpg',
                    product_price: currentSubProductPrice.toFixed(2),
                    product_description: itemState.next_sub_product_description,
                    order_commission: currentSubProductCommission.toFixed(2),
                    order_id: uuidv4(), // For this specific sub-product view/attempt
                    is_combo_product: totalProductsInItem > 1,
                    combo_product_index: currentSubProductIndex,
                    combo_total_products: totalProductsInItem,
                    // For frontend compatibility:
                    fund_amount: currentSubProductPrice.toFixed(2),
                    product_number: uuidv4().substring(0, 18),
                    premium_status: 0
                }
            });
        }

        client.release();
        logger.warn(`Unhandled session status '${session.session_status}' for session ID ${driveSessionId}`);
        return res.status(500).json({ code: 1, info: 'Unhandled session status.' });

    } catch (error) {
        if (client) client.release();
        logger.error(`Error in getDriveStatus for user ID ${userId}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ code: 1, info: 'Server error getting drive status: ' + error.message });
    }
};

const getOrder = async (req, res) => {
    const userId = req.user.id;
    logger.debug(`getOrder called for user ID: ${userId} (sequential combo processing)`);

    const client = await pool.connect();
    try {
        // 1. Fetch the latest relevant drive session
        const sessionResult = await client.query(
            `SELECT
               ds.id AS drive_session_id, ds.status AS session_status,
               ds.drive_configuration_id, ds.current_user_active_drive_item_id,
               ds.frozen_amount_needed,
               dc.tasks_required AS total_task_sets_in_drive
             FROM drive_sessions ds
             JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
             WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
             ORDER BY ds.started_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            client.release();
            // Matching original getOrder response for "no session"
            return res.status(404).json({ success: false, code: 1, info: 'No drive session found. Please start a drive.' });
        }
        const session = sessionResult.rows[0];
        const driveSessionId = session.drive_session_id;

        // 2. Count completed user_active_drive_items (overall task sets)
        const completedTaskSetsResult = await client.query(
            `SELECT COUNT(*) as count FROM user_active_drive_items
             WHERE drive_session_id = $1 AND user_status = 'COMPLETED'`,
            [driveSessionId]
        );
        const taskSetsCompletedCount = parseInt(completedTaskSetsResult.rows[0].count, 10);

        // 3. Handle 'pending_reset' (all task sets completed) status
        if (session.session_status === 'pending_reset') {
            client.release();
            return res.json({
                success: true, code: 2, // Original code for drive complete
                status: 'complete', 
                tasks_completed: taskSetsCompletedCount,
                tasks_required: parseInt(session.total_task_sets_in_drive, 10),
                info: 'Congratulations! You have completed all tasks in this drive.'
            });
        }

        // 4. Handle 'frozen' status
        if (session.session_status === 'frozen') {
            client.release();
            return res.status(403).json({ // Original status code for frozen
                success: false, code: 3, // Original code for frozen
                status: 'frozen',
                info: 'Your drive session is frozen. Please resolve any outstanding issues.',
                frozen_amount_needed: session.frozen_amount_needed ? parseFloat(session.frozen_amount_needed).toFixed(2) : null
            });
        }
        
        // 5. Handle 'active' status - fetch the next sub-product
        if (session.session_status === 'active') {
            if (!session.current_user_active_drive_item_id) {
                client.release();
                logger.error(`getOrder: Active session ${driveSessionId} for user ${userId} has no current_user_active_drive_item_id.`);
                return res.status(500).json({ success: false, code: 1, info: 'Error: Active session is in an inconsistent state.' });
            }

            // This logic is very similar to getDriveStatus for fetching the current sub-product
            const currentItemStateResult = await client.query(
                `SELECT
                   uadi.id as uadi_id, uadi.product_id_1, uadi.product_id_2, uadi.product_id_3,
                   uadi.current_product_slot_processed, uadi.drive_task_set_id_override as task_set_id,
                   (SELECT COUNT(*) FROM drive_task_set_products dtsp WHERE dtsp.task_set_id = uadi.drive_task_set_id_override) as total_products_in_task_set,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN uadi.product_id_1
                       WHEN uadi.current_product_slot_processed = 1 THEN uadi.product_id_2
                       WHEN uadi.current_product_slot_processed = 2 THEN uadi.product_id_3
                       ELSE NULL 
                   END as next_sub_product_id,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN p1.name
                       WHEN uadi.current_product_slot_processed = 1 THEN p2.name
                       WHEN uadi.current_product_slot_processed = 2 THEN p3.name
                       ELSE NULL
                   END as next_sub_product_name,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN p1.price
                       WHEN uadi.current_product_slot_processed = 1 THEN p2.price
                       WHEN uadi.current_product_slot_processed = 2 THEN p3.price
                       ELSE NULL
                   END as next_sub_product_price,
                   CASE 
                       WHEN uadi.current_product_slot_processed = 0 THEN p1.image_url
                       WHEN uadi.current_product_slot_processed = 1 THEN p2.image_url
                       WHEN uadi.current_product_slot_processed = 2 THEN p3.image_url
                       ELSE NULL
                   END as next_sub_product_image_url
                 FROM user_active_drive_items uadi
                 LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
                 LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
                 LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
                 WHERE uadi.id = $1`,
                [session.current_user_active_drive_item_id]
            );

            if (currentItemStateResult.rows.length === 0) {
                client.release();
                return res.status(404).json({ success: false, code: 1, info: 'Current active drive item details not found.' });
            }
            const itemState = currentItemStateResult.rows[0];

            if (!itemState.next_sub_product_id) {
                client.release();
                // This implies the current item is finished, but saveOrder hasn't moved to the next one.
                // Or, it's the end of the drive. getOrder should reflect this.
                // For now, treat as an error or "no more products in current item"
                logger.warn(`getOrder: Item ${itemState.uadi_id} has no next sub-product. current_product_slot_processed: ${itemState.current_product_slot_processed}`);
                // This might mean the drive is complete if this was the last product of the last item.
                // saveOrder handles advancing. If getOrder is called and there's no sub-product, it's tricky.
                // Let's assume saveOrder correctly sets 'pending_reset' if all done.
                // If we are here, it means an active item has no more sub-products, which is an issue.
                return res.status(500).json({ success: false, code: 1, info: 'No further products in the current task, or inconsistent state.' });
            }
            
            const currentSubProductPrice = parseFloat(itemState.next_sub_product_price);
            const { tier } = await getUserDriveInfo(userId, client);
            const commissionData = await tierCommissionService.calculateCommissionForUser(userId, currentSubProductPrice, false);
            const currentSubProductCommission = commissionData.commissionAmount;
            
            const totalProductsInItem = parseInt(itemState.total_products_in_task_set, 10);
            const currentSubProductIndex = parseInt(itemState.current_product_slot_processed, 10) + 1;

            client.release();
            return res.json({
                success: true, code: 0,
                tasks_required: parseInt(session.total_task_sets_in_drive, 10), // Total task sets in drive
                tasks_completed: taskSetsCompletedCount, // Task sets completed
                // --- Details of the specific sub-product ---
                order_id: uuidv4(), // Unique ID for this sub-product "order" attempt
                parent_item_id: itemState.uadi_id, // ID of the user_active_drive_item
                task_set_id: itemState.task_set_id,
                product_id: itemState.next_sub_product_id,
                product_name: `${itemState.next_sub_product_name}${totalProductsInItem > 1 ? ` (${currentSubProductIndex}/${totalProductsInItem})` : ''}`,
                product_image: itemState.next_sub_product_image_url || './assets/uploads/products/newegg-1.jpg',
                product_price: currentSubProductPrice.toFixed(2), // Price of this sub-product
                order_commission: currentSubProductCommission.toFixed(2), // Commission for this sub-product
                is_combo_product: totalProductsInItem > 1,
                combo_product_index: currentSubProductIndex,
                combo_total_products: totalProductsInItem,
                // --- Fields from original getOrder response for compatibility ---
                product_number: uuidv4().substring(0, 18),
                grabbed_date: new Date().toISOString(),
                fund_amount: currentSubProductPrice.toFixed(2),
                premium_status: 0,
            });
        }

        client.release();
        logger.warn(`getOrder: Unhandled session status '${session.session_status}' for session ID ${driveSessionId}`);
        return res.status(500).json({ success: false, code: 1, info: 'Unhandled session status.' });
    } catch (error) {
        if (client) client.release();
        logger.error(`Error in getOrder for user ID ${userId}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ success: false, code: 1, message: 'Server error getting order: ' + error.message });
    }
};

const saveOrder = async (req, res) => {
    const userId = req.user.id;
    // Client sends: user_active_drive_item_id (parent item), product_id (of sub-product), 
    // order_amount (price of sub-product), earning_commission (for sub-product),
    // product_slot_to_complete (0-indexed, which sub-product this is: 0, 1, or 2)
    const { 
        user_active_drive_item_id, // This is the ID of the parent user_active_drive_items row
        product_id,                // The actual product ID of the sub-product being purchased
        order_amount,              // Price of this specific sub-product
        // earning_commission,     // Commission for this sub-product (will be recalculated server-side)
        product_slot_to_complete   // 0, 1, or 2, indicating which sub-product this is
    } = req.body;

    if (!user_active_drive_item_id || !product_id || order_amount === undefined || product_slot_to_complete === undefined) {
        return res.status(400).json({ code: 1, info: 'Missing required fields for saving order.' });
    }
    const parsedUserActiveDriveItemId = parseInt(user_active_drive_item_id);
    const subProductPrice = parseFloat(order_amount);
    const slotIndex = parseInt(product_slot_to_complete); // 0, 1, or 2

    if (isNaN(parsedUserActiveDriveItemId) || isNaN(subProductPrice) || isNaN(slotIndex) || slotIndex < 0 || slotIndex > 2) {
        return res.status(400).json({ code: 1, info: 'Invalid input data.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch active session and verify the submitted item is the current one
        const sessionResult = await client.query(
            `SELECT id as drive_session_id, status, drive_configuration_id, current_user_active_drive_item_id, tasks_required as total_task_sets_in_drive
             FROM drive_sessions
             WHERE user_id = $1 AND status = 'active'
             ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK'); client.release();
            return res.status(404).json({ code: 1, info: 'No active drive session found.' });
        }
        const session = sessionResult.rows[0];
        if (session.current_user_active_drive_item_id !== parsedUserActiveDriveItemId) {
            await client.query('ROLLBACK'); client.release();
            return res.status(400).json({ code: 1, info: 'Submitted item is not the current active task.' });
        }

        // 2. Fetch details of the user_active_drive_item and verify the sub-product
        const itemDetailsResult = await client.query(
            `SELECT uadi.id, uadi.user_status, uadi.current_product_slot_processed,
                    uadi.product_id_1, p1.price as p1_price,
                    uadi.product_id_2, p2.price as p2_price,
                    uadi.product_id_3, p3.price as p3_price,
                    uadi.drive_task_set_id_override as task_set_id,
                    (SELECT COUNT(*) FROM drive_task_set_products dtsp WHERE dtsp.task_set_id = uadi.drive_task_set_id_override) as total_products_in_task_set
             FROM user_active_drive_items uadi
             LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
             LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
             LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
             WHERE uadi.id = $1 AND uadi.drive_session_id = $2 FOR UPDATE OF uadi`,
            [parsedUserActiveDriveItemId, session.drive_session_id]
        );

        if (itemDetailsResult.rows.length === 0) {
            await client.query('ROLLBACK'); client.release();
            return res.status(404).json({ code: 1, info: 'Active drive item not found.' });
        }
        const currentItem = itemDetailsResult.rows[0];

        if (currentItem.user_status !== 'CURRENT') {
            await client.query('ROLLBACK'); client.release();
            return res.status(400).json({ code: 1, info: `Cannot save item with status ${currentItem.user_status}.` });
        }
        if (currentItem.current_product_slot_processed !== slotIndex) {
            await client.query('ROLLBACK'); client.release();
            return res.status(400).json({ code: 1, info: `Mismatch in expected product slot. Expected ${currentItem.current_product_slot_processed}, got ${slotIndex}.` });
        }

        // Verify product_id and price match the expected slot
        let expectedProductId, expectedPrice;
        if (slotIndex === 0) { expectedProductId = currentItem.product_id_1; expectedPrice = currentItem.p1_price; }
        else if (slotIndex === 1) { expectedProductId = currentItem.product_id_2; expectedPrice = currentItem.p2_price; }
        else if (slotIndex === 2) { expectedProductId = currentItem.product_id_3; expectedPrice = currentItem.p3_price; }

        if (!expectedProductId || parseInt(product_id) !== expectedProductId || Math.abs(parseFloat(expectedPrice) - subProductPrice) > 0.001) {
            await client.query('ROLLBACK'); client.release();
            logger.warn(`Sub-product mismatch for item ${parsedUserActiveDriveItemId}, slot ${slotIndex}. Expected PID: ${expectedProductId}, Price: ${expectedPrice}. Got PID: ${product_id}, Price: ${subProductPrice}`);
            return res.status(400).json({ code: 1, info: 'Sub-product details do not match expected values for this slot.' });
        }

        // 3. Check balance
        const accountResult = await client.query(
            'SELECT id, balance FROM accounts WHERE user_id = $1 AND type = $2 FOR UPDATE', [userId, 'main']
        );
        const account = accountResult.rows[0];
        if (!account) { /* ... error handling ... */ await client.query('ROLLBACK'); client.release(); throw new Error('User account not found'); }
        const currentBalance = parseFloat(account.balance);        if (currentBalance < subProductPrice) {
            const amountNeeded = (subProductPrice - currentBalance).toFixed(2);
            
            // Calculate total session commission for frozen state response
            const totalCommissionResult = await client.query(
                `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
                 FROM commission_logs WHERE drive_session_id = $1`,
                [session.drive_session_id]
            );
            const totalSessionCommission = parseFloat(totalCommissionResult.rows[0]?.total_commission || 0);
            
            // Calculate task sets completed count
            const completedTaskSetsResult = await client.query(
                `SELECT COUNT(*) as count FROM user_active_drive_items
                 WHERE drive_session_id = $1 AND user_status = 'COMPLETED'`,
                [session.drive_session_id]
            );
            const taskSetsCompletedCount = parseInt(completedTaskSetsResult.rows[0].count, 10);
            
            await client.query(
                "UPDATE drive_sessions SET status = 'frozen', frozen_amount_needed = $1 WHERE id = $2",
                [subProductPrice, session.drive_session_id] // Store the sub-product price as amount needed for this freeze
            );
            // user_active_drive_items status remains 'CURRENT', current_product_slot_processed is not incremented.
            await client.query('COMMIT'); client.release();
            return res.status(400).json({ // HTTP 400 or 402 might be more appropriate
                code: 3, // Insufficient balance code
                info: `Insufficient balance. You need ${amountNeeded} USDT more for this product. Drive frozen.`,
                status: 'frozen',
                frozen_amount_needed: subProductPrice.toFixed(2), // Amount needed for this specific sub-product
                total_session_commission: totalSessionCommission.toFixed(2),
                tasks_completed: taskSetsCompletedCount,
                tasks_required: parseInt(session.total_task_sets_in_drive, 10)
            });
        }

        // 4. Calculate commission for this sub-product
        const commissionData = await tierCommissionService.calculateCommissionForUser(userId, subProductPrice, false); // false, as it's a single sub-product purchase
        const subProductCommission = commissionData.commissionAmount;

        // 5. Update balance
        const newBalance = currentBalance - subProductPrice + subProductCommission;
        await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance.toFixed(2), account.id]);

        // 6. Log commission for this sub-product
        await client.query(
            `INSERT INTO commission_logs (user_id, source_user_id, account_type, commission_amount, commission_type, description, reference_id, source_action_id, drive_session_id)
             VALUES ($1, $1, 'main', $2, 'data_drive_sub_product', $3, $4, $5, $6)`,
            [userId, subProductCommission.toFixed(2), 
             `Commission for sub-product #${product_id} (slot ${slotIndex}) of item ${parsedUserActiveDriveItemId}`,
             `${parsedUserActiveDriveItemId}-${slotIndex}`, // reference_id: item_id + slot
             product_id, // source_action_id: the sub-product_id
             session.drive_session_id]
        );

        // 7. Update current_product_slot_processed for the item
        const newSlotProcessed = currentItem.current_product_slot_processed + 1;
        await client.query(
            "UPDATE user_active_drive_items SET current_product_slot_processed = $1, updated_at = NOW() WHERE id = $2",
            [newSlotProcessed, parsedUserActiveDriveItemId]
        );

        // 8. Check if this item (combo) is complete
        const totalProductsInItem = parseInt(currentItem.total_products_in_task_set, 10);
        let itemCompleted = newSlotProcessed >= totalProductsInItem;
        
        let nextUserActiveDriveItemId = null;
        let driveFullyCompleted = false;

        if (itemCompleted) {
            await client.query(
                "UPDATE user_active_drive_items SET user_status = 'COMPLETED', updated_at = NOW() WHERE id = $1",
                [parsedUserActiveDriveItemId]
            );
            logger.info(`Item ${parsedUserActiveDriveItemId} completed by user ${userId}.`);

            // Check total completed items (task sets) in the drive
            const completedItemsCountResult = await client.query(
                "SELECT COUNT(*) FROM user_active_drive_items WHERE drive_session_id = $1 AND user_status = 'COMPLETED'",
                [session.drive_session_id]
            );
            const itemsCompletedSoFar = parseInt(completedItemsCountResult.rows[0].count, 10);

            if (itemsCompletedSoFar >= session.total_task_sets_in_drive) {
                driveFullyCompleted = true;
                await client.query(
                    "UPDATE drive_sessions SET status = 'pending_reset', completed_at = NOW(), current_user_active_drive_item_id = NULL WHERE id = $1",
                    [session.drive_session_id]
                );
                logger.info(`Drive session ${session.drive_session_id} fully completed by user ${userId}. Status set to pending_reset.`);
            } else {
                // Find next PENDING user_active_drive_item for this session
                const nextItemResult = await client.query(
                    `SELECT id FROM user_active_drive_items 
                     WHERE drive_session_id = $1 AND user_status = 'PENDING' 
                     ORDER BY order_in_drive ASC LIMIT 1`,
                    [session.drive_session_id]
                );
                if (nextItemResult.rows.length > 0) {
                    nextUserActiveDriveItemId = nextItemResult.rows[0].id;
                    await client.query(
                        "UPDATE user_active_drive_items SET user_status = 'CURRENT', current_product_slot_processed = 0, updated_at = NOW() WHERE id = $1",
                        [nextUserActiveDriveItemId]
                    );
                    await client.query(
                        "UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2",
                        [nextUserActiveDriveItemId, session.drive_session_id]
                    );
                    logger.info(`Advanced to next item ${nextUserActiveDriveItemId} in session ${session.drive_session_id}.`);
                } else {
                    // Should be caught by driveFullyCompleted, but as a safeguard:
                    driveFullyCompleted = true; // No more pending items, means drive is done.
                     await client.query(
                        "UPDATE drive_sessions SET status = 'pending_reset', completed_at = NOW(), current_user_active_drive_item_id = NULL WHERE id = $1",
                        [session.drive_session_id]
                    );
                    logger.warn(`Session ${session.drive_session_id} marked pending_reset: item completed, total items match, but no next PENDING item found explicitly.`);
                }
            }
        } else {
            // Item (combo) not yet fully complete, user continues with this item.
            // current_user_active_drive_item_id on session remains the same.
            logger.info(`Sub-product slot ${slotIndex} of item ${parsedUserActiveDriveItemId} completed. Item not yet fully complete.`);
        }
          await driveProgressService.updateDriveCompletion(userId);

        // Calculate total session commission to return to frontend
        const totalCommissionResult = await client.query(
            `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
             FROM commission_logs WHERE drive_session_id = $1`,
            [session.drive_session_id]
        );
        const totalSessionCommission = parseFloat(totalCommissionResult.rows[0]?.total_commission || 0);

        // Calculate task sets completed count
        const completedTaskSetsResult = await client.query(
            `SELECT COUNT(*) as count FROM user_active_drive_items
             WHERE drive_session_id = $1 AND user_status = 'COMPLETED'`,
            [session.drive_session_id]
        );
        const taskSetsCompletedCount = parseInt(completedTaskSetsResult.rows[0].count, 10);

        await client.query('COMMIT');
        client.release();

        let responsePayload = {
            code: 0,
            info: 'Product purchased successfully.',
            new_balance: newBalance.toFixed(2),
            total_session_commission: totalSessionCommission.toFixed(2),
            tasks_completed: taskSetsCompletedCount,
            tasks_required: parseInt(session.total_task_sets_in_drive, 10),
            next_action: ''
        };

        if (driveFullyCompleted) {
            responsePayload.next_action = 'drive_complete';
            responsePayload.info = 'Congratulations! You have completed all tasks in this drive.';
        } else if (itemCompleted && nextUserActiveDriveItemId) {
            responsePayload.next_action = 'fetch_next_order'; // To get the first sub-product of the new item
            responsePayload.info = 'Task set completed. Loading next task set.';
        } else if (!itemCompleted) {
            responsePayload.next_action = 'fetch_next_order'; // To get the next sub-product of the current item
            responsePayload.info = 'Product purchased. Loading next product in combo.';
        } else {
             // Should not happen: item completed but no next item and drive not fully completed
            responsePayload.next_action = 'error_state';
            responsePayload.info = 'Product purchased, but encountered an issue determining next step.';
            logger.error(`saveOrder: Inconsistent state after purchase for item ${parsedUserActiveDriveItemId}. ItemCompleted: ${itemCompleted}, NextItemID: ${nextUserActiveDriveItemId}, DriveFullyCompleted: ${driveFullyCompleted}`);
        }
        
        return res.json(responsePayload);

    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rbError) { logger.error('Rollback error in saveOrder:', rbError); }
            client.release();
        }
        logger.error(`Error in saveOrder for user ID ${userId}, item ${user_active_drive_item_id}, slot ${product_slot_to_complete}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ code: 1, info: 'Server error saving order: ' + error.message });
    }
};

const saveComboOrder = async (req, res) => {
  // ...unchanged, omitted for brevity...
  res.json({ success: true, info: 'Combo order completed!' });
};

const saveComboProduct = async (req, res) => {
  // ...unchanged, omitted for brevity...
  res.json({ code: 0, info: 'Combo product saved successfully!' });
};

const getDriveOrders = async (req, res) => {
  const userId = req.user.id;
  const { statusFilter } = req.body; // e.g., 'pending', 'completed', 'frozen', 'all'
  logger.debug(`getDriveOrders called for user ID: ${userId} with filter: ${statusFilter} (using user_active_drive_items)`);

  const client = await pool.connect();
  try {
        const sessionResult = await client.query(
            `SELECT id, status AS session_status
             FROM drive_sessions
             WHERE user_id = $1 AND status IN ('active', 'frozen', 'pending_reset')
             ORDER BY started_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            client.release();
            return res.json({ code: 0, orders: [] });
        }
        
        const session = sessionResult.rows[0];
        const driveSessionId = session.id;
        const sessionStatus = session.session_status;
        
        let query = `
            SELECT
                uadi.id AS user_active_drive_item_id,
                uadi.user_status AS item_status,
                uadi.order_in_drive,
                p1.id AS p1_id, p1.name AS p1_name, p1.image_url AS p1_image_url, p1.price AS p1_price,
                p2.id AS p2_id, p2.name AS p2_name, p2.image_url AS p2_image_url, p2.price AS p2_price,
                p3.id AS p3_id, p3.name AS p3_name, p3.image_url AS p3_image_url, p3.price AS p3_price
            FROM user_active_drive_items uadi
            LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
            LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
            LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
            WHERE uadi.drive_session_id = $1
        `;
        const queryParams = [driveSessionId];

        // Apply status filtering based on user_active_drive_items.user_status
        if (statusFilter) {
            switch (statusFilter.toLowerCase()) {
                case 'pending': // UI "Pending" tab should show the 'CURRENT' active item
                    query += ` AND uadi.user_status = 'CURRENT'`;
                    break;
                case 'completed':
                    query += ` AND uadi.user_status = 'COMPLETED'`;
                    break;
                case 'frozen':
                    // If session is frozen, the 'CURRENT' item is the one that's effectively frozen.
                    if (sessionStatus === 'frozen') {
                        query += ` AND uadi.user_status = 'CURRENT'`; // Or PENDING if it was frozen before starting
                    } else {
                        client.release(); return res.json({ code: 0, orders: [] }); // No items are "frozen" if session isn't
                    }
                    break;
                case 'all':
                    if (sessionStatus === 'pending_reset') { // Drive complete, show all completed items
                        query += ` AND uadi.user_status = 'COMPLETED'`;
                    } else { // Active or Frozen drive, show current and completed
                        query += ` AND uadi.user_status IN ('CURRENT', 'COMPLETED')`;
                    }
                    break;
                default:
                    logger.warn(`Unknown statusFilter '${statusFilter}' in getDriveOrders. Defaulting to CURRENT and COMPLETED.`);
                    if (sessionStatus === 'active' || sessionStatus === 'frozen') {
                        query += ` AND uadi.user_status IN ('CURRENT', 'COMPLETED')`;
                    } else if (sessionStatus === 'pending_reset') {
                         query += ` AND uadi.user_status = 'COMPLETED'`;
                    }
                    break;
            }
        } else {
            // Default behavior: if active/frozen, show CURRENT and COMPLETED. If pending_reset, show COMPLETED.
            if (sessionStatus === 'pending_reset') {
                query += ` AND uadi.user_status = 'COMPLETED'`;
            } else if (sessionStatus === 'active' || sessionStatus === 'frozen') {
                query += ` AND uadi.user_status IN ('CURRENT', 'COMPLETED')`;
            }
        }

        query += ` ORDER BY uadi.order_in_drive ASC`;
        
        const itemsResult = await client.query(query, queryParams);
        
        const orders = itemsResult.rows.map(item => {
            let displayStatus = item.item_status;
            if (sessionStatus === 'frozen' && item.item_status === 'CURRENT') {
                displayStatus = 'frozen'; // Override display status for the current item if session is frozen
            }

            const productsInThisItem = [];
            let itemTotalPrice = 0;
            if(item.p1_id) {
                productsInThisItem.push({id: item.p1_id, name: item.p1_name, image_url: item.p1_image_url, price: item.p1_price});
                if(item.p1_price) itemTotalPrice += parseFloat(item.p1_price);
            }
            if(item.p2_id) {
                productsInThisItem.push({id: item.p2_id, name: item.p2_name, image_url: item.p2_image_url, price: item.p2_price});
                if(item.p2_price) itemTotalPrice += parseFloat(item.p2_price);
            }
            if(item.p3_id) {
                productsInThisItem.push({id: item.p3_id, name: item.p3_name, image_url: item.p3_image_url, price: item.p3_price});
                if(item.p3_price) itemTotalPrice += parseFloat(item.p3_price);
            }
            
            const primaryProductForDisplay = productsInThisItem[0] || {};

            return {
                order_id: item.user_active_drive_item_id, // This is user_active_drive_items.id
                product_id: primaryProductForDisplay.id, // Primary product's ID
                product_name: primaryProductForDisplay.name || 'N/A',
                product_image: primaryProductForDisplay.image_url || './assets/uploads/products/newegg-1.jpg',
                product_price: itemTotalPrice.toFixed(2), // Total price for the item
                order_status: displayStatus,
                is_combo: productsInThisItem.length > 1,
                // products: productsInThisItem // Optionally send all products for richer display
            };
        });

        client.release();
        res.json({ code: 0, orders });

    } catch (error) {
        if (client) client.release();
        logger.error(`Error in getDriveOrders for user ID ${userId}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ code: 1, info: 'Server error getting drive orders: ' + error.message });
    }
};

/**
 * Get user's drive progress for dashboard display
 */
const getDriveProgress = async (req, res) => {
  const userId = req.user.id;
  try {
    // Check and potentially reset weekly progress
    await driveProgressService.checkAndResetWeeklyProgress(userId);
    
    // Get the user's drive progress data
    const progressData = await driveProgressService.getUserDriveProgress(userId);
    
    // Format the response
    res.json({
      code: 0,
      today: {
        drives_completed: progressData.today.drives_completed || 0,
        is_working_day: progressData.today.is_working_day || false
      },
      weekly: {
        progress: progressData.overall.weekly_progress || 0,
        total: 7 // Always 7 days in a week
      },
      total_working_days: progressData.overall.total_working_days || 0
    });
  } catch (error) {
    logger.error(`Error in getDriveProgress for user ID ${userId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ code: 1, info: 'Server error getting drive progress: ' + error.message });
  }
};

module.exports = {
  startDrive,
  getDriveStatus,
  getOrder,
  saveOrder,
  saveComboOrder,
  saveComboProduct,
  getDriveOrders,
  getDriveProgress
};

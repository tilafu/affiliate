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
<<<<<<< HEAD
    logger.debug(`Entering startDrive for user ID: ${userId}`); // Added debug log

    try {
        // Check if the user already has an active drive session
        logger.debug(`Checking for existing active session for user ID: ${userId}`); // Added debug log
        const existingSession = await pool.query(
            'SELECT id FROM drive_sessions WHERE user_id = $1 AND status = \'active\'',
            [userId]
        );

        if (existingSession.rows.length > 0) {
            const activeSessionId = existingSession.rows[0].id;
            logger.info(`Active drive session ${activeSessionId} found for user ID: ${userId}. Returning session details.`); // Changed to info
            
            const sessionDetailsResult = await pool.query(
                `SELECT 
                    ds.id AS drive_session_id, 
                    ds.drive_configuration_id, 
                    ds.commission_earned,                    (SELECT COUNT(*) FROM drive_orders WHERE session_id = ds.id) AS tasks_in_configuration,
                    (SELECT COUNT(*) FROM drive_orders WHERE session_id = ds.id AND status = 'completed') AS tasks_completed_count
                 FROM drive_sessions ds
                 WHERE ds.id = $1`,
                [activeSessionId]
            );

            if (sessionDetailsResult.rows.length === 0) {
                 // Should not happen if existingSession found it
                logger.error(`Active session ${activeSessionId} found but details could not be retrieved for user ID: ${userId}.`); // Added error log
                return res.status(404).json({ message: 'Active session found but details could not be retrieved.' });
            }            
            const sessionDetails = sessionDetailsResult.rows[0];
            
            const firstOrderResult = await pool.query(
                `SELECT drive_ord.id, drive_ord.product_id, drive_ord.order_in_drive, drive_ord.status,
                        p.name AS product_name, p.price AS product_price, p.image_url AS product_image_url, p.description AS product_description
                 FROM drive_orders drive_ord
                 JOIN products p ON drive_ord.product_id = p.id
                 WHERE drive_ord.session_id = $1 AND drive_ord.status IN ('current', 'pending')
                 ORDER BY CASE drive_ord.status WHEN 'current' THEN 0 ELSE 1 END, drive_ord.order_in_drive ASC
                 LIMIT 1`,
                [activeSessionId]
            );

            return res.status(200).json({
                message: 'Active drive session already exists.',
                drive_session_id: sessionDetails.drive_session_id,
                drive_configuration_id: sessionDetails.drive_configuration_id,
                first_order: firstOrderResult.rows.length > 0 ? firstOrderResult.rows[0] : null,
                tasks_in_configuration: parseInt(sessionDetails.tasks_in_configuration, 10),
                tasks_completed: parseInt(sessionDetails.tasks_completed_count, 10),
                total_session_commission: parseFloat(sessionDetails.commission_earned)
            });
        }        // Find an active drive configuration (e.g., the latest one or based on some criteria)        // First, check if the user has a specific drive configuration assigned
        logger.debug(`No active session found for user ID: ${userId}. Attempting to create a new one.`); // Added debug log
        logger.debug(`Checking for user-assigned drive configuration for user ID: ${userId}`);
        
        const userConfigResult = await pool.query(
            `SELECT udc.drive_configuration_id, dc.name, dc.tasks_required
             FROM user_drive_configurations udc
             JOIN drive_configurations dc ON udc.drive_configuration_id = dc.id
             WHERE udc.user_id = $1 AND dc.is_active = TRUE`,
            [userId]
        );
        
        let activeConfiguration;
        
        if (userConfigResult.rows.length > 0) {
            // User has a specific drive configuration assigned
            activeConfiguration = {
                id: userConfigResult.rows[0].drive_configuration_id,
                name: userConfigResult.rows[0].name,
                tasks_required: userConfigResult.rows[0].tasks_required
            };
            logger.debug(`Using user-assigned drive configuration ID: ${activeConfiguration.id}, Name: ${activeConfiguration.name}, Tasks: ${activeConfiguration.tasks_required}`);
        } else {
            // No user-specific configuration, use default (first active one)
            logger.debug(`No user-specific drive configuration found. Fetching default active configuration.`);
            const activeConfigurationResult = await pool.query(
                'SELECT id, name, tasks_required FROM drive_configurations WHERE is_active = TRUE ORDER BY id ASC LIMIT 1'
            );

            if (activeConfigurationResult.rows.length === 0) {
                logger.warn('No active drive configurations found in the system.'); // Changed to warn
                return res.status(404).json({ message: 'No active drive configurations found.' });
            }
            activeConfiguration = activeConfigurationResult.rows[0];
            logger.debug(`Using default drive configuration ID: ${activeConfiguration.id}, Name: ${activeConfiguration.name}, Tasks: ${activeConfiguration.tasks_required}`); // Added debug log
        }        // Get products for this configuration
        logger.debug(`Fetching products for configuration ID: ${activeConfiguration.id}`); // Added debug log
        const configItemsResult = await pool.query(
            'SELECT product_id, order_in_drive FROM drive_configuration_items WHERE drive_configuration_id = $1 ORDER BY order_in_drive ASC',
            [activeConfiguration.id]
        );

        if (configItemsResult.rows.length === 0) {
            logger.warn(`Drive configuration ID: ${activeConfiguration.id} has no products.`); // Changed to warn
            return res.status(400).json({ message: 'Selected drive configuration has no products.' });
        }
        
        // Use the tasks_required from the drive configuration instead of calculating it
        const tasksRequired = activeConfiguration.tasks_required;
        logger.debug(`Using configured tasks_required value: ${tasksRequired} for drive configuration ID: ${activeConfiguration.id}`);

        logger.debug(`Creating drive session for configuration ID: ${activeConfiguration.id}`); // Added debug log// Start a new drive session
        const driveSessionResult = await pool.query(
            'INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, commission_earned, started_at) VALUES ($1, $2, \'active\', $3, 0, NOW()) RETURNING id, started_at',
            [userId, activeConfiguration.id, tasksRequired]
        );
        
        const driveSessionId = driveSessionResult.rows[0].id;
        logger.info(`New drive session ${driveSessionId} created for user ID: ${userId} with configuration ID: ${activeConfiguration.id}`); // Changed to info
        
        // Create drive_orders for this session
        const productOrders = configItemsResult.rows;
        logger.debug(`Creating ${productOrders.length} drive orders for session ID: ${driveSessionId}`); // Added debug log
          for (const item of productOrders) {
            // Add tasks_required to the INSERT statement to satisfy the NOT NULL constraint
            await pool.query(
                'INSERT INTO drive_orders (session_id, product_id, order_in_drive, status, tasks_required) VALUES ($1, $2, $3, \'pending\', $4)',
                [driveSessionId, item.product_id, item.order_in_drive, tasksRequired] // Use the tasksRequired variable
            );
        }
        
        // Fetch the first order to return to the client
        logger.debug(`Fetching first order for session ID: ${driveSessionId}`); // Added debug log
        const firstOrderResult = await pool.query(
            `SELECT drive_ord.id, drive_ord.product_id, drive_ord.order_in_drive, drive_ord.status,
                    p.name AS product_name, p.price AS product_price, p.image_url AS product_image_url, p.description AS product_description
             FROM drive_orders drive_ord
             JOIN products p ON drive_ord.product_id = p.id
             WHERE drive_ord.session_id = $1
             ORDER BY drive_ord.order_in_drive ASC
             LIMIT 1`,
            [driveSessionId]
        );
        
        const firstOrder = firstOrderResult.rows.length > 0 ? firstOrderResult.rows[0] : null;

        res.status(201).json({
            message: 'Drive started successfully.',
            drive_session_id: driveSessionId,
            drive_configuration_id: activeConfiguration.id,
            first_order: firstOrder, // Send the first order
            tasks_in_configuration: tasksRequired, // Send total tasks count
            tasks_completed: 0 // Initially 0 tasks completed
        });
        logger.debug(`startDrive completed successfully for user ID: ${userId}, session ID: ${driveSessionId}`); // Added debug log

    } catch (error) {
        logger.error(`Error in startDrive for user ID: ${userId} - ${error.message}`, { stack: error.stack }); // Enhanced error log
        res.status(500).json({ message: 'Failed to start drive', error: error.message });
=======
    logger.debug(`Entering startDrive for user ID: ${userId} (using user_active_drive_items)`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check for existing active, pending_reset, or frozen drive_sessions
        // This logic remains largely the same, as drive_sessions still governs the overall state.        
        let existingSessionResult;        try {
            existingSessionResult = await client.query(
                `SELECT ds.id, ds.status, ds.drive_configuration_id, uadi.id as current_user_active_drive_item_id
                 FROM drive_sessions ds
                 LEFT JOIN user_active_drive_items uadi ON ds.current_user_active_drive_item_id = uadi.id
                 WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
                 ORDER BY ds.started_at DESC LIMIT 1`,
                [userId]    
            );
            // Log success
            logger.info(`Successfully queried drive_sessions table with current_user_active_drive_item_id join`);
        } catch (queryError) {
            logger.error(`Error querying drive_sessions: ${queryError.message}`);
            
            // Fallback query without the problematic column
            existingSessionResult = await client.query(
                `SELECT ds.id, ds.status, ds.drive_configuration_id
                 FROM drive_sessions ds
                 WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
                 ORDER BY ds.started_at DESC LIMIT 1`,
                [userId]    
            );        } 
        
        if (existingSessionResult.rows.length > 0) {
            const existingSession = existingSessionResult.rows[0];
            // If a session exists, we should return its current state based on user_active_drive_items
            // This aligns with getDriveStatus logic.
            // For now, if 'active', 'pending_reset', or 'frozen', prevent starting a new one.
            // The admin assignment flow is now the primary way to start a new drive.
            // A user clicking "start drive" might imply resuming or checking status.
            // Let's assume for now this endpoint is for *initiating* a drive if none exists.
            // If an admin has assigned one, this endpoint might not be hit, or it should gracefully acknowledge it.

            // If the admin has already assigned a drive, it will be 'active'.
            // This endpoint should probably not allow a user to override an admin-assigned drive.
            // For simplicity, if any of these states exist, we prevent user-initiated start.
            // The user should go through the normal drive flow if a session is already 'active'.
            await client.query('ROLLBACK');
            // Don't release the client here, it will be released in the finally block            logger.warn(`User ${userId} attempted to start a new drive via user endpoint, but an admin-managed session (status: ${existingSession.status}) exists.`);
            
            // Instead of preventing the user from continuing, we'll return the details about the existing session
            // This lets the client-side code handle it gracefully
            return res.status(200).json({ 
                code: 0,
                message: `A drive session (status: ${existingSession.status}) is already assigned to you. Please continue with your current drive.`,
                existing_session: true,
                session_id: existingSession.id,
                status: existingSession.status,
                drive_configuration_id: existingSession.drive_configuration_id,
                current_user_active_drive_item_id: existingSession.current_user_active_drive_item_id || null
            });
        }        // If no admin-assigned drive (active, pending_reset, frozen), check if user has an assigned drive configuration
        // Check if the user has an assigned_drive_configuration_id in the users table
        const userConfigResult = await client.query(
            'SELECT assigned_drive_configuration_id FROM users WHERE id = $1',
            [userId]
        );
        
        if (userConfigResult.rows.length > 0 && userConfigResult.rows[0].assigned_drive_configuration_id) {
            const configId = userConfigResult.rows[0].assigned_drive_configuration_id;
            logger.info(`User ${userId} has an assigned drive configuration: ${configId}`);
            
            // Create a new drive session with the assigned configuration
            try {
                // Get configuration details
                const configResult = await client.query(
                    'SELECT tasks_required FROM drive_configurations WHERE id = $1 AND is_active = TRUE',
                    [configId]
                );
                
                if (configResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    logger.warn(`User ${userId} has assigned drive configuration ${configId} but it is not active.`);
                    return res.status(404).json({ 
                        message: 'The assigned drive configuration is not active. Please contact an administrator.' 
                    });
                }
                
                const tasksRequired = configResult.rows[0].tasks_required;
                
                // Create new drive session
                const sessionInsertResult = await client.query(
                    `INSERT INTO drive_sessions (user_id, drive_configuration_id, status, tasks_required, started_at, created_at)
                     VALUES ($1, $2, 'active', $3, NOW(), NOW()) RETURNING id`,
                    [userId, configId, tasksRequired]
                );
                
                const newDriveSessionId = sessionInsertResult.rows[0].id;
                logger.info(`startDrive: New drive_session created with ID: ${newDriveSessionId} for user ${userId}`);
                
                // Fetch task set products for the configuration
                const taskSetProductsResult = await client.query(
                    `SELECT ts.id as task_set_id, tsp.product_id, ts.order_in_drive, ts.name as task_set_name
                     FROM drive_task_sets ts
                     JOIN drive_task_set_products tsp ON ts.id = tsp.task_set_id
                     WHERE ts.drive_configuration_id = $1
                     AND tsp.order_in_set = 1 -- Assuming the primary product for a step is order_in_set = 1
                     ORDER BY ts.order_in_drive ASC`,
                    [configId]
                );
                
                if (taskSetProductsResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    logger.warn(`No task set products found for drive_configuration_id: ${configId}`);
                    return res.status(400).json({ 
                        message: 'Drive configuration has no products defined. Please contact an administrator.' 
                    });
                }
                logger.info(`startDrive: Found ${taskSetProductsResult.rows.length} task set products for config ${configId}.`);
                
                // Populate user_active_drive_items
                let firstUserActiveDriveItemId = null;
                if (taskSetProductsResult.rows.length > 0) {
                    for (let i = 0; i < taskSetProductsResult.rows.length; i++) {
                        const productInfo = taskSetProductsResult.rows[i];
                        const overallOrder = productInfo.order_in_drive;
                        
                        const activeItemInsertResult = await client.query(
                            `INSERT INTO user_active_drive_items (user_id, drive_session_id, product_id_1, order_in_drive, user_status, task_type, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, $5, 'order', NOW(), NOW()) RETURNING id`,
                            [userId, newDriveSessionId, productInfo.product_id, overallOrder, i === 0 ? 'CURRENT' : 'PENDING']
                        );
                        
                        const insertedItemId = activeItemInsertResult.rows[0]?.id;
                        logger.debug(`startDrive: Inserted user_active_drive_item for session ${newDriveSessionId}, product ${productInfo.product_id}, order ${overallOrder}. Returned ID: ${insertedItemId}`);

                        if (i === 0) {
                            if (insertedItemId) {
                                firstUserActiveDriveItemId = insertedItemId;
                                logger.info(`startDrive: firstUserActiveDriveItemId set to: ${firstUserActiveDriveItemId} (from item ${i})`);
                            } else {
                                logger.error(`startDrive: CRITICAL - Inserted first user_active_drive_item (i=0) but RETURNING id was null/undefined for session ${newDriveSessionId}.`);
                            }
                        }
                    }
                } else {
                    // This case is already handled by a check at line 136, which rolls back.
                    // Adding a log here for completeness, though it might be redundant if the earlier check catches it.
                    logger.warn(`startDrive: taskSetProductsResult.rows.length was 0 when trying to populate user_active_drive_items. Session ID: ${newDriveSessionId}. This should have been caught earlier.`);
                }
                
                logger.info(`startDrive: After loop, firstUserActiveDriveItemId is: ${firstUserActiveDriveItemId} for session ${newDriveSessionId}`);

                // This check ensures that if products were expected for the drive configuration,
                // a first active item ID was indeed captured and can be set on the session.
                if (taskSetProductsResult.rows.length > 0) { 
                    if (firstUserActiveDriveItemId && Number.isInteger(firstUserActiveDriveItemId) && firstUserActiveDriveItemId > 0) {
                        logger.info(`startDrive: Attempting to UPDATE drive_sessions ${newDriveSessionId} with current_user_active_drive_item_id = ${firstUserActiveDriveItemId}`);
                        const updateSessionResult = await client.query(
                            'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                            [firstUserActiveDriveItemId, newDriveSessionId]
                        );
                        logger.info(`startDrive: drive_sessions UPDATE result for session ${newDriveSessionId}: rowCount = ${updateSessionResult.rowCount}`);
                        
                        logger.info(`startDrive: Attempting COMMIT for session ${newDriveSessionId}`);
                        await client.query('COMMIT');
                        logger.info(`startDrive: COMMIT successful for session ${newDriveSessionId}. User ${userId}, config ${configId}, first item ID: ${firstUserActiveDriveItemId}`);
                        
                        // --- BEGIN: Enhance response for task.js ---
                        let responsePayload = {
                            code: 0,
                            message: 'Drive started successfully!',
                            drive_session_id: newDriveSessionId,
                            // tasksRequired is from the drive_configurations table, representing total items in this drive.
                            tasks_in_configuration: tasksRequired, 
                            tasks_completed: 0, // Drive just started, so 0 items completed.
                            total_session_commission: "0.00", // No commission earned at the start of the drive.
                            current_order: null // Initialize current_order, will be populated if there's a first item.
                        };

                        // Fetch details for the firstUserActiveDriveItemId to construct current_order object.
                        // This item was just created and marked as 'CURRENT'.
                        logger.debug(`startDrive: Preparing response. firstUserActiveDriveItemId for itemDetailsResult query: ${firstUserActiveDriveItemId}`);                        const itemDetailsResult = await client.query(
                            `SELECT
                               uadi.id as user_active_drive_item_id,
                               uadi.product_id_1, p1.name as p1_name, p1.price as p1_price, 
                               p1.image_url as p1_image_url, p1.description as p1_description
                               /* Add p2, p3 if startDrive can create combo items directly */
                             FROM user_active_drive_items uadi
                             LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
                             /* Add joins for p2, p3 if needed */
                             WHERE uadi.id = $1`,
                            [firstUserActiveDriveItemId]
                        );
                        logger.debug(`startDrive: itemDetailsResult query returned ${itemDetailsResult.rows.length} rows.`);

                        if (itemDetailsResult.rows.length > 0) {
                            const itemDetails = itemDetailsResult.rows[0];
                            const { tier } = await getUserDriveInfo(userId, client); // Fetch user tier for commission calculation.

                            let currentItemTotalPrice = 0;
                            const productsInItem = [];
                            let potentialCommission = 0;                            // Since startDrive currently creates items with only product_id_1
                            if (itemDetails.product_id_1 && itemDetails.p1_price) {
                                const price = parseFloat(itemDetails.p1_price);
                                currentItemTotalPrice += price;
                                productsInItem.push({
                                    id: itemDetails.product_id_1,
                                    name: itemDetails.p1_name,
                                    price: price,
                                    image_url: itemDetails.p1_image_url,
                                    description: itemDetails.p1_description
                                });
                                // For a single product item, use tier-based commission calculation
                                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, price, false);
                                potentialCommission = commissionData.commissionAmount;
                            }
                            
                            responsePayload.current_order = {
                                user_active_drive_item_id: itemDetails.user_active_drive_item_id,
                                products: productsInItem, // Array of products in this first item
                                total_price: currentItemTotalPrice.toFixed(2),
                                order_commission: potentialCommission.toFixed(2), // Potential commission for this first item
                                fund_amount: currentItemTotalPrice.toFixed(2), // Amount to be deducted for this item
                                product_number: uuidv4().substring(0, 18), // Mimicking getDriveStatus structure
                                premium_status: 0, // Mimicking getDriveStatus structure
                                // Primary product details for frontend compatibility
                                product_id: productsInItem[0]?.id,
                                product_name: productsInItem[0]?.name,
                                product_image: productsInItem[0]?.image_url || './assets/uploads/products/newegg-1.jpg',
                                product_price: productsInItem[0] ? parseFloat(productsInItem[0].price).toFixed(2) : "0.00",
                                product_description: productsInItem[0]?.description,
                                is_combo: productsInItem.length > 1 // Will be false for initial items from startDrive
                            };
                        } else {
                            // This case should ideally not happen if firstUserActiveDriveItemId was set and committed.
                            logger.error(`startDrive: Successfully created session ${newDriveSessionId} and item ${firstUserActiveDriveItemId} was set, COMMIT was done, but FAILED to fetch item details for the response. Current_order will be null.`);
                        }
                        // --- END: Enhance response for task.js ---
                        
                        return res.status(200).json(responsePayload);
                    } else {
                        // CRITICAL: Expected items, but firstUserActiveDriveItemId was NOT set or invalid.
                        logger.error(`CRITICAL_ERROR in startDrive for user ${userId}, new session ${newDriveSessionId}: Task set products were found (${taskSetProductsResult.rows.length}), but firstUserActiveDriveItemId was NOT set or invalid ('${firstUserActiveDriveItemId}'). Rolling back transaction.`);
                        await client.query('ROLLBACK');
                        logger.info(`startDrive: ROLLBACK executed due to invalid firstUserActiveDriveItemId for session ${newDriveSessionId}.`);
                        // client.release() will be handled in the finally block
                        return res.status(500).json({ 
                            message: 'Failed to initialize drive items correctly. The drive session could not be started properly. Please try again or contact support.',
                            code: 1 
                        });
                    }
                }
                // If taskSetProductsResult.rows.length was 0, an earlier check (around line 136 in your file)
                // already handles rolling back and returning an error, so we don't need to re-check that here.
                
            } catch (innerError) {
                await client.query('ROLLBACK');
                logger.error(`Error starting drive for user ${userId} with assigned configuration ${configId}:`, innerError);
                return res.status(500).json({ 
                    message: 'Failed to start drive with assigned configuration.',
                    error: innerError.message
                });
            }
        }
        
        // If we reach here, the user doesn't have an assigned drive configuration
        await client.query('ROLLBACK');
        logger.info(`User ${userId} attempted to start a drive, but no admin-assigned drive session or configuration was found.`);
        return res.status(403).json({ message: 'Drives are assigned by administrators. Please contact an admin to start a new drive.' });
    } catch (error) {
        if (client) {
            try { 
                await client.query('ROLLBACK'); 
                logger.debug('Successfully rolled back transaction in startDrive error handler');
            } catch (rbError) { 
                logger.error('Rollback error in startDrive:', rbError); 
            }
        }
        logger.error(`Error in startDrive for user ID: ${userId} - ${error.message}`, { 
            stack: error.stack,
            userId: userId, // Add user context
            errorName: error.name,
            errorCode: error.code // Capture DB error codes if present
        });
        res.status(500).json({ 
            message: 'Failed to process drive request',
            error: error.message,
            code: 1 // Consistent error code format 
        });
    } finally {
<<<<<<< HEAD
        if (client) client.release();
>>>>>>> main
=======
        if (client) {
            client.release();
            logger.debug('Database client released in startDrive finally block');
        }
>>>>>>> main
    }
};

const getDriveStatus = async (req, res) => {
<<<<<<< HEAD
  const userId = req.user.id;
  logger.debug(`Entering getDriveStatus for user ID: ${userId}`); // Added debug log
  try {
    // First check for ANY active, pending_reset, or frozen session
    logger.debug(`Fetching current session status for user ID: ${userId}`); // Added debug log
    const sessionResult = await pool.query(
      `SELECT id, status, tasks_completed, tasks_required, frozen_amount_needed, drive_configuration_id
       FROM drive_sessions
       WHERE user_id = $1 AND status IN ('active', 'pending_reset', 'frozen')
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );
    
    if (sessionResult.rows.length === 0) {
      logger.debug(`No active, pending_reset, or frozen session found for user ID: ${userId}.`); // Added debug log
      return res.json({ code: 0, status: 'no_session' });
    }

    const session = sessionResult.rows[0];
    const sessionId = session.id;
    logger.debug(`Session ID: ${sessionId} found with status: ${session.status} for user ID: ${userId}`); // Added debug log
    
    // Look for ANY incomplete order (either current or pending)
    const incompleteOrderResult = await pool.query(
      `SELECT drv_ord.id AS order_id, drv_ord.status AS order_status, 
              p.id AS product_id, p.name AS product_name, 
              p.image_url AS product_image, p.price AS product_price
       FROM drive_orders drv_ord
       JOIN products p ON drv_ord.product_id = p.id
       WHERE drv_ord.session_id = $1 
       AND drv_ord.status IN ('current', 'pending')
       ORDER BY CASE 
         WHEN drv_ord.status = 'current' THEN 0 
         WHEN drv_ord.status = 'pending' THEN 1 
       END, drv_ord.id ASC
       LIMIT 1`,
      [sessionId]
    );
    if (incompleteOrderResult.rows.length > 0) {
      const incompleteOrder = incompleteOrderResult.rows[0];
      const { tier } = await getUserDriveInfo(userId);
      const commission = calculateCommission(parseFloat(incompleteOrder.product_price), tier, 'single');

      // Calculate total commission earned in this drive
      const commissionResult = await pool.query(
        `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
         FROM commission_logs
         WHERE user_id = $1 
         AND commission_type = 'data_drive'
         AND drive_session_id = $2`,
        [userId, sessionId]
      );
      
      const totalCommission = parseFloat(commissionResult.rows[0]?.total_commission || 0);
      
      // Update the drive_session table with the latest commission_earned
      await pool.query(
        `UPDATE drive_sessions SET commission_earned = $1 WHERE id = $2`,
        [totalCommission, sessionId]
      );

      // If order was pending, set it to current
      if (incompleteOrder.order_status === 'pending') {
        await pool.query(
          `UPDATE drive_orders SET status = 'current' WHERE id = $1`,
          [incompleteOrder.order_id]
=======
    const userId = req.user.id;
    logger.debug(`getDriveStatus called for user ID: ${userId} (using user_active_drive_items)`);    
    const client = await pool.connect();
    try {
        // 1. Fetch the latest relevant drive session and its current active item
<<<<<<< HEAD
        const sessionResult = await client.query(
            `SELECT
               ds.id AS drive_session_id, ds.status AS session_status,
               ds.drive_configuration_id,
               dc.tasks_required AS total_steps_in_drive, /* tasks_required from config is total steps */
               uadi.id AS current_user_active_drive_item_id,
               uadi.product_id_1, uadi.product_id_2, uadi.product_id_3,
               uadi.order_in_drive AS current_item_order,
               uadi.user_status AS current_item_user_status,
               ds.frozen_amount_needed
             FROM drive_sessions ds
             JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
             LEFT JOIN user_active_drive_items uadi ON ds.current_user_active_drive_item_id = uadi.id
             WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
             ORDER BY ds.started_at DESC LIMIT 1`,
            [userId]
>>>>>>> main
        );
=======
        let sessionResult;
        try {
            sessionResult = await client.query(
                `SELECT
                   ds.id AS drive_session_id, ds.status AS session_status,
                   ds.drive_configuration_id,
                   dc.tasks_required AS total_steps_in_drive, /* tasks_required from config is total steps */
                   uadi.id AS current_user_active_drive_item_id,
                   uadi.product_id_1, uadi.product_id_2, uadi.product_id_3,
                   uadi.order_in_drive AS current_item_order,
                   uadi.user_status AS current_item_user_status,
                   ds.frozen_amount_needed
                 FROM drive_sessions ds
                 JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
                 LEFT JOIN user_active_drive_items uadi ON ds.current_user_active_drive_item_id = uadi.id
                 WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
                 ORDER BY ds.started_at DESC LIMIT 1`,
                [userId]
            );
            logger.info(`Successfully queried drive status with current_user_active_drive_item_id join`);
        } catch (queryError) {            logger.error(`Error in getDriveStatus query: ${queryError.message}`);
            
            // Attempt a fallback query without the problematic join
            try {
                sessionResult = await client.query(
                    `SELECT
                       ds.id AS drive_session_id, ds.status AS session_status,
                       ds.drive_configuration_id,
                       dc.tasks_required AS total_steps_in_drive
                     FROM drive_sessions ds
                     JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
                     WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
                     ORDER BY ds.started_at DESC LIMIT 1`,
                    [userId]
                );
                
                logger.info(`Used fallback query for drive status without current_user_active_drive_item_id join`);
                
                // If we got results, now fetch the active drive items separately
                if (sessionResult.rows.length > 0) {
                    const session = sessionResult.rows[0];
                    
                    // Find the first CURRENT or PENDING item to use
                    const activeItemsResult = await client.query(
                        `SELECT id, product_id_1, product_id_2, product_id_3, order_in_drive, user_status
                         FROM user_active_drive_items
                         WHERE drive_session_id = $1 AND user_status IN ('CURRENT', 'PENDING')
                         ORDER BY order_in_drive ASC LIMIT 1`,
                        [session.drive_session_id]
                    );
                    
                    if (activeItemsResult.rows.length > 0) {
                        // Attach the active item details to the session record
                        const activeItem = activeItemsResult.rows[0];
                        session.current_user_active_drive_item_id = activeItem.id;
                        session.product_id_1 = activeItem.product_id_1;
                        session.product_id_2 = activeItem.product_id_2;
                        session.product_id_3 = activeItem.product_id_3;
                        session.current_item_order = activeItem.order_in_drive;
                        session.current_item_user_status = activeItem.user_status;
                    }
                }
            } catch (fallbackError) {
                logger.error(`Fallback query also failed: ${fallbackError.message}`);
                return res.status(500).json({ 
                    code: 1, 
                    info: 'Database error while checking drive status. Please contact support.'
                });
            }
        }
>>>>>>> main

<<<<<<< HEAD
      return res.json({
        code: 0,
        status: 'active',
        drive_session_id: sessionId, // Added
        drive_configuration_id: session.drive_configuration_id, // Added
        tasks_completed: session.tasks_completed,
        tasks_required: session.tasks_required,
        total_commission: totalCommission.toFixed(2),
        current_order: {
          order_id: incompleteOrder.order_id,
          product_id: incompleteOrder.product_id,
          product_name: incompleteOrder.product_name,
          product_image: incompleteOrder.product_image || './assets/uploads/products/newegg-1.jpg',
          product_price: parseFloat(incompleteOrder.product_price),
          order_commission: commission,
          fund_amount: parseFloat(incompleteOrder.product_price),
          premium_status: 0,
          product_number: uuidv4().substring(0, 18)
=======
        if (sessionResult.rows.length === 0) {
            client.release();
            return res.json({ code: 0, status: 'no_session' });
>>>>>>> main
        }

        const session = sessionResult.rows[0];
        const driveSessionId = session.drive_session_id;

        // 2. Count completed user_active_drive_items for this session
        const completedItemsResult = await client.query(
            `SELECT COUNT(*) as count FROM user_active_drive_items
             WHERE drive_session_id = $1 AND user_status = 'COMPLETED'`,
            [driveSessionId]
        );
        const itemsCompletedCount = parseInt(completedItemsResult.rows[0].count, 10);

        // 3. Calculate total commission earned in this drive session (remains the same)
        const commissionResult = await client.query(
            `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
             FROM commission_logs WHERE drive_session_id = $1`,
            [driveSessionId]
        );
        const totalCommission = parseFloat(commissionResult.rows[0]?.total_commission || 0);

        // 4. Handle 'pending_reset' (all items completed) status
        if (session.session_status === 'pending_reset') {
            client.release();
            return res.json({
                code: 0,
                status: 'complete',
                tasks_completed: itemsCompletedCount, // Number of items completed
                tasks_required: parseInt(session.total_steps_in_drive, 10), // Total items in this drive
                total_commission: totalCommission.toFixed(2),
                drive_session_id: driveSessionId,
                drive_configuration_id: session.drive_configuration_id,
                info: 'Drive completed. Pending admin reset.'
            });
        }

        // 5. Handle 'frozen' status
        if (session.session_status === 'frozen') {
            client.release();
            return res.json({
                code: 0,
                status: 'frozen',
                tasks_completed: itemsCompletedCount,
                tasks_required: parseInt(session.total_steps_in_drive, 10),
                total_commission: totalCommission.toFixed(2),
                frozen_amount_needed: session.frozen_amount_needed ? parseFloat(session.frozen_amount_needed).toFixed(2) : null,
                drive_session_id: driveSessionId,
                drive_configuration_id: session.drive_configuration_id,
                info: 'Drive frozen due to insufficient balance. Please deposit funds.'
            });
        }        // 6. Handle 'active' status
        if (session.session_status === 'active') {
            if (!session.current_user_active_drive_item_id) {
                // Handle missing current_user_active_drive_item_id by fetching the first active item
                const firstItemResult = await client.query(
                    `SELECT id FROM user_active_drive_items 
                     WHERE drive_session_id = $1 AND user_status != 'COMPLETED'
                     ORDER BY order_in_drive ASC LIMIT 1`,
                    [driveSessionId]
                );
                
                if (firstItemResult.rows.length > 0) {
                    // Update the session with the first active item
                    const firstItemId = firstItemResult.rows[0].id;
                    await client.query(
                        'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                        [firstItemId, driveSessionId]
                    );
                    
                    // Set session.current_user_active_drive_item_id for further processing
                    session.current_user_active_drive_item_id = firstItemId;
                    logger.info(`Updated session ${driveSessionId} with missing current_user_active_drive_item_id to ${firstItemId}`);
                } else {
                    // No fallback item found either. This is the error condition.
                    logger.error({
                        message: "Error in getDriveStatus: Active session has no current_user_active_drive_item_id and no fallback active items found.",
                        userId: userId,
                        driveSessionId: driveSessionId,
                        retrievedSessionState: session, // Log the session object as retrieved by the initial query
                        context: "This error occurs when session.current_user_active_drive_item_id is effectively null AND no 'CURRENT' or 'PENDING' items are found in user_active_drive_items for this session."
                    });
                    // Original log: logger.error(`Active session ${driveSessionId} for user ${userId} has no current_user_active_drive_item_id and no active items found.`);
                    client.release();
                    return res.status(500).json({ 
                        code: 1, 
                        info: `Active session ${driveSessionId} for user ${userId} has no current_user_active_drive_item_id and no active items found.` 
                    });
                }
            }            // Fetch details for the current_user_active_drive_item and its products
            let currentItemProductsResult;
            try {                currentItemProductsResult = await client.query(
                    `SELECT
                       uadi.id as user_active_drive_item_id,
                       uadi.product_id_1, p1.name as p1_name, p1.price as p1_price, p1.image_url as p1_image_url, p1.description as p1_description,
                       uadi.product_id_2, p2.name as p2_name, p2.price as p2_price, p2.image_url as p2_image_url, p2.description as p2_description,
                       uadi.product_id_3, p3.name as p3_name, p3.price as p3_price, p3.image_url as p3_image_url, p3.description as p3_description
                     FROM user_active_drive_items uadi
                     LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
                     LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
                     LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
                     WHERE uadi.id = $1`,
                    [session.current_user_active_drive_item_id]
                );
            } catch (productQueryError) {
                logger.error(`Error fetching product details for item ${session.current_user_active_drive_item_id}: ${productQueryError.message}`);
                
                // Fallback to a simpler query that gets just the basic drive item info
                try {
                    currentItemProductsResult = await client.query(
                        `SELECT
                           uadi.id as user_active_drive_item_id,
                           uadi.product_id_1, uadi.product_id_2, uadi.product_id_3
                         FROM user_active_drive_items uadi
                         WHERE uadi.id = $1`,
                        [session.current_user_active_drive_item_id]
                    );
                    
                    // If we have product IDs but not product details, fetch the products separately
                    if (currentItemProductsResult.rows.length > 0) {
                        const item = currentItemProductsResult.rows[0];
                        if (item.product_id_1) {                            const p1Result = await client.query(
                                'SELECT id, name as p1_name, price as p1_price, image_url as p1_image_url, description as p1_description FROM products WHERE id = $1',
                                [item.product_id_1]
                            );
                            if (p1Result.rows.length > 0) {
                                Object.assign(item, p1Result.rows[0]);
                            }
                        }
                    }
                } catch (fallbackError) {
                    logger.error(`Fallback product query also failed: ${fallbackError.message}`);
                    client.release();
                    return res.status(500).json({ code: 1, info: 'Failed to retrieve product details for current drive item.' });
                }
            }

            if (currentItemProductsResult.rows.length === 0) {
                client.release();
                logger.error(`Details for current_user_active_drive_item_id ${session.current_user_active_drive_item_id} not found in session ${driveSessionId}.`);
                return res.status(404).json({ code: 1, info: 'Current active drive item details not found.' });
            }
            const itemDetails = currentItemProductsResult.rows[0];

            // Calculate total price and commission for the current item (combo or single)
            let currentItemTotalPrice = 0;
            let currentItemTotalCommission = 0;
            const productsInItem = [];
            const { tier } = await getUserDriveInfo(userId, client); // Pass client

            if (itemDetails.product_id_1 && itemDetails.p1_price) {
                const price1 = parseFloat(itemDetails.p1_price);
                currentItemTotalPrice += price1;
                // Commission for product 1 - assuming base rate from product, adjusted by tier for non-combo
                // For simplicity, let's assume admin-set combos have a fixed commission logic if needed,
                // or individual product commissions are summed.
                // The old logic: 4.5% for combo, tiered for single.
                // New logic: Sum individual product commissions. If it's a "combo" by virtue of having >1 product,
                // we need to decide if that implies a special commission rate or just sum of parts.
                // Let's assume for now, each product contributes its own commission based on its properties.
                // The `calculateCommission` function might need to be aware of the item context (e.g. if it's part of an admin-defined combo)
                // For now, let's use a simplified approach: if multiple products, it's a "combo" for commission purposes.
                productsInItem.push({
                    id: itemDetails.product_id_1, name: itemDetails.p1_name, price: price1,
                    image_url: itemDetails.p1_image_url, description: itemDetails.p1_description
                });
            }
            if (itemDetails.product_id_2 && itemDetails.p2_price) {
                const price2 = parseFloat(itemDetails.p2_price);
                currentItemTotalPrice += price2;
                productsInItem.push({
                    id: itemDetails.product_id_2, name: itemDetails.p2_name, price: price2,
                    image_url: itemDetails.p2_image_url, description: itemDetails.p2_description
                });
            }
            if (itemDetails.product_id_3 && itemDetails.p3_price) {
                const price3 = parseFloat(itemDetails.p3_price);
                currentItemTotalPrice += price3;
                productsInItem.push({
                    id: itemDetails.product_id_3, name: itemDetails.p3_name, price: price3,
                    image_url: itemDetails.p3_image_url, description: itemDetails.p3_description
                });
            }            // Simplified commission: Use tier-based commission calculation
            // For `getDriveStatus`, we are showing the *potential* commission.
            if (productsInItem.length > 1) { // It's a combo - use merge data rate
                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, currentItemTotalPrice, true);
                currentItemTotalCommission = commissionData.commissionAmount;
            } else if (productsInItem.length === 1) { // Single product - use per data rate
                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, currentItemTotalPrice, false);
                currentItemTotalCommission = commissionData.commissionAmount;
            }


            client.release();
            return res.json({
                code: 0,
                status: 'active',
                tasks_completed: itemsCompletedCount,
                tasks_required: parseInt(session.total_steps_in_drive, 10),
                total_commission: totalCommission.toFixed(2),
                drive_session_id: driveSessionId,
                drive_configuration_id: session.drive_configuration_id,
                current_order: { // Renaming to current_item for clarity might be good later
                    user_active_drive_item_id: itemDetails.user_active_drive_item_id,
                    products: productsInItem, // Array of products in the current step
                    total_price: currentItemTotalPrice.toFixed(2),
                    order_commission: currentItemTotalCommission.toFixed(2), // Potential commission for this item
                    fund_amount: currentItemTotalPrice.toFixed(2), // Amount to be deducted
                    // Ephemeral display items from old structure, adapt as needed
                    product_number: uuidv4().substring(0, 18),
                    premium_status: 0,
                    // Include primary product details for backward compatibility if frontend expects flat structure for first product
                    product_id: productsInItem[0]?.id,
                    product_name: productsInItem[0]?.name,
                    product_image: productsInItem[0]?.image_url || './assets/uploads/products/newegg-1.jpg',
                    product_price: productsInItem[0]?.price.toFixed(2), // Price of primary product
                    product_description: productsInItem[0]?.description,
                    is_combo: productsInItem.length > 1 // True if more than one product
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

// getOrder is largely similar to getDriveStatus but with a slightly different response structure
// It should also be updated to use user_active_drive_items
const getOrder = async (req, res) => {
    const userId = req.user.id;
<<<<<<< HEAD
    const { drive_session_id: session_id, current_order_id } = req.body;
    logger.debug(`Entering getOrder for user ID: ${userId}, session ID: ${session_id}, current order ID: ${current_order_id}`); // Added debug log

    if (!session_id) {
        logger.warn(`getOrder called without session_id for user ID: ${userId}`); // Changed to warn
        return res.status(400).json({ message: "Drive session ID is required." });
    }

    try {
        // Verify the session belongs to the user and is active
        logger.debug(`Verifying session ${session_id} for user ID: ${userId}`); // Added debug log
        const sessionResult = await pool.query(
            'SELECT status FROM drive_sessions WHERE id = $1 AND user_id = $2',
            [session_id, userId]
        );

        if (sessionResult.rows.length === 0) {
            logger.warn(`Drive session ${session_id} not found or does not belong to user ID: ${userId}`); // Changed to warn
            return res.status(404).json({ message: "Drive session not found or access denied." });
        }
        if (sessionResult.rows[0].status !== 'active') {
            logger.warn(`Drive session ${session_id} is not active (status: ${sessionResult.rows[0].status}) for user ID: ${userId}`); // Changed to warn
            return res.status(403).json({ message: `Drive session is not active. Current status: ${sessionResult.rows[0].status}` });
        }        // Fetch the next pending order for the given drive session
        logger.debug(`Fetching next pending order for session ID: ${session_id}`); // Added debug log
        const nextOrderResult = await pool.query(
            `SELECT drive_ord.id, drive_ord.product_id, drive_ord.order_in_drive, drive_ord.status,
                    p.name AS product_name, p.price AS product_price, p.image_url AS product_image_url, p.description AS product_description
             FROM drive_orders drive_ord
             JOIN products p ON drive_ord.product_id = p.id
             WHERE drive_ord.session_id = $1 AND drive_ord.status = 'pending'
             ORDER BY drive_ord.order_in_drive ASC
             LIMIT 1`,
            [session_id]
        );
        
        if (nextOrderResult.rows.length === 0) {
            // This might mean all orders are completed, or an issue if current_order_id was the last one but not marked.
            // Or, it could be that the drive is now complete.
            logger.info(`No more pending orders found for session ID: ${session_id}. This might indicate drive completion.`); // Changed to info
            return res.status(200).json({ message: "No more pending orders in this drive session. It might be complete.", next_order: null });
        }
        
        const retrievedOrder = nextOrderResult.rows[0];
        logger.debug(`Next order ID: ${retrievedOrder.id} (Product ID: ${retrievedOrder.product_id}) found for session ID: ${session_id}`); // Added debug log
        
        res.status(200).json({
            message: "Next order retrieved successfully.",
            next_order: retrievedOrder
        });

    } catch (error) {
        logger.error(`Error in getOrder for session ID: ${session_id}, user ID: ${userId} - ${error.message}`, { stack: error.stack }); // Enhanced error log
        res.status(500).json({ message: "Failed to get next order.", error: error.message });
    }
=======
    logger.debug(`getOrder called for user ID: ${userId} (using user_active_drive_items)`);

    const client = await pool.connect();
    try {
        const sessionResult = await client.query(
            `SELECT
               ds.id AS drive_session_id, ds.status AS session_status,
               ds.drive_configuration_id,
               dc.tasks_required AS total_steps_in_drive,
               uadi.id AS current_user_active_drive_item_id,
               ds.frozen_amount_needed
             FROM drive_sessions ds
             JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
             LEFT JOIN user_active_drive_items uadi ON ds.current_user_active_drive_item_id = uadi.id
             WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
             ORDER BY ds.started_at DESC LIMIT 1`,
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, code: 1, info: 'No drive session found. Please start a drive.' });
        }

        const session = sessionResult.rows[0];
        const driveSessionId = session.drive_session_id;

        const completedItemsResult = await client.query(
            `SELECT COUNT(*) as count FROM user_active_drive_items
             WHERE drive_session_id = $1 AND user_status = 'COMPLETED'`,
            [driveSessionId]
        );
        const itemsCompletedCount = parseInt(completedItemsResult.rows[0].count, 10);

        if (session.session_status === 'pending_reset') {
            client.release();
            return res.json({
                success: true, code: 2, status: 'complete',
                tasks_completed: itemsCompletedCount,
                tasks_required: parseInt(session.total_steps_in_drive, 10),
                info: 'Congratulations! You have completed your drive session. Please contact your administrator to reset the drive for your next session.'
            });
        }

        if (session.session_status === 'frozen') {
            client.release();
            return res.status(403).json({
                success: false, code: 3, status: 'frozen',
                info: 'Your drive session is frozen. Please resolve any outstanding issues.'
            });
        }        if (session.session_status === 'active') {
            if (!session.current_user_active_drive_item_id) {
                // Handle missing current_user_active_drive_item_id by fetching the first active item
                const firstItemResult = await client.query(
                    `SELECT id FROM user_active_drive_items 
                     WHERE drive_session_id = $1 AND user_status != 'COMPLETED'
                     ORDER BY order_in_drive ASC LIMIT 1`,
                    [driveSessionId]
                );
                
                if (firstItemResult.rows.length > 0) {
                    // Update the session with the first active item
                    const firstItemId = firstItemResult.rows[0].id;
                    await client.query(
                        'UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2',
                        [firstItemId, driveSessionId]
                    );
                    
                    // Set session.current_user_active_drive_item_id for further processing
                    session.current_user_active_drive_item_id = firstItemId;
                    logger.info(`getOrder: Updated session ${driveSessionId} with missing current_user_active_drive_item_id to ${firstItemId}`);
                } else {
                    client.release();
                    logger.error(`getOrder: Active session ${driveSessionId} for user ${userId} has no current_user_active_drive_item_id and no active items found.`);
                    return res.status(500).json({ success: false, code: 1, info: 'Error: Active session is in an inconsistent state.' });
                }
            }

            const currentItemProductsResult = await client.query(
                `SELECT
                   uadi.id as user_active_drive_item_id,
                   uadi.product_id_1, p1.name as p1_name, p1.price as p1_price, p1.image_url as p1_image_url, p1.description as p1_description,
                   uadi.product_id_2, p2.name as p2_name, p2.price as p2_price, p2.image_url as p2_image_url,
                   uadi.product_id_3, p3.name as p3_name, p3.price as p3_price, p3.image_url as p3_image_url
                 FROM user_active_drive_items uadi
                 LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
                 LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
                 LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
                 WHERE uadi.id = $1`,
                [session.current_user_active_drive_item_id]
            );

            if (currentItemProductsResult.rows.length === 0) {
                client.release();
                logger.error(`getOrder: Details for current_user_active_drive_item_id ${session.current_user_active_drive_item_id} not found.`);
                return res.status(404).json({ success: false, code: 1, info: 'Current active drive item details not found.' });
            }
            const itemDetails = currentItemProductsResult.rows[0];

            let totalPrice = 0;
            let commission = 0;
            const productsInItem = [];
             const { tier } = await getUserDriveInfo(userId, client); // Pass client

            if (itemDetails.product_id_1 && itemDetails.p1_price) {
                totalPrice += parseFloat(itemDetails.p1_price);
                productsInItem.push({ id: itemDetails.product_id_1, name: itemDetails.p1_name, price: parseFloat(itemDetails.p1_price), image_url: itemDetails.p1_image_url });
            }
            if (itemDetails.product_id_2 && itemDetails.p2_price) {
                totalPrice += parseFloat(itemDetails.p2_price);
                productsInItem.push({ id: itemDetails.product_id_2, name: itemDetails.p2_name, price: parseFloat(itemDetails.p2_price), image_url: itemDetails.p2_image_url });
            }
            if (itemDetails.product_id_3 && itemDetails.p3_price) {
                totalPrice += parseFloat(itemDetails.p3_price);
                productsInItem.push({ id: itemDetails.product_id_3, name: itemDetails.p3_name, price: parseFloat(itemDetails.p3_price), image_url: itemDetails.p3_image_url });
            }            if (productsInItem.length > 1) {
                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, totalPrice, true);
                commission = commissionData.commissionAmount;
            } else if (productsInItem.length === 1) {
                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, totalPrice, false);
                commission = commissionData.commissionAmount;
            }
            
            client.release();
            // The response for getOrder was flatter, focusing on the primary product but acknowledging combos.
            // We need to adapt this. The frontend might expect a single "product" view even for combos.
            // Let's provide the primary product's details and a flag for combo.
            const primaryProduct = productsInItem[0];

            return res.json({
                success: true, code: 0,
                tasks_required: parseInt(session.total_steps_in_drive, 10),
                tasks_completed: itemsCompletedCount,
                order_id: itemDetails.user_active_drive_item_id, // This is now user_active_drive_items.id
                product_id: primaryProduct?.id,
                product_name: primaryProduct?.name,
                product_number: uuidv4().substring(0, 18),
                grabbed_date: new Date().toISOString(),
                product_image: primaryProduct?.image_url || './assets/uploads/products/newegg-1.jpg',
                product_price: totalPrice.toFixed(2), // Total price of the item/combo
                order_commission: commission.toFixed(2),
                fund_amount: totalPrice.toFixed(2),
                premium_status: 0,
                is_combo: productsInItem.length > 1,
                // Optionally, include all products in the combo if frontend can handle it:
                // combo_products: productsInItem
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
>>>>>>> main
};


const saveOrder = async (req, res) => {
    const userId = req.user.id;
<<<<<<< HEAD
    const { drive_session_id, drive_order_id, product_id, tasks_completed_count, tasks_in_configuration } = req.body;
    logger.debug(`Entering saveOrder for user ID: ${userId}, session ID: ${drive_session_id}, order ID: ${drive_order_id}, product ID: ${product_id}`);

    if (!drive_session_id || !drive_order_id || !product_id) {
        logger.warn(`saveOrder called with missing parameters for user ID: ${userId}. Session: ${drive_session_id}, Order: ${drive_order_id}, Product: ${product_id}`);
        return res.status(400).json({ message: "Missing required parameters (drive_session_id, drive_order_id, product_id)." });
=======
    // The client now sends user_active_drive_item_id instead of drive_order_id
    const { user_active_drive_item_id } = req.body;

    if (user_active_drive_item_id === undefined || user_active_drive_item_id === null || isNaN(parseInt(user_active_drive_item_id))) {
        return res.status(400).json({ code: 1, info: 'Missing or invalid user_active_drive_item_id.' });
>>>>>>> main
    }
    const parsedUserActiveDriveItemId = parseInt(user_active_drive_item_id);

<<<<<<< HEAD
    // Validate ID formats (assuming they should be integers)
    const idRegex = /^\d+$/; // Corrected regex: was /^\\d+$/
    let numDriveOrderId, numProductId, numSessionId;

    try {
        const trimSessionId = String(drive_session_id).trim();
        if (!idRegex.test(trimSessionId)) {
            logger.warn(`Invalid drive_session_id format: ${drive_session_id}. Expected an integer string.`);
            return res.status(400).json({ message: `Invalid drive_session_id format. Must be an integer string. Received: '${drive_session_id}'` });
        }
        numSessionId = parseInt(trimSessionId, 10);

        const trimDriveOrderId = String(drive_order_id).trim();
        if (!idRegex.test(trimDriveOrderId)) {
            logger.warn(`Invalid drive_order_id format: ${drive_order_id}. Expected an integer string.`);
            return res.status(400).json({ message: `Invalid drive_order_id format. Must be an integer string. Received: '${drive_order_id}'` });
        }
        numDriveOrderId = parseInt(trimDriveOrderId, 10);

        const trimProductId = String(product_id).trim();
        if (!idRegex.test(trimProductId)) {
            logger.warn(`Invalid product_id format: ${product_id}. Expected an integer string.`);
            return res.status(400).json({ message: `Invalid product_id format. Must be an integer string. Received: '${product_id}'` });
        }
        numProductId = parseInt(trimProductId, 10);

    } catch (parseError) {
        logger.error(`Error parsing IDs in saveOrder: ${parseError.message}`, { drive_session_id, drive_order_id, product_id });
        return res.status(400).json({ message: "Invalid ID format. IDs must be convertible to integers." });
    }


    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        logger.debug(`Transaction started for saveOrder, session ID: ${numSessionId}, order ID: ${numDriveOrderId}`); // Added debug log
        
        // Verify the drive order and session
        logger.debug(`Verifying drive order ${numDriveOrderId} for session ${numSessionId} and user ${userId}`); // Added debug log
        const orderResult = await client.query(
            `SELECT drive_ord.id, drive_ord.status as order_status, ds.status as session_status, ds.user_id, ds.drive_configuration_id, ds.tasks_required, ds.tasks_completed, ds.commission_earned as session_commission_earned,
                    p.price as product_price, u.tier as user_tier
             FROM drive_orders drive_ord
             JOIN drive_sessions ds ON drive_ord.session_id = ds.id
             JOIN products p ON drive_ord.product_id = p.id
             JOIN users u ON ds.user_id = u.id
             WHERE drive_ord.id = $1 AND drive_ord.session_id = $2 AND drive_ord.product_id = $3 AND ds.user_id = $4`,
            [numDriveOrderId, numSessionId, numProductId, userId]
        );

        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.warn(`Order ${numDriveOrderId} not found or mismatched for session ${numSessionId}, product ${numProductId}, user ${userId}.`); // Changed to warn
            return res.status(404).json({ message: "Drive order not found, or does not match session/product, or access denied." });
        }

        const orderData = orderResult.rows[0];

        if (orderData.session_status !== 'active') {
            await client.query('ROLLBACK');
            logger.warn(`Attempt to save order ${numDriveOrderId} for a non-active session ${numSessionId} (status: ${orderData.session_status}).`); // Changed to warn
            return res.status(403).json({ message: `Cannot save order, drive session is not active. Status: ${orderData.session_status}` });
        }
        if (orderData.order_status === 'completed') {
            // If already completed, just return success with current state. This can happen with retries or refreshes.
            // Fetch the next pending order to help client continue
            logger.info(`Order ${numDriveOrderId} is already marked as completed for session ${numSessionId}.`); // Changed to info
            const nextPendingOrderResult = await client.query(
                `SELECT drive_ord.id, drive_ord.product_id, drive_ord.order_in_drive, drive_ord.status,
                        p.name AS product_name, p.price AS product_price, p.image_url AS product_image_url, p.description AS product_description
                 FROM drive_orders drive_ord
                 JOIN products p ON drive_ord.product_id = p.id
                 WHERE drive_ord.session_id = $1 AND drive_ord.status = 'pending'
                 ORDER BY drive_ord.order_in_drive ASC
                 LIMIT 1`,
                [numSessionId]
            );
            const nextPendingOrder = nextPendingOrderResult.rows.length > 0 ? nextPendingOrderResult.rows[0] : null;
            const updatedTasksCompleted = orderData.tasks_completed; // Use existing completed count

            await client.query('COMMIT'); // Commit as no changes were made, but we are returning a valid state.
            return res.status(200).json({
                message: "Order already completed.",
                order_status: 'completed',
                drive_session_id: numSessionId,
                next_order: nextPendingOrder,
                tasks_completed: updatedTasksCompleted,
                tasks_in_configuration: orderData.tasks_required,
                total_session_commission: parseFloat(orderData.session_commission_earned) // Return existing session commission
            });
        }

        // Mark the order as completed
        logger.debug(`Marking order ${numDriveOrderId} as completed for session ${numSessionId}.`); // Added debug log
        await client.query(
            'UPDATE drive_orders SET status = \'completed\' WHERE id = $1',
            [numDriveOrderId]
        );

        // Validate product_price before calculating commission
        const productPrice = parseFloat(orderData.product_price);

        if (isNaN(productPrice)) {
            await client.query('ROLLBACK');
            logger.error(`Invalid product_price for product ID ${numProductId} in order ${numDriveOrderId}: '${orderData.product_price}'. Cannot calculate commission.`);
            // The finally block will release the client
            return res.status(500).json({ message: "Internal server error: Invalid product price encountered." });
        }

        // Calculate commission for this specific order using the utility function
        let orderCommission = calculateCommission(productPrice, orderData.user_tier, 'drive_product_completion');
        // Ensure orderCommission is a number, default to 0 if calculateCommission returns NaN or undefined
        if (isNaN(orderCommission) || typeof orderCommission === 'undefined') {
            logger.warn(`Calculated commission for order ${numDriveOrderId} resulted in an invalid value (UserTier: ${orderData.user_tier}, ProductPrice: ${productPrice}). Defaulting to 0.`);
            orderCommission = 0;
        }
        logger.debug(`Calculated commission for order ${numDriveOrderId}: ${orderCommission} (UserTier: ${orderData.user_tier}, ProductPrice: ${productPrice})`);


        // Update user's main balance
        logger.debug(`Updating main balance for user ${userId} by ${orderCommission}`); // Added debug log
        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = \'main\'',
            [orderCommission, userId]
        );

        // Log the commission
        // const commissionLogId = uuidv4(); // ID is SERIAL, no need to generate here.
        const commissionDescription = `Commission for completing drive order ${numDriveOrderId} (Product ID: ${numProductId}) in drive session ${numSessionId}`;
        logger.debug(`Logging commission for user ${userId}, order ${numDriveOrderId}, amount ${orderCommission}, description: ${commissionDescription}`);
        await client.query(
            'INSERT INTO commission_logs (user_id, commission_amount, commission_type, description, source_action_id, account_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            [userId, orderCommission, 'direct_drive', commissionDescription, numDriveOrderId, 'main']
        );

        // Update the drive session: increment tasks_completed and add to commission_earned
        logger.debug(`Updating drive session ${numSessionId}: incrementing tasks_completed and commission_earned by ${orderCommission}`); // Added debug log
        const updatedSessionResult = await client.query(
            'UPDATE drive_sessions SET tasks_completed = tasks_completed + 1, commission_earned = commission_earned + $1 WHERE id = $2 RETURNING tasks_completed, commission_earned, tasks_required',
            [orderCommission, numSessionId]
        );
        const updatedSessionData = updatedSessionResult.rows[0];
        const currentTasksCompleted = updatedSessionData.tasks_completed;
        const currentSessionCommission = parseFloat(updatedSessionData.commission_earned);

        // Initialize nextPendingOrder variable for the response
        let nextPendingOrder = null;
        logger.debug(`Initialized nextPendingOrder as null for drive session ${numSessionId}`);
        let sessionStatus = 'active';

        if (currentTasksCompleted >= orderData.tasks_required) {
            // All tasks for this drive session are completed
            logger.info(`All ${orderData.tasks_required} tasks completed for drive session ${numSessionId}. Marking session as completed.`); // Changed to info
            await client.query(
                'UPDATE drive_sessions SET status = \'completed\', completed_at = NOW() WHERE id = $1',
                [numSessionId]
            );
            sessionStatus = 'completed';
            // Optionally, log a final drive completion event or trigger other processes
            logDriveOperation(userId, numSessionId, 'drive_completed', `Drive session completed with ${currentTasksCompleted} tasks and total commission ${currentSessionCommission}.`);        } else {
            // Fetch the next pending order
            logger.debug(`Fetching next pending order for session ${numSessionId} as not all tasks are complete yet (${currentTasksCompleted}/${orderData.tasks_required})`); // Added debug log
            const nextPendingOrderResult = await client.query(
                `SELECT drive_ord.id, drive_ord.product_id, drive_ord.order_in_drive, drive_ord.status,
                        p.name AS product_name, p.price AS product_price, p.image_url AS product_image_url, p.description AS product_description
                 FROM drive_orders drive_ord
                 JOIN products p ON drive_ord.product_id = p.id
                 WHERE drive_ord.session_id = $1 AND drive_ord.status = 'pending'
                 ORDER BY drive_ord.order_in_drive ASC
                 LIMIT 1`,
                [numSessionId]
            );
            if (nextPendingOrderResult.rows.length > 0) {
                nextPendingOrder = nextPendingOrderResult.rows[0];
                logger.debug(`Next order ID: ${nextPendingOrder.id} found for session ${numSessionId}`); // Added debug log
            } else {
                // This case should ideally not be hit if currentTasksCompleted < tasks_required
                // but as a safeguard:
                logger.warn(`Session ${numSessionId} not yet complete (${currentTasksCompleted}/${orderData.tasks_required}), but no next pending order found. This might indicate an issue.`); // Changed to warn
            }
        }
        await client.query('COMMIT');
        logger.debug(`Transaction committed for saveOrder, session ID: ${numSessionId}, order ID: ${numDriveOrderId}`); // Added debug log
        
        res.status(200).json({
            message: "Order saved successfully.",
            order_status: 'completed',
            drive_session_id: numSessionId,
            drive_session_status: sessionStatus, // 'active' or 'completed'
            next_order: nextPendingOrder,
            tasks_completed: currentTasksCompleted,
            tasks_in_configuration: orderData.tasks_required,
            order_commission: orderCommission, // Commission for this specific order
            total_session_commission: currentSessionCommission // Updated total commission for the session
        });
    } catch (error) {
        // Log the error and roll back transaction
        await client.query('ROLLBACK');
        logger.error(`Error in saveOrder for session ${drive_session_id}, order ${drive_order_id}, user ${userId} - ${error.message}`, { stack: error.stack }); // Enhanced error log
        res.status(500).json({ message: "Failed to save order.", error: error.message });
    } finally {
        client.release();
        logger.debug(`Client released for saveOrder, session ID: ${drive_session_id}, order ID: ${drive_order_id}`); // Added debug log
=======
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch active session and verify the submitted item is the current one
        const sessionResult = await client.query(
            `SELECT id, status, drive_configuration_id, current_user_active_drive_item_id, tasks_required
             FROM drive_sessions
             WHERE user_id = $1 AND status = 'active'
             ORDER BY started_at DESC LIMIT 1 FOR UPDATE`, // Lock the session row
            [userId]
        );

        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK'); client.release();
            return res.status(404).json({ code: 1, info: 'No active drive session found.' });
        }
        const session = sessionResult.rows[0];
        const driveSessionId = session.id;
        const driveConfigurationId = session.drive_configuration_id; // Store for later use
        const totalStepsInDrive = parseInt(session.tasks_required, 10); // From drive_configurations via admin setup

        if (session.current_user_active_drive_item_id !== parsedUserActiveDriveItemId) {
            await client.query('ROLLBACK'); client.release();
            logger.warn(`saveOrder: Attempt to save non-current user_active_drive_item. User: ${userId}, Submitted: ${parsedUserActiveDriveItemId}, Session Current: ${session.current_user_active_drive_item_id}`);
            return res.status(400).json({ code: 1, info: 'Submitted item is not the current active task for this session.' });
        }        // 2. Fetch details of the user_active_drive_item being processed (products, prices)
        const currentItemDetailsResult = await client.query(
            `SELECT uadi.id, uadi.user_status,
                    uadi.product_id_1, p1.price as p1_price, p1.id as p1_id,
                    uadi.product_id_2, p2.price as p2_price, p2.id as p2_id,
                    uadi.product_id_3, p3.price as p3_price, p3.id as p3_id
             FROM user_active_drive_items uadi
             LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
             LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
             LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
             WHERE uadi.id = $1 AND uadi.drive_session_id = $2
             FOR UPDATE OF uadi`, // Lock only the main table row, not the joined tables
            [parsedUserActiveDriveItemId, driveSessionId]
        );

        if (currentItemDetailsResult.rows.length === 0) {
            await client.query('ROLLBACK'); client.release();
            logger.error(`saveOrder: user_active_drive_item ${parsedUserActiveDriveItemId} not found for session ${driveSessionId}.`);
            return res.status(404).json({ code: 1, info: 'Active drive item not found.' });
        }
        const currentItem = currentItemDetailsResult.rows[0];

        if (currentItem.user_status !== 'CURRENT' && currentItem.user_status !== 'PENDING') { // PENDING if it's the very first item
             await client.query('ROLLBACK'); client.release();
            logger.warn(`saveOrder: Attempt to save item ${parsedUserActiveDriveItemId} with status ${currentItem.user_status}.`);
            return res.status(400).json({ code: 1, info: `Cannot save item with status ${currentItem.user_status}.` });
        }

        // Calculate total price of the current item (sum of its products)
        let itemTotalPrice = 0;
        const productsProcessedInItem = [];
        if (currentItem.p1_price) { itemTotalPrice += parseFloat(currentItem.p1_price); productsProcessedInItem.push(currentItem.p1_id); }
        if (currentItem.p2_price) { itemTotalPrice += parseFloat(currentItem.p2_price); productsProcessedInItem.push(currentItem.p2_id); }
        if (currentItem.p3_price) { itemTotalPrice += parseFloat(currentItem.p3_price); productsProcessedInItem.push(currentItem.p3_id); }        // 3. Check balance and update account
        const accountResult = await client.query(
            'SELECT id, balance FROM accounts WHERE user_id = $1 AND type = $2 FOR UPDATE',
            [userId, 'main']
        );
        if (accountResult.rows.length === 0) {
            await client.query('ROLLBACK'); client.release();
            throw new Error('User main account not found');
        }
        const account = accountResult.rows[0];
        const currentBalance = parseFloat(account.balance);        if (currentBalance < itemTotalPrice) {
            // Freeze the user's current balance (not the deficit or total needed)
            const frozenBalance = currentBalance.toFixed(2);
            const amountNeeded = (itemTotalPrice - currentBalance).toFixed(2);            await client.query(
                "UPDATE drive_sessions SET status = 'frozen', frozen_amount_needed = $1 WHERE id = $2",
                [frozenBalance, driveSessionId]
            );
            // Mark the current item as PENDING since balance is insufficient
            await client.query("UPDATE user_active_drive_items SET user_status = 'PENDING', updated_at = NOW() WHERE id = $1", [parsedUserActiveDriveItemId]);

            // Create notification for admin when user balance is frozen
            try {
                await client.query(
                    `INSERT INTO admin_notifications (type, title, message, data, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [
                        'balance_frozen',
                        'User Balance Frozen - Requires Manual Intervention',
                        `User ${userId} balance has been frozen at ${frozenBalance} USDT. They need ${amountNeeded} USDT more to continue their drive. User must top up externally and admin must manually unfreeze.`,
                        JSON.stringify({ 
                            userId, 
                            driveSessionId,
                            frozenBalance: frozenBalance,
                            currentBalance: frozenBalance,
                            amountNeeded: amountNeeded,
                            itemTotalPrice: itemTotalPrice.toFixed(2),
                            freezeReason: 'insufficient_balance'
                        })
                    ]
                );
            } catch (notificationError) {
                // Log error but don't fail the transaction
                console.error('Failed to create admin notification for frozen balance:', notificationError);
            }

            await client.query('COMMIT'); client.release();
            return res.status(400).json({
                code: 3,
                info: `Insufficient balance. Your current balance of ${frozenBalance} USDT has been frozen. You need ${amountNeeded} USDT more to continue. Please top up externally and contact admin to unfreeze your account.`,
                frozen_balance: frozenBalance,
                amount_needed: amountNeeded,
                status: 'frozen'
            });
        }// 4. Calculate commission using tier-based rates
        let calculatedItemCommission;
        if (productsProcessedInItem.length > 1) { // Combo - use merge data rate
            const commissionData = await tierCommissionService.calculateCommissionForUser(userId, itemTotalPrice, true);
            calculatedItemCommission = commissionData.commissionAmount;
        } else if (productsProcessedInItem.length === 1) { // Single product - use per data rate
            const commissionData = await tierCommissionService.calculateCommissionForUser(userId, itemTotalPrice, false);
            calculatedItemCommission = commissionData.commissionAmount;
        } else { // Should not happen if item has products
            calculatedItemCommission = 0;
        }

        const newBalance = currentBalance - itemTotalPrice + calculatedItemCommission;
        await client.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newBalance.toFixed(2), account.id]
        );

        // 5. Log commission for the item (can be one log entry for the whole item)
        await client.query(
            `INSERT INTO commission_logs
             (user_id, source_user_id, account_type, commission_amount, commission_type, description, reference_id, source_action_id, drive_session_id)
             VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, 'main', calculatedItemCommission.toFixed(2), 'data_drive_item',
             `Commission for drive item #${parsedUserActiveDriveItemId} (Products: ${productsProcessedInItem.join(', ')})`,
             parsedUserActiveDriveItemId.toString(), // reference_id is the user_active_drive_item_id
             productsProcessedInItem[0], // source_action_id can be the primary product ID
             driveSessionId
            ]
        );

        // 6. Mark current user_active_drive_item as COMPLETED
        await client.query(
            "UPDATE user_active_drive_items SET user_status = 'COMPLETED', updated_at = NOW() WHERE id = $1",
            [parsedUserActiveDriveItemId]
        );
        
        // Update drive progress (e.g., weekly stats)
        try {
            await driveProgressService.updateDriveCompletion(userId); // This function might need adjustment or be called per item
            logger.info(`Updated drive progress for user ${userId} after completing an item.`);
        } catch (progressError) {
            logger.error(`Error updating drive progress for user ${userId}: ${progressError.message}`);
        }


        // 7. Determine next user_active_drive_item or complete session
        const completedItemsCountResult = await client.query(
            "SELECT COUNT(*) FROM user_active_drive_items WHERE drive_session_id = $1 AND user_status = 'COMPLETED'",
            [driveSessionId]
        );
        const itemsCompletedSoFar = parseInt(completedItemsCountResult.rows[0].count, 10);

        let nextUserActiveDriveItemId = null;
        let sessionCompleted = false;

        if (itemsCompletedSoFar >= totalStepsInDrive) {
            sessionCompleted = true;
            await client.query(
                "UPDATE drive_sessions SET status = 'pending_reset', completed_at = NOW(), current_user_active_drive_item_id = NULL WHERE id = $1",
                [driveSessionId]
            );
        } else {
            // Find the next PENDING item by order_in_drive
            const nextItemResult = await client.query(
                `SELECT id FROM user_active_drive_items
                 WHERE drive_session_id = $1 AND user_status = 'PENDING'
                 ORDER BY order_in_drive ASC LIMIT 1`,
                [driveSessionId]
            );

            if (nextItemResult.rows.length > 0) {
                nextUserActiveDriveItemId = nextItemResult.rows[0].id;
                await client.query(
                    "UPDATE drive_sessions SET current_user_active_drive_item_id = $1 WHERE id = $2",
                    [nextUserActiveDriveItemId, driveSessionId]
                );
                await client.query(
                    "UPDATE user_active_drive_items SET user_status = 'CURRENT', updated_at = NOW() WHERE id = $1",
                    [nextUserActiveDriveItemId]
                );
            } else {
                // This case implies itemsCompletedSoFar < totalStepsInDrive, but no PENDING items found.
                // This could be an error state or mean the drive is effectively over if remaining items are SKIPPED/FAILED.
                // Let's assume for now this means an issue if not all are completed.
                await client.query('ROLLBACK'); client.release();
                logger.error(`saveOrder: Inconsistent state. ${itemsCompletedSoFar}/${totalStepsInDrive} items completed, but no next PENDING item found for session ${driveSessionId}.`);
                return res.status(500).json({ code: 1, info: 'Error: Could not determine next task. Inconsistent drive state.' });
            }
        }

        // 8. Fetch details for the response (next item or completion message)
        let responsePayload = {};
        const finalCommissionResult = await pool.query( // Use global pool for read-only after commit potentially
            `SELECT COALESCE(SUM(commission_amount), 0) as total_commission FROM commission_logs WHERE drive_session_id = $1`,
            [driveSessionId]
        );
        const totalSessionCommission = parseFloat(finalCommissionResult.rows[0]?.total_commission || 0).toFixed(2);

        if (sessionCompleted) {
            responsePayload = {
                code: 0,
                info: 'Drive completed successfully!',
                status: 'complete',
                tasks_completed: itemsCompletedSoFar,
                tasks_required: totalStepsInDrive,
                total_session_commission: totalSessionCommission
            };
        } else if (nextUserActiveDriveItemId) {
            // Fetch details of the next item to return to the client (similar to getOrder/getDriveStatus)
            const nextItemData = await client.query( // Use transaction client
                `SELECT uadi.id as user_active_drive_item_id,
                        p1.id as p1_id, p1.name as p1_name, p1.price as p1_price, p1.image_url as p1_image_url, p1.description as p1_description,
                        p2.id as p2_id, p2.name as p2_name, p2.price as p2_price, p2.image_url as p2_image_url,
                        p3.id as p3_id, p3.name as p3_name, p3.price as p3_price, p3.image_url as p3_image_url
                 FROM user_active_drive_items uadi
                 LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
                 LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
                 LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
                 WHERE uadi.id = $1`,
                [nextUserActiveDriveItemId]
            );
            const nextDetails = nextItemData.rows[0];
            let nextItemTotalPrice = 0;
            let nextItemCommission = 0;
            const nextProductsInItem = [];

            if (nextDetails.p1_id && nextDetails.p1_price) {
                const price = parseFloat(nextDetails.p1_price);
                nextItemTotalPrice += price;
                nextProductsInItem.push({ id: nextDetails.p1_id, name: nextDetails.p1_name, price: price, image_url: nextDetails.p1_image_url, description: nextDetails.p1_description });
            }
            if (nextDetails.p2_id && nextDetails.p2_price) {
                const price = parseFloat(nextDetails.p2_price);
                nextItemTotalPrice += price;
                nextProductsInItem.push({ id: nextDetails.p2_id, name: nextDetails.p2_name, price: price, image_url: nextDetails.p2_image_url });
            }
            if (nextDetails.p3_id && nextDetails.p3_price) {
                const price = parseFloat(nextDetails.p3_price);
                nextItemTotalPrice += price;
                nextProductsInItem.push({ id: nextDetails.p3_id, name: nextDetails.p3_name, price: price, image_url: nextDetails.p3_image_url });
            }            if (nextProductsInItem.length > 1) {
                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, nextItemTotalPrice, true);
                nextItemCommission = commissionData.commissionAmount;
            } else if (nextProductsInItem.length === 1) {
                const commissionData = await tierCommissionService.calculateCommissionForUser(userId, nextItemTotalPrice, false);
                nextItemCommission = commissionData.commissionAmount;
            }

            const primaryNextProduct = nextProductsInItem[0];
            responsePayload = {
                code: 0,
                info: 'Order saved, next item loaded.',
                tasks_completed: itemsCompletedSoFar,
                tasks_required: totalStepsInDrive,
                total_session_commission: totalSessionCommission,
                current_order: { // Keep 'current_order' key for frontend compatibility
                    user_active_drive_item_id: nextDetails.user_active_drive_item_id,
                    products: nextProductsInItem,
                    total_price: nextItemTotalPrice.toFixed(2),
                    order_commission: nextItemCommission.toFixed(2),
                    fund_amount: nextItemTotalPrice.toFixed(2),
                    product_number: uuidv4().substring(0, 18),
                    premium_status: 0,
                    product_id: primaryNextProduct?.id,
                    product_name: primaryNextProduct?.name,
                    product_image: primaryNextProduct?.image_url || './assets/uploads/products/newegg-1.jpg',
                    product_price: primaryNextProduct?.price.toFixed(2),
                    product_description: primaryNextProduct?.description,
                    is_combo: nextProductsInItem.length > 1
                }
            };
        } else {
            // Should not be reached if logic is correct (either session complete or next item found)
            await client.query('ROLLBACK'); client.release();
            logger.error(`saveOrder: Reached unexpected state post-completion. User: ${userId}, Session: ${driveSessionId}`);
            return res.status(500).json({ code: 1, info: 'An unexpected error occurred after saving the order.' });
        }

        await client.query('COMMIT');
        res.json(responsePayload);

    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (rbError) { logger.error('Rollback error in saveOrder:', rbError); }
        }
        logger.error(`Error in saveOrder for user ID ${userId}, Item ID ${user_active_drive_item_id}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ code: 1, info: 'Server error saving order: ' + error.message });
    } finally {
        if (client) client.release();
>>>>>>> main
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
<<<<<<< HEAD

    query += ` ORDER BY 
      CASE 
        WHEN drv_orders.status = 'current' THEN 0
        ELSE 1
      END,
      drv_orders.id ASC`;
    
    const ordersResult = await pool.query(query, queryParams);
    const orders = ordersResult.rows.map(order => ({
      order_id: order.order_id,
      product_id: order.product_id,
      product_name: order.product_name,
      product_image: order.product_image || './assets/uploads/products/newegg-1.jpg',
      product_price: parseFloat(order.product_price).toFixed(2),
      order_status: sessionStatus === 'frozen' ? 'frozen' : order.order_status
    }));

    res.json({ code: 0, orders });
  } catch (error) {
    logger.error(`Error getting drive orders for user ${userId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ code: 1, info: 'Server error getting drive orders: ' + error.message });
  }
=======
>>>>>>> main
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

<<<<<<< HEAD
const getActiveDriveSessionDetails = async (req, res) => {
    const userId = req.user.id;
    try {
        const activeSessionResult = await pool.query(
            `SELECT 
                ds.id AS drive_session_id, 
                ds.drive_configuration_id, 
                ds.status,
                ds.tasks_required AS tasks_in_configuration,
                ds.commission_earned AS total_session_commission,
                (SELECT COUNT(*) FROM drive_orders WHERE session_id = ds.id AND status = 'completed') AS tasks_completed_count
             FROM drive_sessions ds
             WHERE ds.user_id = $1 AND ds.status = 'active'`,
            [userId]
        );
        
        if (activeSessionResult.rows.length === 0) {
            return res.json({ active_session: false, message: 'No active drive session found.' });
        }
        
        const sessionDetails = activeSessionResult.rows[0];
        // Fetch the current pending order for this active session
        const currentOrderResult = await pool.query(
            `SELECT drive_ord.id, drive_ord.product_id, drive_ord.order_in_drive, drive_ord.status,
                    p.name AS product_name, p.price AS product_price, p.image_url AS product_image_url, p.description AS product_description
             FROM drive_orders drive_ord
             JOIN products p ON drive_ord.product_id = p.id
             WHERE drive_ord.session_id = $1 AND drive_ord.status = 'pending'
             ORDER BY drive_ord.order_in_drive ASC
             LIMIT 1`,
            [sessionDetails.drive_session_id]
        );

        const currentOrder = currentOrderResult.rows.length > 0 ? currentOrderResult.rows[0] : null;

        res.json({
            active_session: true,
            drive_session_id: sessionDetails.drive_session_id,
            drive_configuration_id: sessionDetails.drive_configuration_id,
            current_order: currentOrder,
            tasks_in_configuration: parseInt(sessionDetails.tasks_in_configuration, 10),
            tasks_completed: parseInt(sessionDetails.tasks_completed_count, 10),
            total_session_commission: parseFloat(sessionDetails.total_session_commission)
        });

    } catch (error) {
        logger.error(`Error fetching active drive session details for user ${userId}: ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: 'Failed to fetch active drive session details', error: error.message });
    }
};

module.exports = {
    startDrive,
    saveOrder,
    getOrder,
    saveComboOrder,
    saveComboProduct,
    getDriveOrders,
    getDriveStatus,
    getDriveProgress,
    getActiveDriveSessionDetails // Add new function to exports
=======
module.exports = {
  startDrive,
  getDriveStatus,
  getOrder,
  saveOrder,
  saveComboOrder,
  saveComboProduct,
  getDriveOrders,
  getDriveProgress
>>>>>>> main
};

const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid'); // For generating unique numbers like product_number
const logger = require('../logger'); // Import logger

// --- Helper Functions ---

/**
 * Fetches user's tier and main account balance.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<{tier: string, balance: number}>}
 */
async function getUserDriveInfo(userId) {
  logger.debug(`Fetching drive info for user ${userId}`);
  // Get tier from users table
  const userResult = await pool.query('SELECT tier FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    logger.error(`User not found for drive info: ${userId}`);
    throw new Error('User not found');
  }
  const tier = userResult.rows[0].tier || 'bronze'; // Default to bronze

  // Get balance from the 'main' account in the accounts table
  const accountResult = await pool.query(
      'SELECT balance FROM accounts WHERE user_id = $1 AND type = \'main\'',
      [userId]
  );
  // If user exists but has no main account row yet, treat balance as 0
  const balance = accountResult.rows.length > 0 ? parseFloat(accountResult.rows[0].balance) : 0;
  logger.debug(`User ${userId} info - Tier: ${tier}, Balance: ${balance}`);
  return {
      tier: tier,
      balance: balance
  };
}

/**
 * Gets a single available product for the user.
 * Basic version: selects a random active product.
 * TODO: Enhance with tier/balance filtering and combo logic per PRD.
 * @param {number} userId - The ID of the user.
 * @param {string} tier - The user's current tier.
 * @param {number} balance - The user's current main balance.
 * @returns {Promise<object|null>} - Product object or null if none found.
 */
async function getAvailableProduct(userId, tier, balance) {
    logger.debug(`Getting available product for user ${userId} (Tier: ${tier}, Balance: ${balance})`);
    // Basic query: Get one random active product
    // TODO: Add WHERE clause for min_tier <= user_tier (need tier comparison logic)
    // TODO: Consider min_balance_required filtering if needed server-side
    const query = 'SELECT * FROM products WHERE is_active = true ORDER BY RANDOM() LIMIT 1';
    const productsResult = await pool.query(query);

     if (productsResult.rows.length === 0) {
        logger.warn(`No active products found for user ${userId}`);
        return null; // No products available
    }
    logger.debug(`Found product ${productsResult.rows[0].id} for user ${userId}`);
    return productsResult.rows[0]; // Return the first (random) product found
}

// --- Controller Functions ---

/**
 * @desc    Initiate a data drive session (mimics task/suborder)
 * @route   POST /api/drive/start
 * @access  Private
 */
const startDrive = async (req, res) => {
  const userId = req.user.id;
  console.log(`User ${userId} attempting to start drive.`);

  try {
    // TODO: Implement PRD checks:
    // 1. Check daily drive limit (e.g., query a 'drive_sessions' table)
    // 2. Check if admin reset is needed (based on last drive status)
    // 3. Check balance requirements ($50/$100 - need to know which drive type this is)

    // Placeholder success response mimicking task.html expectation (code 0 means success)
    // The original API returned oid and add_id, which seem specific to that external system.
    // We might need to generate a session ID or similar here.
    const driveSessionId = uuidv4(); // Example session ID
    console.log(`Drive session ${driveSessionId} started for user ${userId}.`);
    // Need to store this session state in the DB eventually.

    res.json({
      code: 0, // 0 indicates success in the original task.html logic
      info: 'Data Drive initiated successfully.', // Or similar message
      // oid: driveSessionId, // Sending a session ID instead of 'oid'
      // add_id: null // Not clear what this was for, omitting for now
    });

  } catch (error) {
    console.error(`Error starting drive for user ${userId}:`, error);
    res.status(500).json({
        code: 1, // 1 indicates error in the original task.html logic
        info: 'Server error starting drive: ' + error.message
    });
  }
};

/**
 * @desc    Get details for the next order/product (mimics task/getorder)
 * @route   POST /api/drive/getorder
 * @access  Private
 */
const getOrder = async (req, res) => {
    const userId = req.user.id;
    console.log(`User ${userId} requesting next order.`);

    try {
        const { tier, balance } = await getUserDriveInfo(userId);

        // TODO: Implement logic to determine if it's a single product or combo based on user state/progress
        const isCombo = false; // Placeholder

        if (isCombo) {
            // TODO: Fetch multiple products for a combo
            // const comboProducts = await getComboProducts(userId, tier, balance);
            // res.json({ success: true, premium_status: 1, products: comboProducts, ... }); // Mimic combo structure
        } else {
            const product = await getAvailableProducts(userId, tier, balance);
            if (!product) {
                 return res.status(404).json({ success: false, message: 'No suitable products available for drive.' });
            }

            // Mimic the structure expected by task.html's updateOrderBox
            const orderData = {
                product_id: product.id,
                product_name: product.name,
                product_number: uuidv4().substring(0, 18), // Generate a unique task code like in task.html
                grabbed_date: new Date().toISOString(),
                product_image: product.image_url || './assets/uploads/products/newegg-1.jpg', // Placeholder image if none
                product_price: parseFloat(product.price),
                order_commission: parseFloat(product.price) * parseFloat(product.commission_rate), // Calculate commission
                fund_amount: parseFloat(product.price), // Seems to be same as price in task.html
                premium_status: 0 // 0 for single product
            };
             console.log(`Providing order for user ${userId}: Product ID ${product.id}`);
            res.json({ success: true, ...orderData });
        }

    } catch (error) {
        console.error(`Error getting order for user ${userId}:`, error);
        res.status(500).json({ success: false, message: 'Server error getting order: ' + error.message });
    }
};

/**
 * @desc    Save a completed single order (mimics task/saveorder)
 * @route   POST /api/drive/saveorder
 * @access  Private
 */
const saveOrder = async (req, res) => {
    const userId = req.user.id;
    const { product_id, order_amount, earning_commission, product_number } = req.body;
    console.log(`User ${userId} saving order: Product ${product_id}, Amount ${order_amount}, Commission ${earning_commission}`);

    // Validate input
    if (!product_id || order_amount === undefined || earning_commission === undefined || !product_number) {
        return res.status(400).json({ code: 1, info: 'Missing required order data.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get current user balance from accounts table
        const accountResult = await client.query(
            'SELECT id, balance FROM accounts WHERE user_id = $1 AND type = \'main\' FOR UPDATE',
            [userId]
        );
        if (accountResult.rows.length === 0) {
            throw new Error('User main account not found');
        }
        const account = accountResult.rows[0];
        const currentBalance = parseFloat(account.balance);
        const orderAmount = parseFloat(order_amount);
        const earnedCommission = parseFloat(earning_commission);

        // 2. Check if balance is sufficient (as per PRD, though task.html seems to rely on external logic)
        // This check should ideally happen *before* showing the product in getOrder
        if (currentBalance < orderAmount) {
             // TODO: Implement Frozen Balance logic here based on PRD
             console.warn(`User ${userId} has insufficient balance (${currentBalance}) for order amount (${orderAmount}). Freezing not yet implemented.`);
             // For now, reject if insufficient, though task.html implies it might proceed and freeze
             throw new Error(`Insufficient balance. Need ${orderAmount}, have ${currentBalance}.`);
        }

        // 3. Calculate new balance: current - product_cost + commission
        const newBalance = currentBalance - orderAmount + earnedCommission;

        // 4. Update account balance
        await client.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newBalance.toFixed(2), account.id]
        );

        // 5. Log the commission earned
        await client.query(
            `INSERT INTO commission_logs
             (user_id, source_user_id, account_type, commission_amount, commission_type, description, reference_id)
             VALUES ($1, $1, $2, $3, $4, $5, $6)`,
            [userId, 'main', earnedCommission, 'data_drive', `Commission for product #${product_id} (Task ${product_number})`, product_number]
        );

        // 6. Log the balance deduction (Optional - could be inferred from commission log and product price)
        // Consider adding a 'transactions' table for clearer history

        // 7. TODO: Update drive session status/progress (e.g., increment completed tasks)

        await client.query('COMMIT');
        console.log(`Order saved for user ${userId}. New balance: ${newBalance.toFixed(2)}`);
        res.json({ code: 0, info: 'Order Sent successfully!' }); // Mimic task.html success

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error saving order for user ${userId}:`, error);
        res.status(500).json({ code: 1, info: 'Server error saving order: ' + error.message });
    } finally {
        client.release();
    }
};

/**
 * @desc    Save a completed combo order (mimics task/savecomboorder)
 * @route   POST /api/drive/savecomboorder
 * @access  Private
 */
const saveComboOrder = async (req, res) => {
    const userId = req.user.id;
    // This endpoint in task.html seems redundant if savecomboproduct handles individual items.
    // It might be intended to finalize the combo transaction as a whole.
    const { order_amount, order_commission, product_number, total_combos } = req.body;
     console.log(`User ${userId} saving COMBO order summary: Task ${product_number}, Amount ${order_amount}, Commission ${order_commission}, Items ${total_combos}`);

    // TODO: Implement logic if needed. This might involve:
    // - Verifying that all individual combo products were saved via saveComboProduct.
    // - Updating the main drive session status.
    // - Potentially adjusting balance based on the *total* combo amount/commission if not handled per-product.
    // The current implementation assumes balance/commission is handled in saveOrder/saveComboProduct.

    // For now, just acknowledge receipt.
    res.json({ success: true, message: 'Combo order summary received.' }); // Generic success
};

/**
 * @desc    Save individual products within a combo (mimics task/savecomboproduct)
 * @route   POST /api/drive/savecomboproduct
 * @access  Private
 */
const saveComboProduct = async (req, res) => {
    const userId = req.user.id;
    const { combo_id, product_id, product_price, product_commission } = req.body; // Assuming these fields from task.html
    console.log(`User ${userId} saving COMBO PRODUCT: Combo ${combo_id}, Product ${product_id}, Price ${product_price}, Commission ${product_commission}`);

    // TODO: This logic is very similar to saveOrder. Refactor potential?
    // Need to decide if balance deduction/commission logging happens here per product,
    // or aggregated in saveComboOrder. The task.html logic suggests it might happen here.

    if (!combo_id || !product_id || product_price === undefined || product_commission === undefined) {
        return res.status(400).json({ code: 1, info: 'Missing required combo product data.' });
    }

     const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get current user balance
        const accountResult = await client.query(
            'SELECT id, balance FROM accounts WHERE user_id = $1 AND type = \'main\' FOR UPDATE',
            [userId]
        );
        if (accountResult.rows.length === 0) throw new Error('User main account not found');
        const account = accountResult.rows[0];
        const currentBalance = parseFloat(account.balance);
        const productPrice = parseFloat(product_price);
        const earnedCommission = parseFloat(product_commission);

        // 2. Check balance
        if (currentBalance < productPrice) {
            // TODO: Implement Frozen Balance logic
            throw new Error(`Insufficient balance for combo product #${product_id}. Need ${productPrice}, have ${currentBalance}.`);
        }

        // 3. Calculate new balance
        const newBalance = currentBalance - productPrice + earnedCommission;

        // 4. Update balance
        await client.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newBalance.toFixed(2), account.id]
        );

        // 5. Log commission
        await client.query(
            `INSERT INTO commission_logs
             (user_id, source_user_id, account_type, commission_amount, commission_type, description, reference_id)
             VALUES ($1, $1, $2, $3, $4, $5, $6)`,
            [userId, 'main', earnedCommission, 'data_drive_combo', `Commission for combo product #${product_id} (Combo ${combo_id})`, combo_id]
        );

        // 6. TODO: Update drive session progress

        await client.query('COMMIT');
         console.log(`Combo product saved for user ${userId}. New balance: ${newBalance.toFixed(2)}`);
        // task.html expects code 0 for success in the calling context (submitCombo -> savecomboproduct loop)
        res.json({ code: 0, info: 'Combo product saved successfully!' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error saving combo product for user ${userId}:`, error);
        // task.html expects code 1 for error
        res.status(500).json({ code: 1, info: 'Server error saving combo product: ' + error.message });
    } finally {
        client.release();
    }
};


module.exports = {
  startDrive,
  getOrder,
  saveOrder,
  saveComboOrder,
  saveComboProduct
};

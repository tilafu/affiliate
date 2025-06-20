const pool = require('../config/db'); // Import the database connection pool
const logger = require('../logger'); // Import logger

// Placeholder for other admin controller functions
// const getAllUsers = async (req, res) => { ... };
// const createProduct = async (req, res) => { ... };

/**
 * @desc    Update a user's membership tier
 * @route   PUT /api/admin/users/:userId/tier
 * @access  Private/Admin
 */
const updateUserTier = async (req, res) => {
  const { userId } = req.params;
  const { tier } = req.body; // Expecting { "tier": "gold" } in the request body

  // Validate the tier value
  const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
  if (!tier || !validTiers.includes(tier.toLowerCase())) {
    return res.status(400).json({ message: 'Invalid tier provided. Must be one of: ' + validTiers.join(', ') });
  }

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user's tier
    const result = await pool.query(
      'UPDATE users SET tier = $1 WHERE id = $2 RETURNING id, username, email, tier',
      [tier.toLowerCase(), userId]
    );

    if (result.rows.length > 0) {
      logger.info(`Admin ${req.user.id} updated tier for user ${userId} to ${tier}`); // Use logger
      res.json({ success: true, message: `User tier updated to ${tier}`, user: result.rows[0] });
    } else {
      // Should not happen if userCheck passed, but good practice
      res.status(404).json({ message: 'User not found or update failed' });
    }

  } catch (error) {
    logger.error('Error updating user tier:', { error: error.message, stack: error.stack }); // Use logger
    res.status(500).json({ message: 'Server error updating user tier' });
  }
};

/**
 * @desc    Create a new data drive product
 * @route   POST /api/admin/products
 * @access  Private/Admin
 */
const createProduct = async (req, res) => {
  const { name, price, description, min_balance_required = 0, image_url = null } = req.body; 

  // Basic validation
  if (!name || price === undefined) {
    return res.status(400).json({ message: 'Missing required fields: name, price' });
  }
  if (isNaN(parseFloat(price)) || isNaN(parseFloat(min_balance_required))) {
      return res.status(400).json({ message: 'Price and min_balance_required must be numbers' });
  }

  try {
    // Insert product with available columns (commission is now calculated by tier)
    const result = await pool.query(
      'INSERT INTO products (name, price, description, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, parseFloat(price), description || null, image_url] 
    );

    logger.info(`Admin ${req.user.id} created product ${result.rows[0].id}`);
    res.status(201).json({ success: true, message: 'Product created successfully', product: result.rows[0] });

  } catch (error) {
    logger.error('Error creating product:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error creating product' });
  }
};

/**
 * @desc    Get all data drive products
 * @route   GET /api/admin/products
 * @access  Private/Admin
 */
const getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, products: result.rows });
  } catch (error) {
    logger.error('Error fetching products:', { error: error.message, stack: error.stack }); // Use logger
    res.status(500).json({ message: 'Server error fetching products' });
  }
};

/**
 * @desc    Get a single product by ID
 * @route   GET /api/admin/products/:productId
 * @access  Private/Admin
 */
const getProductById = async (req, res) => {
    const { productId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        logger.error(`Error fetching product ${productId}:`, { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching product' });
    }
};

/**
 * @desc    Update an existing data drive product
 * @route   PUT /api/admin/products/:productId
 * @access  Private/Admin
 */
const updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { name, price, description, min_balance_required, image_url } = req.body; 

  // Validate input (similar to create, but allow partial updates)
  if (price !== undefined && isNaN(parseFloat(price))) return res.status(400).json({ message: 'Price must be a number' });
  if (min_balance_required !== undefined && isNaN(parseFloat(min_balance_required))) return res.status(400).json({ message: 'Min balance required must be a number' });

  try {
    // Check if product exists
     const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
     if (productCheck.rows.length === 0) {
       return res.status(404).json({ message: 'Product not found' });
     }

    // Build the update query dynamically based on provided fields
    const fieldsToUpdate = [];
    const values = [];
    let queryIndex = 1;

    if (name !== undefined) { fieldsToUpdate.push(`name = $${queryIndex++}`); values.push(name); }
    if (price !== undefined) { fieldsToUpdate.push(`price = $${queryIndex++}`); values.push(parseFloat(price)); }
    if (description !== undefined) { fieldsToUpdate.push(`description = $${queryIndex++}`); values.push(description); }
    if (image_url !== undefined) { fieldsToUpdate.push(`image_url = $${queryIndex++}`); values.push(image_url); }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    values.push(productId); // Add productId for the WHERE clause

    const updateQuery = `UPDATE products SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING *`;

    const result = await pool.query(updateQuery, values);    if (result.rows.length > 0) {
      logger.info(`Admin ${req.user.id} updated product ${productId}`);
      res.json({ success: true, message: 'Product updated successfully', product: result.rows[0] });
    } else {
      res.status(404).json({ message: 'Product not found or update failed' });
    }

  } catch (error) {
    logger.error(`Error updating product ${productId}:`, { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Server error updating product' });
  }
};

/**
 * @desc    Delete a data drive product
 * @route   DELETE /api/admin/products/:productId
 * @access  Private/Admin
 */
const deleteProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);

    if (result.rows.length > 0) {
      logger.info(`Admin ${req.user.id} deleted product ${productId}`); // Use logger
      res.json({ success: true, message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }

  } catch (error) {
    logger.error(`Error deleting product ${productId}:`, { error: error.message, stack: error.stack }); // Use logger
    // Consider foreign key constraints if products are linked elsewhere
    res.status(500).json({ message: 'Server error deleting product' });
  }
};

/**
 * @desc    Manually add a deposit or withdrawal for a user's main account
 * @route   POST /api/admin/users/:userId/transactions
 * @access  Private/Admin
 */
const manualTransaction = async (req, res) => {
  const { userId } = req.params;
  const { type, amount, description = '' } = req.body; // type: 'deposit' or 'withdrawal'

  // Log the received request body
  logger.info(`[manualTransaction] Received request for user ${userId} with body: ${JSON.stringify(req.body)}`);

  // Validate input
  if (!type || (type !== 'deposit' && type !== 'withdrawal')) {
    return res.status(400).json({ message: 'Invalid transaction type. Must be "deposit" or "withdrawal".' });
  }
  if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Invalid amount. Must be a positive number.' });
  }

  const transactionAmount = parseFloat(amount);
  const client = await pool.connect(); // Get client for transaction

  try {
    logger.debug('Starting manual transaction'); // Use logger
    await client.query('BEGIN'); // Start transaction

    // 1. Check if user exists
    logger.debug(`Checking if user ${userId} exists`); // Use logger
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Get user's main account
    logger.debug(`Getting main account for user ${userId}`); // Use logger
    const accountResult = await client.query(
      'SELECT id, balance FROM accounts WHERE user_id = $1 AND type = \'main\' FOR UPDATE', // Lock row for update
      [userId]
    );

    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'User main account not found' });
    }

    const account = accountResult.rows[0];
    let newBalance;

    // 3. Perform transaction logic
    logger.debug(`Performing ${type} of ${transactionAmount}`); // Use logger
    logger.debug(`Current balance: ${account.balance}`); // Use logger
    if (type === 'deposit') {
      newBalance = parseFloat(account.balance) + transactionAmount;
      logger.debug(`New balance after deposit: ${newBalance}`); // Use logger
    } else { // withdrawal
      if (parseFloat(account.balance) < transactionAmount) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: 'Insufficient balance for withdrawal' });
      }
      newBalance = parseFloat(account.balance) - transactionAmount;
      logger.debug(`New balance after withdrawal: ${newBalance}`); // Use logger
    }

    // 4. Update account balance
    logger.debug(`Updating account balance to ${newBalance.toFixed(2)}`); // Use logger
    await client.query(
      'UPDATE accounts SET balance = $1 WHERE id = $2',
      [newBalance.toFixed(2), account.id] // Ensure 2 decimal places
    );

    // 5. Log the manual transaction (Optional but recommended - using commission_logs for now)
    // Ideally, create a separate manual_transactions table.
    const logType = type === 'deposit' ? 'admin_deposit' : 'admin_withdrawal';
    const logDescription = `Admin manual ${type}: ${description || '(No description)'}`;
    logger.debug(`Logging transaction type: ${logType}, description: ${logDescription}`); // Use logger
    await client.query(
      `INSERT INTO commission_logs
       (user_id, source_user_id, account_type, commission_amount, commission_type, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, req.user.id, 'main', transactionAmount, logType, logDescription] // Log admin ID as source
    );

    logger.debug('Committing transaction'); // Use logger
    await client.query('COMMIT'); // Commit transaction

    logger.info(`Admin ${req.user.id} performed manual ${type} of ${transactionAmount} for user ${userId}`); // Use logger
    res.json({ success: true, message: `Manual ${type} successful. New balance: ${newBalance.toFixed(2)}` });

  } catch (error) {
    logger.error(`Error performing manual transaction for user ${userId}:`, { error: error.message, stack: error.stack }); // Use logger
    await client.query('ROLLBACK'); // Rollback on error
    res.status(500).json({ message: 'Server error performing manual transaction' });
  } finally {
    client.release(); // Release client back to pool
  }
};

/**
 * @desc    Get all users with basic info and main account balance
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
  try {
    // Join users with their main account to get balance
    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.tier,
        u.role,
        u.referral_code,
        u.created_at,
        COALESCE(a.balance, 0) AS main_balance -- Use COALESCE to handle users without an account row
      FROM users u
      LEFT JOIN accounts a ON u.id = a.user_id AND a.type = 'main'
      ORDER BY u.created_at DESC
    `);

    // Convert balance to number
    const users = result.rows.map(user => ({
        ...user,
        main_balance: parseFloat(user.main_balance)
    }));

    res.json({ success: true, users: users });
  } catch (error) {
    logger.error('Error fetching users for admin:', { error: error.message, stack: error.stack }); // Use logger
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

/**
 * @desc    Get all users with frozen drive sessions
 * @route   GET /api/admin/users/frozen
 * @access  Private/Admin
 */
const getFrozenUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT
                u.id,
                u.username,
                u.email,
                COALESCE(a.balance, 0) AS current_balance,
                ds.id as drive_session_id,
                ds.frozen_amount_needed,
                ds.created_at as session_created_at,
                COUNT(ds.id) as frozen_sessions_count
            FROM users u
            LEFT JOIN accounts a ON u.id = a.user_id AND a.type = 'main'
            INNER JOIN drive_sessions ds ON u.id = ds.user_id
            WHERE ds.status = 'frozen'
            GROUP BY u.id, u.username, u.email, a.balance, ds.id, ds.frozen_amount_needed, ds.created_at
            ORDER BY ds.created_at DESC
        `);

        // Format the data for better readability
        const frozenUsers = result.rows.map(user => ({
            ...user,
            current_balance: parseFloat(user.current_balance),
            frozen_amount_needed: user.frozen_amount_needed ? parseFloat(user.frozen_amount_needed) : 0
        }));        res.json({ success: true, frozenUsers: frozenUsers });
    } catch (error) {
        logger.error('Error fetching frozen users:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching frozen users' });
    }
};

/**
 * @desc    Reset a user's drive session status
 * @route   POST /api/admin/users/:userId/reset-drive
 * @access  Private/Admin
 */
const resetDrive = async (req, res) => {    const { userId } = req.params;
    const adminUserId = req.user.id; // ID of the admin performing the action

    logger.info(`Admin ${adminUserId} attempting to reset drive for user ${userId}`);

    try {
        // Find ALL session IDs that need reset (any status except 'completed')
        const sessionsToResetResult = await pool.query(
            `SELECT id, status FROM drive_sessions
             WHERE user_id = $1 
             AND status != 'completed'
             ORDER BY created_at DESC`,
            [userId]
        );

        const sessionIdsToReset = sessionsToResetResult.rows.map(row => row.id);

        if (sessionIdsToReset.length === 0) {
            logger.warn(`No drive session found needing reset for user ${userId}.`);
            return res.status(404).json({ success: false, message: 'No drive session found needing reset for this user.' });
        }        // Update the status of ALL found sessions to 'completed'
        const newStatus = 'completed';
        await pool.query(
            `UPDATE drive_sessions SET 
                status = $1, 
                completed_at = NOW()
             WHERE id = ANY($2::int[])`, // Use ANY to update multiple IDs
            [newStatus, sessionIdsToReset] // Pass the array of IDs
        );

        // IMPORTANT: Clear the user's assigned drive configuration so they cannot start a new drive
        // until an admin explicitly assigns a new configuration
        await pool.query(
            'UPDATE users SET assigned_drive_configuration_id = NULL WHERE id = $1',
            [userId]
        );

        logger.info(`Admin ${adminUserId} successfully reset ${sessionIdsToReset.length} drive session(s) for user ${userId}. Session IDs: ${sessionIdsToReset.join(', ')}. Status set to '${newStatus}'. Drive configuration assignment cleared.`);
        res.json({ success: true, message: `Successfully updated status of ${sessionIdsToReset.length} drive session(s) to '${newStatus}'. User's drive configuration cleared - admin must assign new configuration before user can start a new drive.` });

    } catch (error) {
        logger.error(`Error resetting drive for user ${userId}:`, { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error resetting drive session.' });
    }
};

/**
 * @desc    Get all support messages
 * @route   GET /api/admin/support-messages
 * @access  Private/Admin
 */
const getAllSupportMessages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         sm.*, 
         u.username AS sender_username,
         u.email AS sender_email
       FROM support_messages sm
       JOIN users u ON sm.sender_id = u.id
       ORDER BY sm.created_at DESC`
    );
    res.json({ success: true, messages: result.rows });
  } catch (error) {
    logger.error('Error fetching support messages for admin:', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
};

/**
 * @desc    Send a notification to a user
 * @route   POST /api/admin/notifications
 * @access  Private/Admin
 */
const sendNotification = async (req, res) => {
    const { user_id, category_id, title, message, image_url = null, priority = 1 } = req.body;
    
    // Validation
    if (!user_id || !category_id || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'User ID, category ID, and message are required' 
        });
    }

    try {
        let actualUserId = user_id;
        
        // If user_id is not a number, try to find user by username
        if (isNaN(user_id)) {
            const userByUsername = await pool.query('SELECT id FROM users WHERE username = $1', [user_id]);
            if (userByUsername.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found with username: ' + user_id 
                });
            }
            actualUserId = userByUsername.rows[0].id;
        } else {
            // Check if user exists by ID
            const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [actualUserId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found with ID: ' + user_id 
                });
            }
        }

        // Insert notification
        await pool.query(`
            INSERT INTO notifications 
            (user_id, category_id, title, message, image_url, priority, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [actualUserId, category_id, title, message, image_url, priority]);

        logger.info(`Admin ${req.user.id} sent notification to user ${actualUserId}: ${title || message.substring(0, 50)}`);
        res.json({ success: true, message: 'Notification sent successfully' });
    } catch (error) {
        logger.error('Error sending notification:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error sending notification' });
    }
};

// Dashboard Statistics
const getDashboardStats = async (req, res) => {
    try {
        // Get stats in parallel for better performance
        const [
            usersResult,
            depositsResult,
            withdrawalsResult,
            drivesResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users'),
            pool.query('SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = $1', ['APPROVED']),
            pool.query('SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = $1', ['APPROVED']),
            pool.query('SELECT COUNT(*) FROM drives WHERE status = $1', ['ACTIVE'])
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers: parseInt(usersResult.rows[0].count),
                totalDeposits: parseFloat(depositsResult.rows[0].coalesce),
                totalWithdrawals: parseFloat(withdrawalsResult.rows[0].coalesce),
                activeDrives: parseInt(drivesResult.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching dashboard statistics' });
    }
};

// Deposit Management
/**
 * @desc    Get all pending deposit requests for admin
 * @route   GET /api/admin/deposits
 * @access  Private/Admin
 */
const getDeposits = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.*, u.username
            FROM deposits d
            JOIN users u ON d.user_id = u.id
            WHERE d.status = 'PENDING'
            ORDER BY d.created_at DESC
        `);

        res.json({ success: true, deposits: result.rows });
    } catch (error) {
        console.error('Error fetching pending deposits:', error);
        res.status(500).json({ success: false, message: 'Error fetching pending deposits' });
    }
};

/**
 * @desc    Approve a deposit request
 * @route   POST /api/admin/deposits/:id/approve
 * @access  Private/Admin
 */
const approveDeposit = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get deposit details
        const depositResult = await client.query(
            'SELECT * FROM deposits WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (depositResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Deposit not found' });
        }

        const deposit = depositResult.rows[0];
        if (deposit.status !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Deposit is not in pending state' });
        }

        // Update deposit status
        await client.query(
            'UPDATE deposits SET status = $1, updated_at = NOW() WHERE id = $2',
            ['APPROVED', id]
        );

        // Update user's balance
        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = $3',
            [deposit.amount, deposit.user_id, 'main']
        );

        // Optional: Log this transaction in commission_logs or a dedicated transaction log
        // For now, we'll rely on the deposits table status change as the record.

        await client.query('COMMIT');
        res.json({ success: true, message: 'Deposit approved successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error approving deposit:', error);
        res.status(500).json({ success: false, message: 'Error approving deposit' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Reject a deposit request
 * @route   POST /api/admin/deposits/:id/reject
 * @access  Private/Admin
 */
const rejectDeposit = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'UPDATE deposits SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3',
            ['REJECTED', id, 'PENDING']
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ success: false, message: 'Deposit not found or not in pending state' });
        }

        res.json({ success: true, message: 'Deposit rejected successfully' });
    } catch (error) {
        console.error('Error rejecting deposit:', error);
        res.status(500).json({ success: false, message: 'Error rejecting deposit' });
    }
};

/**
 * @desc    Get all pending withdrawal requests for admin
 * @route   GET /api/admin/withdrawals
 * @access  Private/Admin
 */
const getWithdrawals = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT w.*, u.username
            FROM withdrawals w
            JOIN users u ON w.user_id = u.id
            WHERE w.status = 'PENDING'
            ORDER BY w.created_at DESC
        `);

        res.json({ success: true, withdrawals: result.rows });
    } catch (error) {
        console.error('Error fetching pending withdrawals:', error);
        res.status(500).json({ success: false, message: 'Error fetching pending withdrawals' });
    }
};

/**
 * @desc    Approve a withdrawal request
 * @route   POST /api/admin/withdrawals/:id/approve
 * @access  Private/Admin
 */
const approveWithdrawal = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get withdrawal details
        const withdrawalResult = await client.query(
            'SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (withdrawalResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Withdrawal not found' });
        }

        const withdrawal = withdrawalResult.rows[0];
        if (withdrawal.status !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Withdrawal is not in pending state' });
        }

        // Update withdrawal status
        await client.query(
            'UPDATE withdrawals SET status = $1, updated_at = NOW() WHERE id = $2',
            ['APPROVED', id]
        );

        // ** The amount was already deducted from the user's balance upon request. **
        // ** No further balance deduction is needed here. **

        // Optional: Log this transaction in commission_logs or a dedicated transaction log
        // For now, we'll rely on the withdrawals table status change as the record.

        await client.query('COMMIT');
        res.json({ success: true, message: 'Withdrawal approved successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error approving withdrawal:', error);
        res.status(500).json({ success: false, message: 'Error approving withdrawal' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Reject a withdrawal request
 * @route   POST /api/admin/withdrawals/:id/reject
 * @access  Private/Admin
 */
const rejectWithdrawal = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get withdrawal details
        const withdrawalResult = await client.query(
            'SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (withdrawalResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Withdrawal not found' });
        }

        const withdrawal = withdrawalResult.rows[0];
        if (withdrawal.status !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Withdrawal is not in pending state' });
        }

        // Update withdrawal status
        await client.query(
            'UPDATE withdrawals SET status = $1, updated_at = NOW() WHERE id = $2',
            ['REJECTED', id]
        );

        // Refund the amount back to user's account
        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = $3',
            [withdrawal.amount, withdrawal.user_id, 'main']
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Withdrawal rejected and amount refunded' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error rejecting withdrawal:', error);
        res.status(500).json({ success: false, message: 'Error rejecting withdrawal' });
    } finally {
        client.release();
    }
};

// Drive Management
const getDrives = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id as user_id,
                u.username,
                COUNT(d.id) as total_drives,
                COALESCE(SUM(d.commission), 0) as total_commission,
                MAX(d.created_at) as last_drive,
                CASE WHEN COUNT(CASE WHEN d.status = 'ACTIVE' THEN 1 END) > 0 
                     THEN 'ACTIVE' ELSE 'INACTIVE' END as status
            FROM users u
            LEFT JOIN drives d ON u.id = d.user_id
            GROUP BY u.id, u.username
            ORDER BY total_drives DESC
        `);
        
        res.json({ success: true, drives: result.rows });
    } catch (error) {
        console.error('Error fetching drives:', error);
        res.status(500).json({ success: false, message: 'Error fetching drives data' });
    }
};

// Get drive history for a specific user
const getDriveLogs = async (req, res) => {
    const { userId } = req.params;
    try {
        // Temporarily modified due to "column dor.product_id does not exist" error.
        // This means the 'drive_orders' table in the DB is missing the 'product_id' column.
        // The product_name will be 'N/A' until the database schema is corrected
        // as per 'sql/add_drive_orders_table.sql'.
        const result = await pool.query(`
            SELECT
                d.id,
                d.created_at,
                d.status,
                COALESCE(d.commission_earned, 0) as commission_amount,
                'N/A' as product_name, -- Product name is temporarily unavailable
                d.user_id
            FROM drive_sessions d
            -- The following JOINs were removed because dor.product_id is missing in the current DB schema:
            -- LEFT JOIN drive_orders dor ON dor.session_id = d.id
            -- LEFT JOIN products p ON dor.product_id = p.id
            WHERE d.user_id = $1
            ORDER BY d.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            history: result.rows
        });
    } catch (error) {
        logger.error('Error fetching drive logs:', { error: error.message, stack: error.stack, query: error.query, detail: error.detail }); // Enhanced logging
        res.status(500).json({
            success: false,
            message: 'Error fetching drive history. Check server logs for details.' // More generic message to user
        });
    }
};

// Support Messages Management
const replyToSupportMessage = async (req, res) => {
    const { message_id, user_id, message } = req.body;
    const adminId = req.user.id;
    
    logger.debug(`replyToSupportMessage called with: adminId=${adminId}, user_id=${user_id}, message_id=${message_id}, message=${message}`);

    try {
        // Mark original message as read
        await pool.query(
            'UPDATE support_messages SET is_read = true WHERE id = $1',
            [message_id]
        );
        
        // Create reply message
        await pool.query(
            'INSERT INTO support_messages (sender_id, sender_role, recipient_id, message, thread_id) VALUES ($1, $2, $3, $4, $5)',
            [adminId, 'admin', user_id, message, message_id]
        );
        
        // Create notification for user
        await pool.query(
            'INSERT INTO admin_notifications (user_id, type, message) VALUES ($1, $2, $3)',
            [user_id, 'SUPPORT_REPLY', 'You have received a reply to your support message']
        );
        
        res.json({ success: true, message: 'Reply sent successfully' });
    } catch (error) {
        console.error('Error sending support message reply:', error);
        res.status(500).json({ success: false, message: 'Error sending reply' });
    }
};

// Placeholder for endDrive function
const endDrive = async (req, res) => {
    const { driveId } = req.params;
    const adminUserId = req.user.id;
    logger.info(`Admin ${adminUserId} attempting to end drive ${driveId}`);
    // TODO: Implement logic to end a drive session
    // For example, update drive_sessions table, calculate final earnings, etc.
    res.status(501).json({ success: false, message: `Drive ending for ${driveId} not yet implemented.` });
};

// Membership Tiers Management

/**
 * @desc    Get all membership tiers
 * @route   GET /api/admin/membership-tiers
 * @access  Private/Admin
 */
const getMembershipTiers = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM membership_tiers ORDER BY price_usd ASC'
        );
        res.json({ success: true, tiers: result.rows });
    } catch (error) {
        logger.error('Error fetching membership tiers:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error fetching membership tiers' });
    }
};

/**
 * @desc    Create a new membership tier
 * @route   POST /api/admin/membership-tiers
 * @access  Private/Admin
 */
const createMembershipTier = async (req, res) => {
    const {
        tier_name,
        price_usd,
        commission_per_data_percent,
        commission_merge_data_percent,
        data_per_set_limit,
        sets_per_day_limit,
        withdrawal_limit_usd,
        max_daily_withdrawals,
        handling_fee_percent
    } = req.body;

    // Basic validation
    if (!tier_name || !price_usd || !commission_per_data_percent || !commission_merge_data_percent) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO membership_tiers 
            (tier_name, price_usd, commission_per_data_percent, commission_merge_data_percent,
             data_per_set_limit, sets_per_day_limit, withdrawal_limit_usd, max_daily_withdrawals, handling_fee_percent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [tier_name, price_usd, commission_per_data_percent, commission_merge_data_percent,
             data_per_set_limit, sets_per_day_limit, withdrawal_limit_usd, max_daily_withdrawals, handling_fee_percent]
        );

        logger.info(`Admin ${req.user.id} created membership tier ${tier_name}`);
        res.status(201).json({ success: true, message: 'Membership tier created successfully', tier: result.rows[0] });
    } catch (error) {
        logger.error('Error creating membership tier:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error creating membership tier' });
    }
};

/**
 * @desc    Update a membership tier
 * @route   PUT /api/admin/membership-tiers/:id
 * @access  Private/Admin
 */
const updateMembershipTier = async (req, res) => {
    const { id } = req.params;
    const {
        tier_name,
        price_usd,
        commission_per_data_percent,
        commission_merge_data_percent,
        data_per_set_limit,
        sets_per_day_limit,
        withdrawal_limit_usd,
        max_daily_withdrawals,
        handling_fee_percent,
        is_active
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE membership_tiers SET 
            tier_name = $1, price_usd = $2, commission_per_data_percent = $3, commission_merge_data_percent = $4,
            data_per_set_limit = $5, sets_per_day_limit = $6, withdrawal_limit_usd = $7, 
            max_daily_withdrawals = $8, handling_fee_percent = $9, is_active = $10, updated_at = CURRENT_TIMESTAMP
            WHERE id = $11 RETURNING *`,
            [tier_name, price_usd, commission_per_data_percent, commission_merge_data_percent,
             data_per_set_limit, sets_per_day_limit, withdrawal_limit_usd, max_daily_withdrawals, handling_fee_percent, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Membership tier not found' });
        }

        logger.info(`Admin ${req.user.id} updated membership tier ${id}`);
        res.json({ success: true, message: 'Membership tier updated successfully', tier: result.rows[0] });
    } catch (error) {
        logger.error('Error updating membership tier:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error updating membership tier' });
    }
};

/**
 * @desc    Delete a membership tier
 * @route   DELETE /api/admin/membership-tiers/:id
 * @access  Private/Admin
 */
const deleteMembershipTier = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM membership_tiers WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Membership tier not found' });
        }

        logger.info(`Admin ${req.user.id} deleted membership tier ${id}`);
        res.json({ success: true, message: 'Membership tier deleted successfully' });
    } catch (error) {
        logger.error('Error deleting membership tier:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error deleting membership tier' });
    }
};

// Tier Quantity Configuration Management

/**
 * @desc    Get all tier quantity configurations
 * @route   GET /api/admin/tier-quantity-configs
 * @access  Private/Admin
 */
const getTierQuantityConfigs = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM tier_quantity_configs ORDER BY tier_name ASC'
        );
        res.json({ success: true, configs: result.rows });
    } catch (error) {
        logger.error('Error fetching tier quantity configs:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error fetching tier quantity configurations' });
    }
};

/**
 * @desc    Update a tier quantity configuration
 * @route   PUT /api/admin/tier-quantity-configs/:id
 * @access  Private/Admin
 */
const updateTierQuantityConfig = async (req, res) => {
    const { id } = req.params;
    const { quantity_limit, is_active } = req.body;

    if (!quantity_limit || quantity_limit <= 0) {
        return res.status(400).json({ message: 'Quantity limit must be a positive number' });
    }

    try {
        const result = await pool.query(
            'UPDATE tier_quantity_configs SET quantity_limit = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [quantity_limit, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Tier quantity configuration not found' });
        }

        logger.info(`Admin ${req.user.id} updated tier quantity config ${id}`);
        res.json({ success: true, message: 'Tier quantity configuration updated successfully', config: result.rows[0] });
    } catch (error) {
        logger.error('Error updating tier quantity config:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Server error updating tier quantity configuration' });
    }
};

/**
 * @desc    Unfreeze a user's account by reactivating frozen drive sessions
 * @route   POST /api/admin/users/:userId/unfreeze
 * @access  Private/Admin
 */
const unfreezeUser = async (req, res) => {
    const { userId } = req.params;
    const adminUserId = req.user.id;

    logger.info(`Admin ${adminUserId} attempting to unfreeze user ${userId}`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if user exists
        const userResult = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const username = userResult.rows[0].username;

        // Find all frozen drive sessions for this user
        const frozenSessionsResult = await client.query(
            'SELECT id FROM drive_sessions WHERE user_id = $1 AND status = $2',
            [userId, 'frozen']
        );

        if (frozenSessionsResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'No frozen sessions found for this user' });
        }

        const sessionIds = frozenSessionsResult.rows.map(row => row.id);

        // Reactivate frozen drive sessions
        await client.query(
            'UPDATE drive_sessions SET status = $1, frozen_amount_needed = NULL WHERE user_id = $2 AND status = $3',
            ['active', userId, 'frozen']
        );

        // Reactivate any pending drive items for these sessions
        await client.query(
            'UPDATE drives SET status = $1 WHERE session_id = ANY($2::int[]) AND status = $3',
            ['pending', sessionIds, 'frozen']
        );

        // Create admin notification for the unfreeze action
        const notificationMessage = `Admin unfroze account for user ${username} (ID: ${userId}). Reactivated ${sessionIds.length} drive session(s).`;
        await client.query(
            'INSERT INTO admin_notifications (message, type, created_at) VALUES ($1, $2, NOW())',
            [notificationMessage, 'user_management']
        );

        // Log the successful unfreeze operation
        await client.query(
            `INSERT INTO commission_logs 
             (user_id, source_user_id, account_type, commission_amount, commission_type, description)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, adminUserId, 'main', 0, 'admin_action', `Account unfrozen by admin - reactivated ${sessionIds.length} session(s)`]
        );

        await client.query('COMMIT');

        logger.info(`Admin ${adminUserId} successfully unfroze user ${userId}. Reactivated ${sessionIds.length} session(s).`);
        res.json({ 
            success: true, 
            message: `Successfully unfroze account for user "${username}". Reactivated ${sessionIds.length} drive session(s).`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error unfreezing user ${userId}:`, { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error unfreezing user account' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Get all notification categories
 * @route   GET /api/admin/notification-categories
 * @access  Private/Admin
 */
const getNotificationCategories = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                name,
                COALESCE(color, '#6c757d') as color,
                COALESCE(icon, 'fas fa-bell') as icon,
                COALESCE(is_active, true) as is_active,
                created_at,
                updated_at
            FROM notification_categories 
            WHERE COALESCE(is_active, true) = true 
            ORDER BY name ASC
        `);
        res.json({ success: true, categories: result.rows });
    } catch (error) {
        logger.error('Error fetching notification categories:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error fetching notification categories' });
    }
};

/**
 * @desc    Get all general notifications
 * @route   GET /api/admin/general-notifications
 * @access  Private/Admin
 */
const getGeneralNotifications = async (req, res) => {    try {
        const result = await pool.query(`
            SELECT 
                gn.*,
                COALESCE(nc.name, 'General') as category_name,
                COALESCE(nc.color, '#6c757d') as category_color,
                COALESCE(nc.icon, 'fas fa-bell') as category_icon
            FROM general_notifications gn
            LEFT JOIN notification_categories nc ON gn.category_id = nc.id
            ORDER BY gn.priority DESC, gn.created_at DESC
        `);
        res.json({ success: true, notifications: result.rows });
    } catch (error) {
        logger.error('Error fetching general notifications:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error fetching general notifications' });
    }
};

/**
 * @desc    Create a new general notification
 * @route   POST /api/admin/general-notifications
 * @access  Private/Admin
 */
const createGeneralNotification = async (req, res) => {
    const { category_id, title, message, image_url = null, priority = 1, expires_at = null } = req.body;
    
    // Validation
    if (!category_id || !title || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Category ID, title, and message are required' 
        });
    }

    try {
        const result = await pool.query(`
            INSERT INTO general_notifications 
            (category_id, title, message, image_url, priority, end_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [category_id, title, message, image_url, priority, expires_at, req.user.id]);

        logger.info(`Admin ${req.user.id} created general notification: ${title}`);
        res.json({ success: true, notification: result.rows[0] });
    } catch (error) {
        logger.error('Error creating general notification:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error creating general notification' });
    }
};

/**
 * @desc    Update a general notification
 * @route   PUT /api/admin/general-notifications/:id
 * @access  Private/Admin
 */
const updateGeneralNotification = async (req, res) => {
    const { id } = req.params;
    const { category_id, title, message, image_url, priority, is_active, expires_at } = req.body;

    try {
        const result = await pool.query(`
            UPDATE general_notifications 
            SET category_id = COALESCE($1, category_id),
                title = COALESCE($2, title),
                message = COALESCE($3, message),
                image_url = $4,
                priority = COALESCE($5, priority),
                is_active = COALESCE($6, is_active),
                end_date = $7,
                updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `, [category_id, title, message, image_url, priority, is_active, expires_at, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'General notification not found' });
        }

        logger.info(`Admin ${req.user.id} updated general notification ${id}: ${title}`);
        res.json({ success: true, notification: result.rows[0] });
    } catch (error) {
        logger.error('Error updating general notification:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error updating general notification' });
    }
};

/**
 * @desc    Delete a general notification
 * @route   DELETE /api/admin/general-notifications/:id
 * @access  Private/Admin
 */
const deleteGeneralNotification = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM general_notifications WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'General notification not found' });
        }

        logger.info(`Admin ${req.user.id} deleted general notification ${id}`);
        res.json({ success: true, message: 'General notification deleted successfully' });
    } catch (error) {
        logger.error('Error deleting general notification:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error deleting general notification' });
    }
};

/**
 * @desc    Send a categorized notification to a user
 * @route   POST /api/admin/notifications
 * @access  Private/Admin
 */
const sendCategorizedNotification = async (req, res) => {
    const { user_id, category_id, title, message, image_url = null, priority = 1 } = req.body;
    
    // Validation
    if (!user_id || !category_id || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'User ID, category ID, and message are required' 
        });
    }

    try {
        const result = await pool.query(`
            INSERT INTO notifications 
            (user_id, category_id, title, message, image_url, priority, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `, [user_id, category_id, title, message, image_url, priority]);

        logger.info(`Admin ${req.user.id} sent categorized notification to user ${user_id}: ${title || message.substring(0, 50)}`);
        res.json({ success: true, notification: result.rows[0] });
    } catch (error) {
        logger.error('Error sending categorized notification:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error sending notification' });
    }
};

/**
 * @desc    Send bulk notifications to multiple users
 * @route   POST /api/admin/notifications/bulk
 * @access  Private/Admin
 */
const sendBulkNotifications = async (req, res) => {
    const { user_ids, category_id, title, message, image_url = null, priority = 1 } = req.body;
    
    // Validation
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'User IDs array is required and must not be empty' 
        });
    }
    
    if (!category_id || !message) {
        return res.status(400).json({ 
            success: false, 
            message: 'Category ID and message are required' 
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertPromises = user_ids.map(user_id => 
            client.query(`
                INSERT INTO notifications 
                (user_id, category_id, title, message, image_url, priority, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [user_id, category_id, title, message, image_url, priority])
        );

        await Promise.all(insertPromises);
        await client.query('COMMIT');

        logger.info(`Admin ${req.user.id} sent bulk notifications to ${user_ids.length} users: ${title || message.substring(0, 50)}`);
        res.json({ 
            success: true, 
            message: `Notifications sent to ${user_ids.length} users successfully` 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error sending bulk notifications:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error sending bulk notifications' });
    } finally {
        client.release();
    }
};

/**
 * @desc    Get onboarding responses
 * @route   GET /api/admin/onboarding-responses
 * @access  Private/Admin
 */
const getOnboardingResponses = async (req, res) => {
    try {
        const query = `
            SELECT 
                or.id,
                or.user_id,
                or.email,
                or.question_1,
                or.question_2,
                or.question_3,
                or.question_4,
                or.question_5,
                or.created_at,
                u.username,
                u.tier
            FROM onboarding_responses or
            LEFT JOIN users u ON or.user_id = u.id
            ORDER BY or.created_at DESC
        `;

        const result = await pool.query(query);

        // Format the responses for better readability
        const formattedResponses = result.rows.map(row => ({
            id: row.id,
            user: {
                id: row.user_id,
                username: row.username,
                email: row.email,
                tier: row.tier
            },
            responses: {
                earning_goal: row.question_1,
                motivation: row.question_2,
                barriers: row.question_3,
                future_vision: row.question_4,
                success_story: row.question_5
            },
            created_at: row.created_at
        }));

        res.json({ 
            success: true, 
            responses: formattedResponses,
            total: formattedResponses.length
        });

    } catch (error) {
        logger.error('Error fetching onboarding responses:', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching onboarding responses' 
        });
    }
};

module.exports = {// User Management
    getUsers,
    getFrozenUsers,
    updateUserTier,
    manualTransaction,
    
    // Product Management
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    
    // Drive Management
    getDrives,
    getDriveLogs,
    resetDrive,
    endDrive,
    
    // Financial Management
    getDeposits,
    approveDeposit,
    rejectDeposit,
    getWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    
    // Support System
    getAllSupportMessages,
    replyToSupportMessage,
    sendNotification,
    
    // Dashboard
    getDashboardStats,
    
    // Membership Tiers Management
    getMembershipTiers,
    createMembershipTier,
    updateMembershipTier,
    deleteMembershipTier,
    
    // Tier Quantity Configuration Management
    getTierQuantityConfigs,
    updateTierQuantityConfig,    // Unfreeze User Account
    unfreezeUser,

    // Notification Management
    getNotificationCategories,
    getGeneralNotifications,
    createGeneralNotification,
    updateGeneralNotification,
    deleteGeneralNotification,
    sendCategorizedNotification,
    sendBulkNotifications,

    // Onboarding Management
    getOnboardingResponses
};

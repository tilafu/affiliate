const pool = require('../config/db');
const bcrypt = require('bcrypt'); // Import bcrypt for password handling
const logger = require('../logger'); // Import logger

/**
 * @desc    Get user's deposit history
 * @route   GET /api/user/deposits
 * @access  Private (requires token)
 */
const getUserDeposits = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch deposit history from the deposits table
    const result = await pool.query(
      `SELECT id, amount, status, created_at AS date, description, txn_hash
       FROM deposits
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, history: result.rows });
  } catch (error) {
    logger.error('Error fetching user deposit history:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching deposit history' });
  }
};

/**
 * @desc    Get user's total withdrawn amount
 * @route   GET /api/user/withdrawals
 * @access  Private (requires token)
 */
const getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the total approved withdrawn amount
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_withdrawals
       FROM withdrawals
       WHERE user_id = $1 AND status = 'APPROVED'`,
      [userId]
    );

    const totalWithdrawals = result.rows[0].total_withdrawals;

    res.json({ success: true, totalWithdrawals: parseFloat(totalWithdrawals) });
  } catch (error) {
    logger.error('Error fetching user total withdrawals:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching total withdrawals' });
  }
};

/**
 * @desc    Get user's withdrawable balance (Main account balance)
 * @route   GET /api/user/withdrawable-balance
 * @access  Private (requires token)
 */
const getWithdrawableBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT balance AS withdrawable_balance
       FROM accounts
       WHERE user_id = $1 AND type = 'main'`,
      [userId]
    );

    const withdrawableBalance = result.rows[0]?.withdrawable_balance || 0;

    res.json({ success: true, withdrawableBalance: parseFloat(withdrawableBalance) });
  } catch (error) {
    logger.error('Error fetching withdrawable balance:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching withdrawable balance' });
  }
};

/**
 * @desc    Get user's withdraw history
 * @route   GET /api/user/withdraw-history
 * @access  Private (requires token)
 */
const getWithdrawHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch withdraw history from the withdrawals table
    const result = await pool.query(
      `SELECT id, amount, status, created_at AS date, description, txn_hash
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, history: result.rows });
  } catch (error) {
    logger.error('Error fetching withdraw history:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching withdraw history' });
  }
};

// Fetch all relevant balances
const getUserBalances = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch main account balance details using correct column names
    const mainResult = await pool.query(
      `SELECT 
         balance AS main_balance,
         frozen AS frozen_balance
       FROM accounts 
       WHERE user_id = $1 AND type = 'main'`,
      [userId]
    );    // Calculate commission from commission_logs for today
    const commissionResult = await pool.query(
      `SELECT COALESCE(SUM(commission_amount), 0) as commission_balance
       FROM commission_logs
       WHERE user_id = $1 
       AND account_type = 'main'
       AND commission_type IN ('direct_drive', 'upline_bonus', 'data_drive')
       AND DATE(created_at) = CURRENT_DATE`,
      [userId]
    );

    // If no main account, return default zero balances
    let balances = {
      main_balance: 0,
      commission_balance: 0,
      frozen_balance: 0
    };

    if (mainResult.rows.length > 0) {
      const mainAccount = mainResult.rows[0];
      balances = {
        main_balance: parseFloat(mainAccount.main_balance) || 0,
        commission_balance: parseFloat(commissionResult.rows[0].commission_balance) || 0,
        frozen_balance: parseFloat(mainAccount.frozen_balance) || 0
      };
    } else {
      logger.warn(`Main account not found for user ${userId} when fetching balances.`);
    }

    res.json({
      success: true,
      balances: balances
    });
  } catch (error) {
    logger.error('Error fetching user balances:', { userId: req.user.id, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching balances' });
  }
};

/**
 * @desc    Fetch just the main balance (used by account.js currently)
 * @route   GET /api/user/balance
 * @access  Private (requires token)
 */
const getUserBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT balance FROM accounts WHERE user_id = $1 AND type = \'main\'',
      [userId]
    );
    const balance = result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0;
    res.json({ success: true, balance: balance });
  } catch (error) {
    logger.error('Error fetching user balance:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching balance' });
  }
};

/**
 * @desc    Request a new deposit
 * @route   POST /api/user/deposit/request
 * @access  Private
 */
const requestDeposit = async (req, res) => {
    const userId = req.user.id;
    const { amount, method, transaction_details, proof_image_path } = req.body; // Add fields as needed

    // Basic validation
    if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid deposit amount.' });
    }
    // Add validation for method, transaction_details, etc. as required

    try {
        const depositAmount = parseFloat(amount);
        const desc = transaction_details || null;
        // proof_image_path is not in the current schema, so remove it from insert.

        const result = await pool.query(
            `INSERT INTO deposits (user_id, amount, status, description, txn_hash)
             VALUES ($1, $2, 'PENDING', $3, $4) RETURNING id, created_at`,
            [userId, depositAmount, desc, null] // txn_hash is $4 (always null for now)
        );

        const newDeposit = result.rows[0];

        // --- Add Admin Notification ---
        try {
            const notificationMessage = `New deposit request (ID: ${newDeposit.id}) from User ID ${userId} for amount ${parseFloat(amount).toFixed(2)}.`;
            await pool.query(
                `INSERT INTO admin_notifications (user_id, type, message) VALUES ($1, $2, $3)`,
                [userId, 'new_deposit_request', notificationMessage]
            );
            logger.info(`Admin notification created for new deposit request ${newDeposit.id} from user ${userId}.`);
        } catch (notificationError) {
            logger.error('Failed to create admin notification for new deposit request:', { userId, error: notificationError.message });
        }
        // --- End Admin Notification ---

        logger.info(`User ${userId} requested deposit ${newDeposit.id} for amount ${parseFloat(amount).toFixed(2)}.`);
        res.status(201).json({ success: true, message: 'Deposit request submitted successfully. Waiting for admin approval.', depositId: newDeposit.id });

    } catch (error) {
        logger.error('Error requesting deposit:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error submitting deposit request.' });
    }
};

/**
 * @desc    Request a new withdrawal
 * @route   POST /api/user/withdraw/request
 * @access  Private
 */
const requestWithdrawal = async (req, res) => {
    const userId = req.user.id;
    const { amount, withdrawal_password, method, withdrawal_account_details } = req.body; // Add fields as needed

    // Basic validation
    if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid withdrawal amount.' });
    }
    if (!withdrawal_password) {
         return res.status(400).json({ success: false, message: 'Withdrawal password is required.' });
    }
    if (!withdrawal_account_details || typeof withdrawal_account_details !== 'string' || withdrawal_account_details.trim() === '') {
        return res.status(400).json({ success: false, message: 'Withdrawal account details (e.g., TRC20 Address) are required.' });
    }
    // Add validation for method, etc. as required

    const client = await pool.connect(); // Use a client for transaction

    try {
        await client.query('BEGIN'); // Start transaction

        // 1. Verify withdrawal password
        const userResult = await client.query('SELECT withdrawal_password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0 || !userResult.rows[0].withdrawal_password_hash) {
             await client.query('ROLLBACK');
             client.release();
             return res.status(400).json({ success: false, message: 'Withdrawal password not set or user not found.' });
        }
        const withdrawalPasswordHash = userResult.rows[0].withdrawal_password_hash;
        const isPasswordMatch = await bcrypt.compare(withdrawal_password, withdrawalPasswordHash);

        if (!isPasswordMatch) {
            await client.query('ROLLBACK');
            client.release();
            logger.warn(`User ${userId} failed withdrawal request: Incorrect withdrawal password.`);
            return res.status(401).json({ success: false, message: 'Incorrect withdrawal password.' });
        }

        // 2. Check if user has sufficient balance in the main account
        const accountResult = await client.query(
            'SELECT balance FROM accounts WHERE user_id = $1 AND type = \'main\' FOR UPDATE', // Lock row
            [userId]
        );

        if (accountResult.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ success: false, message: 'User main account not found.' });
        }

        const currentBalance = parseFloat(accountResult.rows[0].balance);
        const withdrawalAmount = parseFloat(amount);

        if (currentBalance < withdrawalAmount) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ success: false, message: 'Insufficient balance for withdrawal.' });
        }

        // 3. Deduct the amount from the user's balance immediately (or mark as frozen?)
        // For this implementation, we'll deduct immediately upon request.
        // An alternative is to move the amount to a 'frozen' state until approved.
        const newBalance = currentBalance - withdrawalAmount;
         await client.query(
             'UPDATE accounts SET balance = $1 WHERE user_id = $2 AND type = \'main\'',
             [newBalance.toFixed(2), userId]
         );


        // 4. Create a record in the withdrawals table with 'PENDING' status
        const result = await client.query(
            `INSERT INTO withdrawals (user_id, amount, status, address, description, txn_hash)
             VALUES ($1, $2, 'PENDING', $3, $4, $5) RETURNING id, created_at`,
            [userId, withdrawalAmount, withdrawal_account_details, null, null] // address and description can be used for withdrawal_account_details and notes
        );

        const newWithdrawal = result.rows[0];

        // --- Add Admin Notification ---
        try {
            const notificationMessage = `New withdrawal request (ID: ${newWithdrawal.id}) from User ID ${userId} for amount ${withdrawalAmount.toFixed(2)}.`;
            await client.query(
                `INSERT INTO admin_notifications (user_id, type, message) VALUES ($1, $2, $3)`,
                [userId, 'new_withdrawal_request', notificationMessage]
            );
            logger.info(`Admin notification created for new withdrawal request ${newWithdrawal.id} from user ${userId}.`);
        } catch (notificationError) {
            logger.error('Failed to create admin notification for new withdrawal request:', { userId, error: notificationError.message });
        }
        // --- End Admin Notification ---

        await client.query('COMMIT'); // Commit transaction

        logger.info(`User ${userId} requested withdrawal ${newWithdrawal.id} for amount ${withdrawalAmount.toFixed(2)}. Balance updated to ${newBalance.toFixed(2)}.`);
        res.status(201).json({ success: true, message: 'Withdrawal request submitted successfully. Waiting for admin approval.', withdrawalId: newWithdrawal.id, newBalance: newBalance.toFixed(2) });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        logger.error('Error requesting withdrawal:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error submitting withdrawal request.' });
    } finally {
        client.release(); // Release client back to pool
    }
};

/**
 * @desc    Change user's login password
 * @route   PUT /api/user/password/login
 * @access  Private
 */
const changeLoginPassword = async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    try {
        // Fetch current password hash
        const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const currentHash = userResult.rows[0].password_hash;

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, currentHash);
        if (!isMatch) {
            logger.warn(`User ${userId} failed login password change attempt: Incorrect current password.`);
            return res.status(401).json({ success: false, message: 'Incorrect current password.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // Update password hash in database
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

        await pool.query(
          'INSERT INTO notifications (user_id, message, created_at) VALUES ($1, $2, NOW())',
          [userId, 'Your profile was updated.']
        );

        logger.info(`User ${userId} successfully changed login password.`);
        res.json({ success: true, message: 'Login password updated successfully.' });

    } catch (error) {
        logger.error('Error changing login password:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error changing login password.' });
    }
};

/**
 * @desc    Change user's withdrawal password
 * @route   PUT /api/user/password/withdraw
 * @access  Private
 */
const changeWithdrawPassword = async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body; // currentPassword is the LOGIN password

    // Validate input
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current login password and new withdrawal password are required.' });
    }
     if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New withdrawal password must be at least 6 characters long.' });
    }
     // Optional: Add check to prevent setting withdrawal password same as login password?

    try {
        // Fetch current LOGIN password hash for verification
        const userResult = await pool.query('SELECT password_hash, withdrawal_password_hash FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const loginHash = userResult.rows[0].password_hash;
        // const currentWithdrawHash = userResult.rows[0].withdrawal_password_hash; // Needed if verifying old withdraw pass

        // Verify current LOGIN password
        const isMatch = await bcrypt.compare(currentPassword, loginHash);
        if (!isMatch) {
            logger.warn(`User ${userId} failed withdrawal password change attempt: Incorrect current login password.`);
            return res.status(401).json({ success: false, message: 'Incorrect current login password.' });
        }

        // Hash new withdrawal password
        const salt = await bcrypt.genSalt(10);
        const newWithdrawHash = await bcrypt.hash(newPassword, salt);

        // Update withdrawal password hash in database
        // **ASSUMES 'withdrawal_password_hash' column exists**
        await pool.query('UPDATE users SET withdrawal_password_hash = $1 WHERE id = $2', [newWithdrawHash, userId]);

        await pool.query(
          'INSERT INTO notifications (user_id, message, created_at) VALUES ($1, $2, NOW())',
          [userId, 'Your profile was updated.']
        );

        logger.info(`User ${userId} successfully changed withdrawal password.`);
        res.json({ success: true, message: 'Withdrawal password updated successfully.' });

    } catch (error) {
        logger.error('Error changing withdrawal password:', { userId, error: error.message, stack: error.stack });
         // Check for specific error like column not existing
         if (error.message.includes('column "withdrawal_password_hash" of relation "users" does not exist')) {
             logger.error(`Database schema error: 'withdrawal_password_hash' column missing in 'users' table.`);
             return res.status(500).json({ success: false, message: "Server configuration error: Withdrawal password feature not fully enabled." });
         }
        res.status(500).json({ success: false, message: 'Server error changing withdrawal password.' });
    }
};

/**
 * @desc    Get user's withdrawal address
 * @route   GET /api/user/withdrawal-address
 * @access  Private
 */
const getWithdrawalAddress = async (req, res) => {
    const userId = req.user.id;
    const addressType = req.query.type || 'TRC20'; // Default to TRC20 if no type specified

    try {
        const result = await pool.query(
            'SELECT address FROM withdrawal_addresses WHERE user_id = $1 AND address_type = $2',
            [userId, addressType]
        );

        const address = result.rows.length > 0 ? result.rows[0].address : null;
        res.json({ success: true, address_type: addressType, address: address });

    } catch (error) {
        logger.error('Error fetching withdrawal address:', { userId, addressType, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching withdrawal address.' });
    }
};

/**
 * @desc    Update user's withdrawal address
 * @route   PUT /api/user/withdrawal-address
 * @access  Private
 */
const updateWithdrawalAddress = async (req, res) => {
    const userId = req.user.id;
    const { address, address_type = 'TRC20' } = req.body; // Default to TRC20

    // Basic validation
    if (!address || typeof address !== 'string' || address.trim().length < 20) { // Example basic length check
        return res.status(400).json({ success: false, message: 'Invalid withdrawal address provided.' });
    }
    // TODO: Add more specific validation based on address_type (e.g., regex for TRC20)

    try {
        // UPSERT logic: Insert or Update based on conflict on (user_id, address_type)
        const upsertQuery = `
            INSERT INTO withdrawal_addresses (user_id, address_type, address, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, address_type) 
            DO UPDATE SET address = EXCLUDED.address, updated_at = NOW()
            RETURNING address;
        `;
        const result = await pool.query(upsertQuery, [userId, address_type, address.trim()]);
        const updatedAddress = result.rows[0].address;

        logger.info(`User ${userId} updated/inserted withdrawal address for type ${address_type}.`);

        // --- Add Admin Notification ---
        try {
            const notificationMessage = `User ID ${userId} updated their ${address_type} withdrawal address.`;
            await pool.query(
                `INSERT INTO admin_notifications (user_id, type, message) VALUES ($1, $2, $3)`,
                [userId, 'address_update', notificationMessage]
            );
            logger.info(`Admin notification created for address update by user ${userId}.`);
        } catch (notificationError) {
            // Log the error but don't fail the main operation
            logger.error('Failed to create admin notification for address update:', { userId, error: notificationError.message });
        }
        // --- End Admin Notification ---

        res.json({ success: true, message: 'Withdrawal address updated successfully.', address: updatedAddress });

    } catch (error) {
        logger.error('Error updating withdrawal address:', { userId, address_type, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error updating withdrawal address.' });
    }
};

/**
 * @desc    Create a new support message
 * @route   POST /api/support/messages
 * @access  Private
 */
const createSupportMessage = async (req, res) => {
    const senderId = req.user.id;
    const senderRole = req.user.role || 'user'; // Get role from authenticated user
    const { subject, message } = req.body;

    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    try {
        // Insert the message
        const result = await pool.query(
            `INSERT INTO support_messages (sender_id, sender_role, subject, message, recipient_id, is_read) 
             VALUES ($1, $2, $3, $4, NULL, false) RETURNING id`, // recipient_id is NULL for messages to general support
            [senderId, senderRole, subject, message.trim()]
        );
        const newMessageId = result.rows[0].id;

        // Create an admin notification
        try {
            const notificationMessage = `New support message (ID: ${newMessageId}) received from User ID ${senderId}. Subject: ${subject || '(No Subject)'}`;
            await pool.query(
                `INSERT INTO admin_notifications (user_id, type, message) VALUES ($1, $2, $3)`,
                [senderId, 'new_support_message', notificationMessage]
            );
            logger.info(`Admin notification created for new support message ${newMessageId} from user ${senderId}.`);
        } catch (notificationError) {
            logger.error('Failed to create admin notification for new support message:', { senderId, error: notificationError.message });
        }

        logger.info(`User ${senderId} created support message ${newMessageId}.`);
        res.status(201).json({ success: true, message: 'Support message sent successfully.', messageId: newMessageId });

    } catch (error) {
        logger.error('Error creating support message:', { senderId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error creating support message.' });
    }
};

/**
 * @desc    Get support messages for the current user
 * @route   GET /api/user/support/messages
 * @access  Private
 */
const getUserSupportMessages = async (req, res) => {
    const userId = req.user.id;

    try {
        // Simple query without joins since we don't need sender_name
        const result = await pool.query(
            `SELECT id, subject, message, created_at, is_read, sender_id, sender_role, recipient_id 
             FROM support_messages 
             WHERE sender_id = $1 OR recipient_id = $1 OR recipient_id IS NULL 
             ORDER BY created_at DESC`,
            [userId]
        );

        logger.info(`User ${userId} fetched their support messages`);
        return res.json({ 
            success: true, 
            messages: result.rows 
        });

    } catch (error) {
        logger.error('Error fetching user support messages:', { userId, error: error.message, stack: error.stack });
        return res.status(500).json({ 
            success: false, 
            message: 'Server error fetching support messages' 
        });
    }
};

/**
 * @desc    Get notifications for the logged-in user
 * @route   GET /api/user/notifications
 * @access  Private
 */
const getUserNotifications = async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT id, message, created_at, is_read
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        res.json({ success: true, notifications: result.rows });

    } catch (error) {
        logger.error('Error fetching user notifications:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching notifications.' });
    }
};

/**
 * @desc    Mark a specific notification as read
 * @route   PUT /api/user/notifications/:id/read
 * @access  Private
 */
const markNotificationAsRead = async (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1 AND user_id = $2
             RETURNING id;`, // Return id to confirm update
            [notificationId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found or does not belong to user.' });
        }

        logger.info(`User ${userId} marked notification ${notificationId} as read.`);
        res.json({ success: true, message: 'Notification marked as read.' });

    } catch (error) {
        logger.error('Error marking notification as read:', { userId, notificationId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error marking notification as read.' });
    }
};

/**
 * @desc    Get current user's drive progress
 * @route   GET /api/user/drive-progress
 * @access  Private (requires token)
 */
const getDriveProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's active drive session
    const sessionResult = await pool.query(
      `SELECT ds.id as drive_session_id, ds.drive_configuration_id, 
              dc.name as drive_configuration_name, ds.status as session_status
       FROM drive_sessions ds
       JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
       WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
       ORDER BY ds.started_at DESC LIMIT 1`,
      [userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active drive session found.' 
      });
    }

    const session = sessionResult.rows[0];
    const driveSessionId = session.drive_session_id;

    // Get user's task items and progress
    const itemsResult = await pool.query(
      `SELECT uadi.id as task_item_id, uadi.order_in_drive, uadi.user_status, uadi.task_type,
              p1.name as product_1_name, p1.price as product_1_price,
              p2.name as product_2_name, p2.price as product_2_price,
              p3.name as product_3_name, p3.price as product_3_price
       FROM user_active_drive_items uadi
       LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
       LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
       LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
       WHERE uadi.drive_session_id = $1
       ORDER BY uadi.order_in_drive ASC`,
      [driveSessionId]
    );

    const taskItems = itemsResult.rows.map(row => ({
      task_item_id: row.task_item_id,
      order_in_drive: row.order_in_drive,
      task_item_name: row.product_1_name + (row.product_2_name ? ` + ${row.product_2_name}` : '') + (row.product_3_name ? ` + ${row.product_3_name}` : ''),
      user_status: row.user_status,
      task_type: row.task_type,
      products: [
        row.product_1_name && { name: row.product_1_name, price: row.product_1_price },
        row.product_2_name && { name: row.product_2_name, price: row.product_2_price },
        row.product_3_name && { name: row.product_3_name, price: row.product_3_price }
      ].filter(Boolean)
    }));

    const completedCount = taskItems.filter(item => item.user_status === 'COMPLETED').length;
    const currentTask = taskItems.find(item => item.user_status === 'CURRENT');

    const response = {
      success: true,
      drive_session_id: driveSessionId,
      drive_configuration_id: session.drive_configuration_id,
      drive_configuration_name: session.drive_configuration_name,
      session_status: session.session_status,
      completed_task_items: completedCount,
      total_task_items: taskItems.length,
      current_task_item_name: currentTask ? currentTask.task_item_name : null,
      task_items: taskItems
    };

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching drive progress for user ${req.user.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to fetch drive progress', error: error.message });
  }
};

/**
 * @desc    Get active products available for combo creation
 * @route   GET /api/user/products/active
 * @access  Private (requires token)
 */
const getActiveProducts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price, description, image_url
       FROM products 
       WHERE status = 'active'
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    logger.error('Error fetching active products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active products', error: error.message });
  }
};

/**
 * @desc    Create a combo for current user
 * @route   POST /api/user/combo/create
 * @access  Private (requires token)
 */
const createCombo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { comboName, comboDescription, productIds, insertAfterTaskSetId, insertAtOrder } = req.body;

    // Validate required fields
    if (!comboName || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'comboName and productIds (array with at least one product) are required.' 
      });
    }

    // Validate insertion point - must have either insertAfterTaskSetId or insertAtOrder
    if (!insertAfterTaskSetId && insertAtOrder === undefined) {
      return res.status(400).json({ 
        success: false,
        message: 'Either insertAfterTaskSetId or insertAtOrder must be specified.' 
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify user has active drive session
      const sessionResult = await client.query(
        `SELECT ds.id as drive_session_id, ds.drive_configuration_id, dc.name as drive_configuration_name
         FROM drive_sessions ds
         JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
         WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
         ORDER BY ds.started_at DESC LIMIT 1`,
        [userId]
      );

      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          success: false,
          message: 'No active drive session found.' 
        });
      }

      const { drive_session_id } = sessionResult.rows[0];
      
      // 2. Validate all product IDs exist and are active
      const productsResult = await client.query(
        'SELECT id, name, price FROM products WHERE id = ANY($1) AND status = $2',
        [productIds, 'active']
      );

      if (productsResult.rows.length !== productIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          message: 'One or more product IDs are invalid or inactive.' 
        });
      }

      // 3. Determine insertion order for the new combo
      let newOrderInDrive;
      
      if (insertAtOrder !== undefined) {
        // Direct insertion at specified order
        newOrderInDrive = parseInt(insertAtOrder);
        
        // Shift existing items at this position and after
        await client.query(
          `UPDATE user_active_drive_items 
           SET order_in_drive = order_in_drive + 1, updated_at = NOW()
           WHERE drive_session_id = $1 AND order_in_drive >= $2`,
          [drive_session_id, newOrderInDrive]
        );
        
      } else if (insertAfterTaskSetId) {
        // Insert after a specific task item
        const targetItemResult = await client.query(
          'SELECT order_in_drive FROM user_active_drive_items WHERE id = $1 AND drive_session_id = $2',
          [insertAfterTaskSetId, drive_session_id]
        );
        
        if (targetItemResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            success: false,
            message: 'Target task item not found for insertion.' 
          });
        }
        
        newOrderInDrive = targetItemResult.rows[0].order_in_drive + 1;
        
        // Shift existing items after the insertion point
        await client.query(
          `UPDATE user_active_drive_items 
           SET order_in_drive = order_in_drive + 1, updated_at = NOW()
           WHERE drive_session_id = $1 AND order_in_drive >= $2`,
          [drive_session_id, newOrderInDrive]
        );
      }

      // 4. Create the combo as a new user_active_drive_item
      const product1 = productIds[0];
      const product2 = productIds.length > 1 ? productIds[1] : null;
      const product3 = productIds.length > 2 ? productIds[2] : null;
      
      if (productIds.length > 3) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false,
          message: 'Combos cannot contain more than 3 products with current schema.' 
        });
      }

      // Calculate total price for the combo
      const totalPrice = productsResult.rows.reduce((sum, product) => sum + parseFloat(product.price), 0);

      const comboItemResult = await client.query(
        `INSERT INTO user_active_drive_items (
            user_id, drive_session_id, product_id_1, product_id_2, product_id_3,
            order_in_drive, user_status, task_type, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 'combo', NOW(), NOW()) 
         RETURNING *`,
        [userId, drive_session_id, product1, product2, product3, newOrderInDrive]
      );

      // 5. Log the combo creation for audit purposes
      logger.info(`User ${userId} created combo "${comboName}" with products [${productIds.join(', ')}] at order ${newOrderInDrive}`);

      await client.query('COMMIT');

      // 6. Prepare response with combo details
      const response = {
        success: true,
        message: 'Combo successfully added to your drive',
        combo: {
          id: comboItemResult.rows[0].id,
          name: comboName,
          description: comboDescription,
          products: productsResult.rows,
          totalPrice: totalPrice.toFixed(2),
          orderInDrive: newOrderInDrive,
          driveSessionId: drive_session_id
        }
      };

      res.status(201).json(response);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error(`Error creating combo for user ${req.user.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to create combo', error: error.message });
  }
};

module.exports = {
  getUserDeposits,
  getUserWithdrawals,
  getWithdrawableBalance,
  getWithdrawHistory,
  getUserBalances,
  getUserBalance,
  requestDeposit, // Export new function
  requestWithdrawal, // Export new function
  changeLoginPassword,
  changeWithdrawPassword,
  getWithdrawalAddress,
  updateWithdrawalAddress,
  createSupportMessage,
  getUserSupportMessages,
  getUserNotifications,
  markNotificationAsRead,
  getDriveProgress, // Export new function
  getActiveProducts, // Export new function
  createCombo // Export new function
  // Other user-related functions
};

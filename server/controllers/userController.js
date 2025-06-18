const pool = require('../config/db');
const bcrypt = require('bcrypt'); // Import bcrypt for password handling
const logger = require('../logger'); // Import logger

/**
 * @desc    Get user's deposit history (including admin adjustments)
 * @route   GET /api/user/deposits
 * @access  Private (requires token)
 */
const getUserDeposits = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch deposit history from the deposits table AND admin deposits from commission_logs
    const depositsQuery = `
      SELECT 
        id, 
        amount, 
        status, 
        created_at AS date, 
        description, 
        txn_hash,
        'deposit' as type,
        NULL as admin_note
      FROM deposits
      WHERE user_id = $1
      
      UNION ALL
      
      SELECT 
        id,
        commission_amount as amount,
        'completed' as status,
        created_at AS date,
        description,
        NULL as txn_hash,
        'admin_adjustment' as type,
        description as admin_note
      FROM commission_logs
      WHERE user_id = $1 AND commission_type = 'admin_deposit'
      
      ORDER BY date DESC
    `;

    const result = await pool.query(depositsQuery, [userId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching user deposit history:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching deposit history' });
  }
};

/**
 * @desc    Get user's total withdrawn amount including admin adjustments
 * @route   GET /api/user/withdrawals
 * @access  Private (requires token)
 */
const getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the total approved withdrawn amount plus admin withdrawals
    const result = await pool.query(`
      SELECT 
        COALESCE(
          (SELECT SUM(amount) FROM withdrawals WHERE user_id = $1 AND status = 'APPROVED') + 
          (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_logs WHERE user_id = $1 AND commission_type = 'admin_withdrawal'),
          0
        ) AS total_withdrawals
    `, [userId]);

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
 * @desc    Get user's withdraw history (including admin adjustments)
 * @route   GET /api/user/withdraw-history
 * @access  Private (requires token)
 */
const getWithdrawHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch withdraw history from the withdrawals table AND admin withdrawals from commission_logs
    const withdrawalsQuery = `
      SELECT 
        id, 
        amount, 
        status, 
        created_at AS date, 
        address, 
        description, 
        txn_hash,
        'withdrawal' as type,
        NULL as admin_note
      FROM withdrawals
      WHERE user_id = $1
      
      UNION ALL
      
      SELECT 
        id,
        -ABS(commission_amount) as amount,
        'completed' as status,
        created_at AS date,
        NULL as address,
        description,
        NULL as txn_hash,
        'admin_adjustment' as type,
        description as admin_note
      FROM commission_logs
      WHERE user_id = $1 AND commission_type = 'admin_withdrawal'
      
      ORDER BY date DESC
    `;

    const result = await pool.query(withdrawalsQuery, [userId]);

    res.json({ success: true, data: result.rows });
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
 * @desc    Get notifications for the logged-in user (enhanced with categories)
 * @route   GET /api/user/notifications
 * @access  Private
 */
const getUserNotifications = async (req, res) => {
    const userId = req.user.id;

    try {
        // Enhanced query to include category information
        const result = await pool.query(
            `SELECT 
                n.id, 
                n.title,
                n.message, 
                n.image_url,
                n.priority,
                n.created_at, 
                n.is_read,
                nc.name as category_name,
                nc.color as category_color,
                nc.icon as category_icon,
                nc.description as category_description
             FROM notifications n
             LEFT JOIN notification_categories nc ON n.category_id = nc.id
             WHERE n.user_id = $1
             ORDER BY n.priority DESC, n.created_at DESC`,
            [userId]
        );

        // Also get general notifications that are active and not expired
        const generalResult = await pool.query(
            `SELECT 
                gn.id,
                gn.title,
                gn.message,
                gn.image_url,
                gn.priority,
                gn.created_at,
                true as is_general,
                nc.name as category_name,
                nc.color as category_color,
                nc.icon as category_icon,
                nc.description as category_description
             FROM general_notifications gn
             JOIN notification_categories nc ON gn.category_id = nc.id
             WHERE gn.is_active = true 
             AND (gn.expires_at IS NULL OR gn.expires_at > NOW())
             ORDER BY gn.priority DESC, gn.display_order ASC, gn.created_at DESC`
        );

        // Combine and sort all notifications
        const allNotifications = [
            ...result.rows.map(row => ({ ...row, is_general: false })),
            ...generalResult.rows
        ].sort((a, b) => {
            // Sort by priority first, then by date
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });

        res.json({ success: true, notifications: allNotifications });

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
 * @desc    Get user's total deposited amount including admin adjustments
 * @route   GET /api/user/deposits/total
 * @access  Private (requires token)
 */
const getUserTotalDeposits = async (req, res) => {
    try {
        const userId = req.user.id;

        // Query to get total from regular deposits plus admin deposits
        const result = await pool.query(`
            SELECT 
                COALESCE(
                    (SELECT SUM(amount) FROM deposits WHERE user_id = $1 AND status = 'completed') + 
                    (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_logs WHERE user_id = $1 AND commission_type = 'admin_deposit'),
                    0
                ) AS total_deposits
        `, [userId]);

        const totalDeposits = result.rows.length > 0 ? result.rows[0].total_deposits : 0;

        res.json({ success: true, totalDeposits: parseFloat(totalDeposits) });
    } catch (error) {
        logger.error('Error fetching user total deposits:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching total deposits' });
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

        // Get drive progress data
        const progressResult = await pool.query(`
            SELECT 
                drives_completed,
                is_working_day,
                date
            FROM user_drive_progress 
            WHERE user_id = $1 
            ORDER BY date DESC 
            LIMIT 7
        `, [userId]);

        // Calculate weekly progress
        const today = new Date().toISOString().split('T')[0];
        const weeklyProgress = progressResult.rows.filter(row => row.is_working_day).length;
        const todayRecord = progressResult.rows.find(row => {
            const recordDate = new Date(row.date).toISOString().split('T')[0];
            return recordDate === today;
        });

        // Also check if user has any working days record
        const workingDaysResult = await pool.query(`
            SELECT total_working_days, weekly_progress 
            FROM user_working_days 
            WHERE user_id = $1
        `, [userId]);

        const workingDaysData = workingDaysResult.rows[0] || { total_working_days: 0, weekly_progress: 0 };

        // If no data exists, create default entries
        if (progressResult.rows.length === 0 && workingDaysResult.rows.length === 0) {
            // Create default working days record
            await pool.query(`
                INSERT INTO user_working_days (user_id, total_working_days, weekly_progress)
                VALUES ($1, 0, 0)
                ON CONFLICT (user_id) DO NOTHING
            `, [userId]);

            // Create default drive progress for today
            await pool.query(`
                INSERT INTO user_drive_progress (user_id, date, drives_completed, is_working_day)
                VALUES ($1, $2, 0, false)
                ON CONFLICT (user_id, date) DO NOTHING
            `, [userId, today]);
        }

        res.json({
            success: true,
            today: {
                drives_completed: todayRecord ? todayRecord.drives_completed : 0,
                is_working_day: todayRecord ? todayRecord.is_working_day : false
            },
            weekly: {
                progress: Math.max(weeklyProgress, workingDaysData.weekly_progress || 0),
                total: 7
            },
            total_working_days: workingDaysData.total_working_days || 0
        });
    } catch (error) {
        logger.error('Error fetching drive progress:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching drive progress' });
    }
};

/**
 * @desc    Get active products available for combo creation
 * @route   GET /api/user/products/active
 * @access  Private (requires token)
 */
const getActiveProducts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, price, image_url, description 
            FROM products 
            WHERE is_active = true 
            ORDER BY name ASC
        `);

        res.json({ success: true, products: result.rows });
    } catch (error) {
        logger.error('Error fetching active products:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error fetching active products' });
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
        const { name, description, products } = req.body;

        if (!name || !products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: 'Name and products are required' });
        }

        // For now, return a placeholder response
        // This would need to be implemented based on your combo creation requirements
        res.json({ 
            success: true, 
            message: 'Combo creation functionality not yet implemented',
            combo: { name, description, products }
        });
    } catch (error) {
        logger.error('Error creating combo:', { userId, error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Server error creating combo' });
    }
};

/**
 * @desc    Get high-value products for dashboard carousel (price > 5000)
 * @route   GET /api/user/products/highvalue
 * @access  Private
 */
const getHighValueProducts = async (req, res) => {
  try {
    const highValueQuery = `
      SELECT 
        id,
        name,
        price,
        image_url,
        description
      FROM products 
      WHERE price > 5000 
      AND status = 'active'
      AND is_active = true
      ORDER BY price DESC
      LIMIT 20
    `;

    const result = await pool.query(highValueQuery);
    
    // Calculate commission for each product (assume 10% for simplicity)
    const productsWithCommission = result.rows.map(product => {
      const price = parseFloat(product.price);
      const commission = (price * 0.10).toFixed(2);
      
      return {
        ...product,
        price: price.toFixed(2),
        commission: commission,
        image_url: product.image_url || '/assets/uploads/products/newegg-1.jpg'
      };
    });

    res.json({ 
      success: true, 
      products: productsWithCommission,
      count: productsWithCommission.length 
    });
  } catch (error) {
    logger.error('Error fetching high-value products:', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching high-value products' });
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
  getUserTotalDeposits,
  getDriveProgress,
  getActiveProducts,
  createCombo,
  getHighValueProducts
  // Other user-related functions
};

const pool = require('../config/db');
const bcrypt = require('bcrypt'); // Import bcrypt for password handling
const logger = require('../logger'); // Import logger

const getUserDeposits = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the total deposited amount
    const result = await pool.query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total_deposits
       FROM commission_logs
       WHERE user_id = $1 AND commission_type = 'admin_deposit'`,
      [userId]
    );

    const totalDeposits = result.rows[0].total_deposits;

    res.json({ success: true, totalDeposits: parseFloat(totalDeposits) });
  } catch (error) {
    logger.error('Error fetching user deposits:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching deposits' });
  }
};

const getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to calculate the total withdrawn amount
    // Assuming withdrawals are logged similarly to deposits or via a dedicated withdrawals table
    // Using commission_logs with type 'withdrawal' or 'admin_withdrawal' for now
    const result = await pool.query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total_withdrawals
       FROM commission_logs
       WHERE user_id = $1 AND commission_type IN ('withdrawal', 'admin_withdrawal')`, // Adjust types if needed
      [userId]
    );

    const totalWithdrawals = result.rows[0].total_withdrawals;

    res.json({ success: true, totalWithdrawals: parseFloat(totalWithdrawals) });
  } catch (error) {
    logger.error('Error fetching user withdrawals:', { userId, error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching withdrawals' });
  }
};

// Fetch withdrawable balance (Main account balance)
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

// Fetch withdraw history
const getWithdrawHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to fetch withdraw history (adjust commission_type if needed)
    const result = await pool.query(
      `SELECT commission_amount AS amount, created_at AS date, description
       FROM commission_logs
       WHERE user_id = $1 AND commission_type IN ('withdrawal', 'admin_withdrawal')
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

// Fetch just the main balance (used by account.js currently)
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


module.exports = {
  getUserDeposits,
  getUserWithdrawals,
  getWithdrawableBalance,
  getWithdrawHistory,
  getUserBalances,
  getUserBalance,
  changeLoginPassword,
  changeWithdrawPassword,
  getWithdrawalAddress,
  updateWithdrawalAddress,
  createSupportMessage,    // Export new function
  getUserSupportMessages, // Export new function
  getUserNotifications, // Export new function
  markNotificationAsRead // Export new function
  // Other user-related functions
};

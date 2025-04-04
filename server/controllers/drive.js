const pool = require('../config/db');
const CommissionService = require('../services/commissionService'); // Import commission service

// @desc    Start a new drive session
// @route   POST /api/drive/start
// @access  Private
const startDrive = async (req, res) => {
  const userId = req.user.id; // Assuming auth middleware adds user to req
  const { productComboId } = req.body; // Or productId if not using combos yet

  if (!productComboId) {
    return res.status(400).json({ message: 'Product Combo ID is required' });
  }

  try {
    // 1. Check for existing active session
    const existingSessionResult = await pool.query(
      `SELECT id FROM drive_sessions WHERE user_id = $1 AND status = 'started'`,
      [userId]
    );
    if (existingSessionResult.rowCount > 0) {
      return res.status(400).json({ message: 'User already has an active drive session' });
    }

    // 2. Fetch product combo details and user details (tier, balance)
    const comboResult = await pool.query(
      `SELECT pc.id, pc.min_balance_required, pc.min_tier, pc.is_active
       FROM product_combos pc
       WHERE pc.id = $1`,
      [productComboId]
    );

    if (comboResult.rowCount === 0) {
        return res.status(404).json({ message: 'Product Combo not found' });
    }
    const combo = comboResult.rows[0];

    if (!combo.is_active) {
        return res.status(400).json({ message: 'Selected Product Combo is not active' });
    }

    // Fetch user's tier and main account balance
    // Assuming 'main' account balance is relevant for min_balance_required
    const userDetailsResult = await pool.query(
        `SELECT u.tier, a.balance
         FROM users u
         JOIN accounts a ON u.id = a.user_id AND a.type = 'main'
         WHERE u.id = $1`,
        [userId]
    );

    if (userDetailsResult.rowCount === 0) {
        // Should not happen if user is authenticated and has accounts
        return res.status(404).json({ message: 'User account details not found' });
    }
    const userDetails = userDetailsResult.rows[0];

    // 3. Validate requirements
    // TODO: Implement tier comparison logic (e.g., bronze < silver < gold < platinum)
    // For now, simple equality check or assume tiers are ordered alphabetically for simplicity
    if (combo.min_tier && userDetails.tier < combo.min_tier) { // Placeholder comparison
         return res.status(403).json({ message: `User tier (${userDetails.tier}) does not meet minimum requirement (${combo.min_tier})` });
    }
    if (combo.min_balance_required && parseFloat(userDetails.balance) < parseFloat(combo.min_balance_required)) {
        return res.status(403).json({ message: `User balance (${userDetails.balance}) does not meet minimum requirement (${combo.min_balance_required})` });
    }

    // All checks passed, insert the new drive session
    const newSessionResult = await pool.query(
      `INSERT INTO drive_sessions (user_id, product_combo_id, status)
       VALUES ($1, $2, 'started')
       RETURNING id, user_id, product_combo_id, start_time, status`,
      [userId, productComboId]
    );

    const newSession = newSessionResult.rows[0];

    res.status(201).json({
      message: 'Drive session started successfully',
      session: newSession,
    });

  } catch (error) {
    console.error('Error starting drive session:', error);
    // Check for specific DB errors if needed (e.g., foreign key violation)
    res.status(500).json({ message: 'Server error starting drive session' });
  }
};

// TODO: Implement completeDrive function
// @desc    Complete an active drive session and calculate commission
// @route   POST /api/drive/complete/:sessionId
// @access  Private
const completeDrive = async (req, res) => {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId || isNaN(parseInt(sessionId))) {
        return res.status(400).json({ message: 'Valid Session ID is required' });
    }

    const client = await pool.connect(); // Use transaction

    try {
        await client.query('BEGIN');

        // 1. Find the session, ensure it belongs to the user and status is 'started'.
        const sessionResult = await client.query(
            `SELECT ds.id, ds.user_id, ds.product_combo_id, ds.status, pc.combo_price, pc.combo_commission_rate
             FROM drive_sessions ds
             JOIN product_combos pc ON ds.product_combo_id = pc.id
             WHERE ds.id = $1 AND ds.user_id = $2`,
            [sessionId, userId]
        );

        if (sessionResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Active drive session not found for this user' });
        }

        const session = sessionResult.rows[0];

        if (session.status !== 'started') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Session is already ${session.status}` });
        }

        // 2. Update session status to 'completed' and set end_time.
        const updateResult = await client.query(
            `UPDATE drive_sessions
             SET status = 'completed', end_time = NOW()
             WHERE id = $1
             RETURNING id, status, end_time`,
            [sessionId]
        );
        const updatedSession = updateResult.rows[0];

        // 3. & 4. Calculate and distribute commission using CommissionService
        // Assuming direct drive commission is the primary one here.
        // The service should handle upline commissions internally.
        await CommissionService.calculateDirectDriveCommission(
            userId,
            session.product_combo_id, // Use combo ID as source action ID? Or session ID? Let's use session ID.
            session.combo_price,
            session.combo_commission_rate,
            client, // Pass the transaction client
            sessionId // Pass session ID as source_action_id
        );

        // TODO: Potentially add Training Commission calculation here if applicable to drives

        await client.query('COMMIT');

        // 5. Return success message.
        res.status(200).json({
            message: 'Drive session completed successfully and commission processed.',
            session: updatedSession
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error completing drive session:', error);
        res.status(500).json({ message: 'Server error completing drive session' });
    } finally {
        client.release();
    }
};

// @desc    List available product combos
// @route   GET /api/drive/combos
// @access  Private (or Public, depending on requirements)
const listCombos = async (req, res) => {
    try {
        // Fetch active combos, selecting relevant fields for the frontend
        const comboResult = await pool.query(
            `SELECT id, name, combo_price, combo_commission_rate, image_url, min_balance_required, min_tier
             FROM product_combos
             WHERE is_active = true
             ORDER BY combo_price ASC` // Optional: order by price
        );

        res.status(200).json(comboResult.rows);

    } catch (error) {
        console.error('Error listing product combos:', error);
        res.status(500).json({ message: 'Server error listing product combos' });
    }
};


module.exports = {
  startDrive,
  completeDrive,
  listCombos, // Export the new function
};

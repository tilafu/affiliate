const pool = require('../config/db');

// Define commission rates based on the level (20%, 10%, 5%)
const UPLINE_COMMISSION_RATES = [0.20, 0.10, 0.05]; // Level 1, Level 2, Level 3

/**
 * Helper function to find the upline chain for a given user.
 * Should be executed within a transaction using the provided client.
 * @param {number} userId - The ID of the user whose upline chain is needed.
 * @param {number} maxLevels - The maximum number of upline levels to retrieve.
 * @param {object} client - The database client for transaction consistency.
 * @returns {Promise<Array<{id: number, level: number}>>} - An array of upline objects with their level.
 */
async function _getUplineChain(userId, maxLevels, client) {
  const uplines = [];
  let currentUserId = userId;
  let level = 1;

  while (level <= maxLevels) {
    const result = await client.query(
      'SELECT upliner_id FROM users WHERE id = $1',
      [currentUserId]
    );

    if (result.rows.length === 0 || !result.rows[0].upliner_id) {
      break; // No more uplines
    }

    const uplinerId = result.rows[0].upliner_id;
    // Prevent self-referral loops just in case data is inconsistent
    if (uplinerId === userId) {
        console.error(`Self-referral loop detected for user ${userId}. Stopping upline chain.`);
        break;
    }
    uplines.push({ id: uplinerId, level: level });
    currentUserId = uplinerId;
    level++;
  }

  return uplines;
}


class CommissionService {
  /**
   * Calculates and logs direct data drive commission for a user.
   * @param {number} userId - ID of the user earning commission.
   * @param {number} productId - ID of the product/drive interacted with.
   * @param {number} productPrice - Price of the product.
   * @param {number} commissionRate - Commission rate for the product.
   * @returns {Promise<void>}
   */
  static async calculateDirectDriveCommission(userId, productId, productPrice, commissionRate) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Calculate commission amount
      const commissionAmount = productPrice * commissionRate;
      const commissionDescription = `Direct commission from data drive interaction (product ID: ${productId})`;

      if (commissionAmount <= 0) {
        console.log(`Skipping zero or negative direct commission for user ${userId}, product ${productId}`);
        await client.query('COMMIT'); // Commit even if commission is zero
        return;
      }

      // 2. Log the commission in commission_logs table
      await client.query(
        'INSERT INTO commission_logs (user_id, source_action_id, account_type, commission_amount, commission_type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, productId, 'main', commissionAmount, 'direct_drive', commissionDescription]
      );

      // 3. Credit the commission to the user's main account balance
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = \'main\'',
        [commissionAmount, userId]
      );

      console.log(`Direct commission of $${commissionAmount.toFixed(2)} credited to user ${userId} for product ${productId}`);

      // 4. Calculate and distribute multi-level upline commissions
      await CommissionService.distributeMultiLevelCommission(
          userId,
          commissionAmount, // Base amount for upline calculation is the direct commission earned
          'upline_bonus',
          `Upline bonus based on user ${userId}'s direct drive commission (product ID: ${productId})`,
          productId,
          client // Pass the client for transaction consistency
      );

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error calculating direct drive commission for user ${userId}, product ${productId}:`, error);
      throw error; // Re-throw the error to be handled by the caller
    } finally {
      client.release();
    }
  }


  /**
   * Calculates and distributes commissions up the referral chain based on defined rates.
   * Should be called within an existing database transaction.
   * @param {number} sourceUserId - The ID of the user whose action triggered the commission.
   * @param {number} baseAmount - The amount on which upline commission is calculated (typically the direct commission earned by sourceUserId).
   * @param {string} commissionType - Type of commission (e.g., 'upline_bonus').
   * @param {string} description - A description for the commission log.
   * @param {number} sourceActionId - ID of the source event (e.g., drive ID).
   * @param {object} client - The database client for transaction consistency.
   * @returns {Promise<void>}
   */
  static async distributeMultiLevelCommission(sourceUserId, baseAmount, commissionType, description, sourceActionId, client) {
    try {
      // Get the upline chain (up to 3 levels for 20-10-5 structure)
      const uplines = await _getUplineChain(sourceUserId, UPLINE_COMMISSION_RATES.length, client);

      if (uplines.length === 0) {
        console.log(`User ${sourceUserId} has no uplines. No ${commissionType} distributed.`);
        return;
      }

      console.log(`Distributing ${commissionType} for user ${sourceUserId} based on amount ${baseAmount.toFixed(2)}. Uplines found:`, uplines.map(u => `L${u.level}:${u.id}`));

      // Distribute commission to each upline
      for (const upline of uplines) {
        const commissionRate = UPLINE_COMMISSION_RATES[upline.level - 1];
        if (!commissionRate) continue; // Safety check

        const commissionAmount = baseAmount * commissionRate;

        if (commissionAmount <= 0) {
            console.log(` - Skipping zero/negative commission for Level ${upline.level} Upline ${upline.id}`);
            continue;
        }

        console.log(` - Level ${upline.level} Upline ${upline.id}: Rate ${commissionRate * 100}%, Amount ${commissionAmount.toFixed(2)}`);

        // 1. Update the upline's main account balance
        const updateResult = await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE user_id = $2 AND type = 'main'`,
          [commissionAmount, upline.id]
        );

        if (updateResult.rowCount === 0) {
           console.warn(`Could not find main account for upline user ${upline.id}. Skipping commission.`);
           continue; // Skip if account doesn't exist
        }

        // 2. Log the commission transaction
        await client.query(
          `INSERT INTO commission_logs
           (user_id, source_user_id, source_action_id, account_type, commission_amount, commission_type, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [upline.id, sourceUserId, sourceActionId, 'main', commissionAmount, commissionType, `${description} (Level ${upline.level})`]
        );
         console.log(`   Logged ${commissionType} for user ${upline.id}`);
      }

      console.log(`${commissionType} distributed successfully for user ${sourceUserId}.`);

    } catch (error) {
      console.error(`Error distributing multi-level commissions for source user ${sourceUserId}:`, error);
      // Re-throw the error so the calling transaction can be rolled back
      throw error;
    }
  }


  /**
   * Processes commission earned in the training account.
   * @param {number} userId - ID of the user earning training commission.
   * @param {number} productId - ID of the product/drive interacted with.
   * @param {number} productPrice - Price of the product.
   * @param {number} commissionRate - Commission rate for training account.
   * @returns {Promise<void>}
   */
  static async calculateTrainingCommission(userId, productId, productPrice, commissionRate) {
    // 1. Calculate training commission amount
    const commissionAmount = productPrice * commissionRate;

    // 2. Log the training commission
    await pool.query(
      'INSERT INTO commission_logs (user_id, source_action_id, account_type, commission_amount, commission_type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, productId, 'training', commissionAmount, 'training_bonus', `Training account commission from data drive interaction (product ID: ${productId})`]
    );

    // 3. Credit to training account's balance
    await pool.query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = \'training\'',
      [commissionAmount, userId]
    );

    console.log(`Training account balance of $${commissionAmount} recorded for user ${userId} for product ${productId}`);

    // 4. Check if training cap is reached and handle transfer
    await CommissionService.checkAndTransferTrainingCap(userId); // Call the next step method
  }

  /**
   * Checks if the training account commission cap is reached and transfers funds if needed.
   * @param {number} userId - ID of the user whose training account is being checked.
   * @returns {Promise<void>}
   */
  static async checkAndTransferTrainingCap(userId) {
    const client = await pool.connect(); // Use a client for transaction
    try {
      // 1. Get training account details (balance, cap)
      const trainingAccountResult = await client.query(
        'SELECT id, balance, cap, is_active FROM accounts WHERE user_id = $1 AND type = \'training\'',
        [userId]
      );

      if (trainingAccountResult.rows.length === 0 || !trainingAccountResult.rows[0].is_active) {
        console.log(`Training account not found or inactive for user ${userId}.`);
        // Removed client.release() here to prevent double release
        return;
      }
      const trainingAccount = trainingAccountResult.rows[0];
      const balance = trainingAccount.balance; // Current balance (might include previous commissions)
      const cap = trainingAccount.cap || 200; // Default cap to $200 if not set

      // 2. Calculate total commission earned in training account from logs
      const commissionLogResult = await client.query(
        `SELECT COALESCE(SUM(commission_amount), 0) as total_commission
         FROM commission_logs
         WHERE user_id = $1 AND account_type = 'training'`,
        [userId]
      );
      const currentCommission = parseFloat(commissionLogResult.rows[0].total_commission);

      console.log(`User ${userId} Training Check - Current Commission Log Sum: $${currentCommission.toFixed(2)}, Cap: $${cap}`);

      if (currentCommission >= cap) {
        console.log(`Training cap reached for user ${userId}.`);
        // 3. Calculate transfer amount (capped at $50)
        const transferAmount = Math.min(50, cap); // Transfer up to $50, or less if cap is lower

        // 4. Perform transfer within a transaction
        await client.query('BEGIN');

        // Update main account balance
        await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = \'main\'',
          [transferAmount, userId]
        );

        // Deactivate training account and potentially adjust its balance if needed (e.g., set to 0)
        // We don't need to track remaining commission here as it's logged.
        // Setting balance to 0 and is_active to false.
        await client.query(
          'UPDATE accounts SET balance = 0, is_active = false WHERE id = $1',
          [trainingAccount.id]
        );

        // Optionally: Log the transfer event itself? (e.g., in a separate transfers table or specific commission_log entry)

        await client.query('COMMIT'); // Commit transaction

        console.log(`Training cap reached for user ${userId}. Transferred $${transferAmount.toFixed(2)} to main account. Training account deactivated.`);
      } else {
        console.log(`Training account for user ${userId} is below cap.`);
      }
    } catch (error) {
        console.error(`Error checking/transferring training cap for user ${userId}:`, error);
        await client.query('ROLLBACK'); // Rollback on error
        throw error; // Re-throw error
    } finally {
        client.release(); // Release client
    }
  }
}

module.exports = CommissionService;

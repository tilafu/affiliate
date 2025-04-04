const pool = require('../config/db');

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
    // 1. Calculate commission amount
    const commissionAmount = productPrice * commissionRate;

    // 2. Log the commission in commission_logs table
    await pool.query(
      'INSERT INTO commission_logs (user_id, source_action_id, account_type, commission_amount, commission_type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, productId, 'main', commissionAmount, 'direct_drive', `Direct commission from data drive interaction (product ID: ${productId})`]
    );

    // 3. Credit the commission to the user's main account balance
    await pool.query(
      'UPDATE accounts SET balance = balance + $1, commission = commission + $1 WHERE user_id = $2 AND type = \'main\'',
      [commissionAmount, userId]
    );

    console.log(`Direct commission of $${commissionAmount} credited to user ${userId} for product ${productId}`);

    // 4. [NEXT STEP] Calculate and credit upline commission (if applicable) - to be implemented in next steps
  }

  /**
   * Calculates and credits upline commission for a user's upliner.
   * @param {number} userId - ID of the user who earned the original commission (downliner).
   * @param {number} directCommissionAmount - The direct commission amount earned by the downliner.
   * @returns {Promise<void>}
   */
  static async calculateUplineCommission(userId, directCommissionAmount) {
    // 1. Get the upliner ID for the user
    const uplinerResult = await pool.query('SELECT upliner_id FROM users WHERE id = $1', [userId]);
    const uplinerId = uplinerResult.rows[0]?.upliner_id;

    if (uplinerId) {
      // 2. Calculate upline commission (20% of direct commission)
      const uplineCommissionAmount = directCommissionAmount * 0.20;

      // 3. Log the upline commission
      await pool.query(
        'INSERT INTO commission_logs (user_id, source_user_id, account_type, commission_amount, commission_type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [uplinerId, userId, 'main', uplineCommissionAmount, 'upline_bonus', `Upline bonus (20% of downliner ${userId}'s direct commission)`]
      );

      // 4. Credit the upline commission to the upliner's main account
      await pool.query(
        'UPDATE accounts SET balance = balance + $1, commission = commission + $1 WHERE user_id = $2 AND type = \'main\'',
        [uplineCommissionAmount, uplinerId]
      );

      console.log(`Upline commission of $${uplineCommissionAmount} credited to upliner ${uplinerId} based on user ${userId}'s commission.`);
    } else {
      console.log(`User ${userId} has no upliner, skipping upline commission.`);
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

    // 3. Credit to training account's commission balance (NOT direct balance)
    await pool.query(
      'UPDATE accounts SET commission = commission + $1 WHERE user_id = $2 AND type = \'training\'',
      [commissionAmount, userId]
    );

    console.log(`Training account commission of $${commissionAmount} recorded for user ${userId} for product ${productId}`);

    // 4. [NEXT STEP] Check if training cap is reached and handle transfer - to be implemented next
  }

  /**
   * Checks if the training account commission cap is reached and transfers funds if needed.
   * @param {number} userId - ID of the user whose training account is being checked.
   * @returns {Promise<void>}
   */
  static async checkAndTransferTrainingCap(userId) {
    // 1. Get training account balance and commission earned
    const trainingAccountResult = await pool.query(
      'SELECT balance, commission, cap FROM accounts WHERE user_id = $1 AND type = \'training\'',
      [userId]
    );
    const trainingAccount = trainingAccountResult.rows[0];

    if (trainingAccount) {
      const currentCommission = trainingAccount.commission;
      const balance = trainingAccount.balance;
      const cap = trainingAccount.cap || 200; // Default cap to $200 if not set

      if (currentCommission >= cap) {
        // 2. Calculate transfer amount (capped at $50) -  and reset training commission to 0
        const transferAmount = Math.min(50, cap); // Transfer up to $50, or less if cap is lower
        const remainingTrainingCommission = currentCommission - transferAmount;

        // 3. Transfer $50 to main account balance, reset training account commission and balance, freeze training account
        await pool.query('BEGIN'); // Start transaction for atomicity

        await pool.query(
          'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = \'main\'',
          [transferAmount, userId]
        );
        await pool.query(
          'UPDATE accounts SET balance = 0, commission = 0, frozen = frozen + $1, is_active = false WHERE user_id = $2 AND type = \'training\'',
          [remainingTrainingCommission, userId]
        );


        await pool.query('COMMIT'); // Commit transaction

        console.log(`Training cap reached for user ${userId}. Transferred $${transferAmount} to main account. Training account frozen.`);
      } else {
        console.log(`Training account for user ${userId} is below cap. Current commission: $${currentCommission}, Cap: $${cap}`);
      }
    } else {
      console.log(`Training account not found for user ${userId}.`);
    }
  }
}

module.exports = CommissionService;

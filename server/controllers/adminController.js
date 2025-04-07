const pool = require('../config/db'); // Import the database connection pool

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
      console.log(`Admin ${req.user.id} updated tier for user ${userId} to ${tier}`);
      res.json({ success: true, message: `User tier updated to ${tier}`, user: result.rows[0] });
    } else {
      // Should not happen if userCheck passed, but good practice
      res.status(404).json({ message: 'User not found or update failed' });
    }

  } catch (error) {
    console.error('Error updating user tier:', error);
    res.status(500).json({ message: 'Server error updating user tier' });
  }
};

/**
 * @desc    Create a new data drive product
 * @route   POST /api/admin/products
 * @access  Private/Admin
 */
const createProduct = async (req, res) => {
  const { name, price, commission_rate, min_balance_required = 0, min_tier = 'bronze', is_active = true } = req.body;

  // Basic validation
  if (!name || price === undefined || commission_rate === undefined) {
    return res.status(400).json({ message: 'Missing required fields: name, price, commission_rate' });
  }
  if (isNaN(parseFloat(price)) || isNaN(parseFloat(commission_rate)) || isNaN(parseFloat(min_balance_required))) {
      return res.status(400).json({ message: 'Price, commission_rate, and min_balance_required must be numbers' });
  }
  const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
   if (!validTiers.includes(min_tier.toLowerCase())) {
     return res.status(400).json({ message: 'Invalid min_tier provided. Must be one of: ' + validTiers.join(', ') });
   }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, price, commission_rate, min_balance_required, min_tier, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, parseFloat(price), parseFloat(commission_rate), parseFloat(min_balance_required), min_tier.toLowerCase(), is_active]
    );

    console.log(`Admin ${req.user.id} created product ${result.rows[0].id}`);
    res.status(201).json({ success: true, message: 'Product created successfully', product: result.rows[0] });

  } catch (error) {
    console.error('Error creating product:', error);
    // Check for unique constraint violation or other specific errors if needed
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
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error fetching products' });
  }
};

/**
 * @desc    Update an existing data drive product
 * @route   PUT /api/admin/products/:productId
 * @access  Private/Admin
 */
const updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { name, price, commission_rate, min_balance_required, min_tier, is_active } = req.body;

  // Validate input (similar to create, but allow partial updates)
  if (price !== undefined && isNaN(parseFloat(price))) return res.status(400).json({ message: 'Price must be a number' });
  if (commission_rate !== undefined && isNaN(parseFloat(commission_rate))) return res.status(400).json({ message: 'Commission rate must be a number' });
  if (min_balance_required !== undefined && isNaN(parseFloat(min_balance_required))) return res.status(400).json({ message: 'Min balance required must be a number' });
  const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
  if (min_tier !== undefined && !validTiers.includes(min_tier.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid min_tier provided. Must be one of: ' + validTiers.join(', ') });
  }
  if (is_active !== undefined && typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active must be a boolean' });

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
    if (commission_rate !== undefined) { fieldsToUpdate.push(`commission_rate = $${queryIndex++}`); values.push(parseFloat(commission_rate)); }
    if (min_balance_required !== undefined) { fieldsToUpdate.push(`min_balance_required = $${queryIndex++}`); values.push(parseFloat(min_balance_required)); }
    if (min_tier !== undefined) { fieldsToUpdate.push(`min_tier = $${queryIndex++}`); values.push(min_tier.toLowerCase()); }
    if (is_active !== undefined) { fieldsToUpdate.push(`is_active = $${queryIndex++}`); values.push(is_active); }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    values.push(productId); // Add productId for the WHERE clause

    const updateQuery = `UPDATE products SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING *`;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length > 0) {
      console.log(`Admin ${req.user.id} updated product ${productId}`);
      res.json({ success: true, message: 'Product updated successfully', product: result.rows[0] });
    } else {
      res.status(404).json({ message: 'Product not found or update failed' });
    }

  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
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
      console.log(`Admin ${req.user.id} deleted product ${productId}`);
      res.json({ success: true, message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }

  } catch (error) {
    console.error(`Error deleting product ${productId}:`, error);
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
    console.log('Starting transaction');
    await client.query('BEGIN'); // Start transaction

    // 1. Check if user exists
    console.log(`Checking if user ${userId} exists`);
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Get user's main account
    console.log(`Getting main account for user ${userId}`);
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
    console.log(`Performing ${type} of ${transactionAmount}`);
    console.log(`Current balance: ${account.balance}`);
    if (type === 'deposit') {
      newBalance = parseFloat(account.balance) + transactionAmount;
      console.log(`New balance after deposit: ${newBalance}`);
    } else { // withdrawal
      if (parseFloat(account.balance) < transactionAmount) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: 'Insufficient balance for withdrawal' });
      }
      newBalance = parseFloat(account.balance) - transactionAmount;
      console.log(`New balance after withdrawal: ${newBalance}`);
    }

    // 4. Update account balance
    console.log(`Updating account balance to ${newBalance.toFixed(2)}`);
    await client.query(
      'UPDATE accounts SET balance = $1 WHERE id = $2',
      [newBalance.toFixed(2), account.id] // Ensure 2 decimal places
    );

    // 5. Log the manual transaction (Optional but recommended - using commission_logs for now)
    // Ideally, create a separate manual_transactions table.
    const logType = type === 'deposit' ? 'admin_deposit' : 'admin_withdrawal';
    const logDescription = `Admin manual ${type}: ${description || '(No description)'}`;
    console.log(`Logging transaction type: ${logType}, description: ${logDescription}`);
    await client.query(
      `INSERT INTO commission_logs
       (user_id, source_user_id, account_type, commission_amount, commission_type, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, req.user.id, 'main', transactionAmount, logType, logDescription] // Log admin ID as source
    );

    console.log('Committing transaction');
    await client.query('COMMIT'); // Commit transaction

    console.log(`Admin ${req.user.id} performed manual ${type} of ${transactionAmount} for user ${userId}`);
    res.json({ success: true, message: `Manual ${type} successful. New balance: ${newBalance.toFixed(2)}` });

  } catch (error) {
    console.error(`Error performing manual transaction for user ${userId}:`, error);
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
        a.balance AS main_balance
      FROM users u
      LEFT JOIN accounts a ON u.id = a.user_id AND a.type = 'main'
      ORDER BY u.created_at DESC
    `);

    // Convert balance to number if needed (it might come back as string from DB)
    const users = result.rows.map(user => ({
        ...user,
        main_balance: user.main_balance ? parseFloat(user.main_balance) : 0
    }));

    res.json({ success: true, users: users });
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

module.exports = {
  updateUserTier,
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  manualTransaction,
  getUsers, // Add getUsers to exports
  // Export other admin functions here as they are created
};

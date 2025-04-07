const pool = require('../config/db'); // Assuming db config is in server/config/db.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// @desc    Admin login route
// @route   POST /admin/login
// @access  Public
exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Check if the user exists and is an admin
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1 AND revenue_source = $2',
      [username, 'admin']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        isAdmin: true
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Return token and admin info
    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// --- User Management ---

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, tier, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Update user tier
// @route   PUT /api/admin/users/:userId/tier
// @access  Private (Admin)
exports.updateUserTier = async (req, res) => {
  const { userId } = req.params;
  const { tier } = req.body; // Expecting { "tier": "new_tier_name" } in body

  // Basic validation
  if (!tier || !['bronze', 'silver', 'gold', 'platinum'].includes(tier.toLowerCase())) {
    return res.status(400).json({ message: 'Invalid tier provided. Must be one of: bronze, silver, gold, platinum.' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET tier = $1 WHERE id = $2 RETURNING id, username, email, tier',
      [tier.toLowerCase(), userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: `User ${userId}'s tier updated successfully`, user: result.rows[0] });
  } catch (err) {
    console.error('Error updating user tier:', err.message);
    res.status(500).send('Server Error');
  }
};

// --- Product Management ---

// @desc    Get all products
// @route   GET /api/admin/products
// @access  Private (Admin)
exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Add a new product
// @route   POST /api/admin/products
// @access  Private (Admin)
exports.addProduct = async (req, res) => {
  const { name, price, commission_rate, image_url, min_balance_required = 0, min_tier = 'bronze' } = req.body;

  // Basic validation
  if (!name || !price || commission_rate === undefined) {
    return res.status(400).json({ message: 'Missing required fields: name, price, commission_rate' });
  }
  if (isNaN(parseFloat(price)) || isNaN(parseFloat(commission_rate))) {
      return res.status(400).json({ message: 'Price and commission_rate must be numbers.' });
  }
   if (min_balance_required && isNaN(parseFloat(min_balance_required))) {
      return res.status(400).json({ message: 'min_balance_required must be a number if provided.' });
  }
  if (min_tier && !['bronze', 'silver', 'gold', 'platinum'].includes(min_tier.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid min_tier. Must be one of: bronze, silver, gold, platinum.' });
  }


  try {
    const result = await pool.query(
      `INSERT INTO products (name, price, commission_rate, image_url, min_balance_required, min_tier, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [name, price, commission_rate, image_url, min_balance_required, min_tier.toLowerCase()]
    );
    res.status(201).json({ message: 'Product added successfully', product: result.rows[0] });
  } catch (err) {
    console.error('Error adding product:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Update an existing product
// @route   PUT /api/admin/products/:productId
// @access  Private (Admin)
exports.updateProduct = async (req, res) => {
  const { productId } = req.params;
  const { name, price, commission_rate, image_url, min_balance_required, min_tier, is_active } = req.body;

  // Construct the update query dynamically based on provided fields
  const fieldsToUpdate = [];
  const values = [];
  let queryIndex = 1;

  if (name !== undefined) {
    fieldsToUpdate.push(`name = $${queryIndex++}`);
    values.push(name);
  }
  if (price !== undefined) {
     if (isNaN(parseFloat(price))) return res.status(400).json({ message: 'Price must be a number.' });
    fieldsToUpdate.push(`price = $${queryIndex++}`);
    values.push(price);
  }
  if (commission_rate !== undefined) {
     if (isNaN(parseFloat(commission_rate))) return res.status(400).json({ message: 'Commission rate must be a number.' });
    fieldsToUpdate.push(`commission_rate = $${queryIndex++}`);
    values.push(commission_rate);
  }
  if (image_url !== undefined) {
    fieldsToUpdate.push(`image_url = $${queryIndex++}`);
    values.push(image_url);
  }
  if (min_balance_required !== undefined) {
     if (isNaN(parseFloat(min_balance_required))) return res.status(400).json({ message: 'Minimum balance required must be a number.' });
    fieldsToUpdate.push(`min_balance_required = $${queryIndex++}`);
    values.push(min_balance_required);
  }
  if (min_tier !== undefined) {
     if (!['bronze', 'silver', 'gold', 'platinum'].includes(min_tier.toLowerCase())) return res.status(400).json({ message: 'Invalid min_tier.' });
    fieldsToUpdate.push(`min_tier = $${queryIndex++}`);
    values.push(min_tier.toLowerCase());
  }
   if (is_active !== undefined) {
     if (typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active must be a boolean.' });
    fieldsToUpdate.push(`is_active = $${queryIndex++}`);
    values.push(is_active);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ message: 'No fields provided for update' });
  }

  values.push(productId); // Add productId for the WHERE clause

  const updateQuery = `UPDATE products SET ${fieldsToUpdate.join(', ')} WHERE id = $${queryIndex} RETURNING *`;

  try {
    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', product: result.rows[0] });
  } catch (err) {
    console.error('Error updating product:', err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Delete a product
// @route   DELETE /api/admin/products/:productId
// @access  Private (Admin)
exports.deleteProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    // Optional: Check if the product is part of any active combos or drives before deleting
    // For simplicity, we'll just delete directly here. Consider adding checks for referential integrity.

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: `Product ${productId} deleted successfully` });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    // Handle potential foreign key constraint errors if product is referenced elsewhere
    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json({ message: 'Cannot delete product as it is referenced elsewhere (e.g., in product combos).' });
    }
    res.status(500).send('Server Error');
  }
};

// --- Account Management ---

// @desc    Manually add deposit to user account
// @route   POST /api/admin/accounts/:userId/deposit
// @access  Private (Admin)
exports.addDeposit = async (req, res) => {
  const { userId } = req.params;
  const { amount, description } = req.body; // Expecting { "amount": 100.00, "description": "Manual deposit" }

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Invalid amount provided. Must be a positive number.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update the balance and the deposit column for the user's main account
    const updateResult = await client.query(
      `UPDATE accounts
       SET balance = balance + $1, deposit = deposit + $1
       WHERE user_id = $2 AND type = 'main'
       RETURNING id, user_id, balance, deposit`,
      [amount, userId]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User or main account not found' });
    }

    // Optional: Log the transaction (e.g., in commission_logs or a dedicated transactions table)
    // await client.query(
    //   `INSERT INTO transaction_logs (user_id, type, amount, description)
    //    VALUES ($1, 'deposit', $2, $3)`,
    //   [userId, amount, description || 'Manual deposit by admin']
    // );

    await client.query('COMMIT');
    res.json({ message: `Deposit of ${amount} added successfully to user ${userId}`, account: updateResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding deposit:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

// @desc    Manually record withdrawal from user account
// @route   POST /api/admin/accounts/:userId/withdrawal
// @access  Private (Admin)
exports.recordWithdrawal = async (req, res) => {
  const { userId } = req.params;
  const { amount, description } = req.body; // Expecting { "amount": 50.00, "description": "Manual withdrawal" }

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Invalid amount provided. Must be a positive number.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user has sufficient balance in the main account
    const balanceCheck = await client.query(
        `SELECT balance FROM accounts WHERE user_id = $1 AND type = 'main'`,
        [userId]
    );

    if (balanceCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'User or main account not found' });
    }

    const currentBalance = parseFloat(balanceCheck.rows[0].balance);
    if (currentBalance < parseFloat(amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Insufficient balance for withdrawal' });
    }

    // Update the balance and the withdrawal column for the user's main account
    const updateResult = await client.query(
      `UPDATE accounts
       SET balance = balance - $1, withdrawal = withdrawal + $1
       WHERE user_id = $2 AND type = 'main'
       RETURNING id, user_id, balance, withdrawal`,
      [amount, userId]
    );

     if (updateResult.rowCount === 0) { // Should not happen due to balance check, but good practice
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User or main account not found during update' });
    }

    // Optional: Log the transaction
    // await client.query(
    //   `INSERT INTO transaction_logs (user_id, type, amount, description)
    //    VALUES ($1, 'withdrawal', $2, $3)`,
    //   [userId, amount, description || 'Manual withdrawal by admin']
    // );

    await client.query('COMMIT');
    res.json({ message: `Withdrawal of ${amount} recorded successfully for user ${userId}`, account: updateResult.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording withdrawal:', err.message);
    res.status(500).send('Server Error');
  } finally {
    client.release();
  }
};

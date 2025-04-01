const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateReferralCode } = require('../utils/helpers'); // We'll create this later

const register = async (req, res) => {
  const { username, email, password, referralCode, revenueSource } = req.body;

  // Basic validation
  if (!username || !email || !password || !referralCode) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate referral code (must exist unless it's the admin code)
    let uplinerId = null;
    if (referralCode !== 'SETYJWFC') {
      const uplinerResult = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
      if (uplinerResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Invalid referral code' });
      }
      uplinerId = uplinerResult.rows[0].id;
    }

    // 2. Check if username or email already exists
    const existingUser = await client.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Generate unique referral code for the new user
    const newUserReferralCode = generateReferralCode(); // Assuming this function exists

    // 5. Create new user
    const newUserResult = await client.query(
      'INSERT INTO users (username, email, password_hash, referral_code, upliner_id, revenue_source) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, referral_code, tier',
      [username, email, passwordHash, newUserReferralCode, uplinerId, revenueSource]
    );
    const newUser = newUserResult.rows[0];

    // 6. Create accounts (main and training)
    await client.query(
      'INSERT INTO accounts (user_id, type, balance) VALUES ($1, $2, $3)',
      [newUser.id, 'main', 15]
    );
    await client.query(
      'INSERT INTO accounts (user_id, type, balance, cap, is_active) VALUES ($1, $2, $3, $4, $5)',
      [newUser.id, 'training', 500, 200, true]
    );

    // 7. Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        referralCode: newUser.referral_code,
        tier: newUser.tier,
        // Include initial account info if needed
      },
      message: 'Registration successful!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const { username, password } = req.body; // Can be username or email

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required' });
  }

  try {
    // Find user by username or email
    const userResult = await pool.query(
      'SELECT id, username, email, password_hash, referral_code, tier FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Compare password with stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if training account needs closing (optional, could be done elsewhere)
    // This logic might be better placed in a user service or middleware after login
    // For now, keeping it simple

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Fetch account balances (optional, could be separate endpoint)
    const accountsResult = await pool.query('SELECT type, balance FROM accounts WHERE user_id = $1', [user.id]);
    const accounts = accountsResult.rows.reduce((acc, row) => {
      acc[row.type] = { balance: parseFloat(row.balance) };
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        referralCode: user.referral_code,
        tier: user.tier,
        accounts: accounts,
      },
      message: 'Login successful!'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

module.exports = {
  register,
  login,
};

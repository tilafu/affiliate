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

    // 4. Generate unique referral code and insert user, handling collisions
    let newUser;
    let userInserted = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // Prevent infinite loops

    while (!userInserted && attempts < MAX_ATTEMPTS) {
      attempts++;
      const newUserReferralCode = generateReferralCode(); // Generate code

      try {
        // 5. Attempt to insert the user with the generated code
        const newUserResult = await client.query(
          'INSERT INTO users (username, email, password_hash, referral_code, upliner_id, revenue_source) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, referral_code, tier',
          [username, email, passwordHash, newUserReferralCode, uplinerId, revenueSource]
        );
        newUser = newUserResult.rows[0]; // Assign user data
        userInserted = true; // Mark as successful
      } catch (insertError) {
        // Check if it's a unique constraint violation on referral_code (PostgreSQL code '23505')
        if (insertError.code === '23505' && insertError.constraint && insertError.constraint.includes('referral_code')) {
           // Collision detected, loop will continue to generate a new code
           console.warn(`Referral code collision detected (${newUserReferralCode}). Retrying... Attempt ${attempts}`);
           if (attempts >= MAX_ATTEMPTS) {
             throw new Error('Failed to generate a unique referral code after multiple attempts.');
           }
        } else {
          // Different error, re-throw to be caught by the outer catch block
          throw insertError;
        }
      }
    }

    // Ensure user was inserted before proceeding
    if (!newUser) {
        // This should technically be caught by the MAX_ATTEMPTS error, but as a safeguard:
        throw new Error('User creation failed unexpectedly after referral code generation attempts.');
    }

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

    await client.query('COMMIT');    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        referralCode: newUser.referral_code,
        tier: newUser.tier,
        // Include initial account info if needed
      },
      message: 'Registration successful!',
      redirectTo: 'onboarding' // Indicate the frontend should redirect to onboarding
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
  
  // Add logging for login attempt
  console.log(`[LOGIN ATTEMPT] Username/Email: ${username}, IP: ${req.ip || req.connection.remoteAddress}, Time: ${new Date().toISOString()}`);

  if (!username || !password) {
    console.log(`[LOGIN ERROR] Missing credentials - Username: ${!!username}, Password: ${!!password}`);
    return res.status(400).json({ success: false, message: 'Username/email and password are required' });
  }

  try {
    console.log(`[LOGIN] Looking up user: ${username}`);
    
    // Find user by username or email, include role
    const userResult = await pool.query(
      'SELECT id, username, email, password_hash, referral_code, tier, role FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log(`[LOGIN FAILED] User not found: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log(`[LOGIN] User found - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);

    // Compare password with stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log(`[LOGIN FAILED] Invalid password for user: ${user.username} (ID: ${user.id})`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log(`[LOGIN SUCCESS] Password verified for user: ${user.username} (ID: ${user.id})`);

    // Check if training account needs closing (optional, could be done elsewhere)
    // This logic might be better placed in a user service or middleware after login
    // For now, keeping it simple

    // Generate JWT token
    console.log(`[LOGIN] Generating JWT token for user: ${user.username}`);
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Fetch account balances (optional, could be separate endpoint)
    console.log(`[LOGIN] Fetching account balances for user: ${user.username}`);
    const accountsResult = await pool.query('SELECT type, balance FROM accounts WHERE user_id = $1', [user.id]);
    const accounts = accountsResult.rows.reduce((acc, row) => {
      acc[row.type] = { balance: parseFloat(row.balance) };
      return acc;
    }, {});
    
    console.log(`[LOGIN] Found ${accountsResult.rows.length} accounts for user: ${user.username}`);

    const responseData = {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        referralCode: user.referral_code,
        tier: user.tier,
        role: user.role, // Add role to the response
        accounts: accounts,
      },
      message: 'Login successful!'
    };
    
    console.log(`[LOGIN COMPLETE] Successfully logged in user: ${user.username} (ID: ${user.id}), Role: ${user.role}, Token length: ${token.length}`);

    res.status(200).json(responseData);

  } catch (error) {
    console.error(`[LOGIN ERROR] Server error for username: ${username}`, error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  // Placeholder logic: 
  console.log(`Received forgot password request for email: ${email}`);

  // Simulate success for now
  res.status(200).json({ success: true, message: 'If a user with that email exists, a password reset link has been sent.' });
};

const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;
    
    console.log(`User ${username} (ID: ${userId}) logging out`);
    
    // For JWT tokens, we don't need to do anything server-side
    // since they're stateless. However, we can log the logout
    // or perform any cleanup if needed.
    
    // Optional: Add logout logging to a sessions table if you have one
    // Optional: Clear any server-side session data if you have any
    
    res.status(200).json({ 
      success: true, 
      message: 'Logout successful' 
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during logout' 
    });  }
};

/**
 * @desc    Save onboarding responses
 * @route   POST /api/auth/onboarding
 * @access  Public
 */
const saveOnboardingResponses = async (req, res) => {
  const { 
    question_1, 
    question_2, 
    question_3, 
    question_4, 
    question_5,
    user_id,
    email 
  } = req.body;

  // Basic validation
  if (!question_1 || !question_2 || !question_3 || !question_4 || !question_5) {
    return res.status(400).json({ 
      success: false, 
      message: 'All questions must be answered' 
    });
  }

  try {
    const query = `
      INSERT INTO onboarding_responses 
      (user_id, email, question_1, question_2, question_3, question_4, question_5)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      user_id || null,
      email || null,
      question_1,
      question_2,
      question_3,
      question_4,
      question_5
    ];

    const result = await pool.query(query, values);

    console.log('Onboarding responses saved:', {
      response_id: result.rows[0].id,
      user_id: user_id,
      email: email
    });

    res.status(201).json({ 
      success: true, 
      message: 'Onboarding responses saved successfully',
      response_id: result.rows[0].id
    });

  } catch (error) {
    console.error('Error saving onboarding responses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error saving onboarding responses' 
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  logout,
  saveOnboardingResponses,
};

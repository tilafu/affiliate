require('dotenv').config(); // Ensure environment variables like DB connection details are loaded
const bcrypt = require('bcrypt');
const pool = require('./config/db');
const { generateReferralCode } = require('./utils/helpers');

const ADMIN_USERNAME = 'Mash';
const ADMIN_PASSWORD = 'machariamuchai';
const ADMIN_EMAIL = 'eli@admin.local'; // Placeholder email

async function addAdmin() {
  const client = await pool.connect();
  try {
    console.log(`Attempting to add admin user: ${ADMIN_USERNAME}`);

    // 1. Check if user already exists
    const existingUser = await client.query('SELECT id FROM users WHERE username = $1 OR email = $2', [ADMIN_USERNAME, ADMIN_EMAIL]);
    if (existingUser.rows.length > 0) {
      console.log(`Admin user "${ADMIN_USERNAME}" or email "${ADMIN_EMAIL}" already exists.`);
      return; // Exit if user exists
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);
    console.log('Password hashed successfully.');

    // 3. Generate unique referral code
    const referralCode = await generateReferralCode();
    console.log(`Generated referral code: ${referralCode}`);

    // 4. Insert admin user
    // Assuming upliner_id can be NULL for admin
    // Setting revenue_source to 'admin'
    const insertResult = await client.query(
      'INSERT INTO users (username, email, password_hash, referral_code, revenue_source, upliner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [ADMIN_USERNAME, ADMIN_EMAIL, passwordHash, referralCode, 'admin', null]
    );

    if (insertResult.rows.length > 0) {
      const newAdminId = insertResult.rows[0].id;
      console.log(`Admin user "${ADMIN_USERNAME}" added successfully with ID: ${newAdminId}`);

      // Optional: Create default accounts if necessary for admins (check application logic)
      // Example:
      // await client.query('INSERT INTO accounts (user_id, type, balance) VALUES ($1, $2, $3)', [newAdminId, 'main', 0]);
      // console.log(`Default main account created for admin ${newAdminId}.`);

    } else {
      console.error('Failed to insert admin user.');
    }

  } catch (error) {
    console.error('Error adding admin user:', error);
  } finally {
    await client.release();
    console.log('Database connection released.');
    await pool.end(); // Close the pool after the script finishes
    console.log('Database pool closed.');
  }
}

addAdmin();

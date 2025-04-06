// Function to generate a unique referral code
async function generateReferralCode(length = 8) {
const { pool } = require('../config/db');
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Removed lowercase for simplicity
  let referralCode = '';
  let isUnique = false;
  const MAX_ATTEMPTS = 5; // Prevent infinite loops
  let attempts = 0;

  while (!isUnique && attempts < MAX_ATTEMPTS) {
    attempts++;
    referralCode = '';
    for (let i = 0; i < length; i++) {
      referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT referral_code FROM users WHERE referral_code = $1', [referralCode]);
      if (result.rows.length === 0) {
        isUnique = true;
      }
    } catch (error) {
      console.error('Error checking referral code uniqueness:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate a unique referral code after multiple attempts.');
  }

  return referralCode;
}

module.exports = {
  generateReferralCode,
};

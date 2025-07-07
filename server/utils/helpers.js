// Function to generate a unique referral code
const pool = require('../config/db');

async function generateReferralCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let referralCode = '';
    let isUnique = false;
    const MAX_ATTEMPTS = 5;
    let attempts = 0;
    let client;

    try {
        client = await pool.connect();

        while (!isUnique && attempts < MAX_ATTEMPTS) {
            attempts++;
            referralCode = '';
            for (let i = 0; i < length; i++) {
                referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
            }

            try {
                await client.query('BEGIN'); // Start transaction within generateReferralCode
                const result = await client.query(
                    'SELECT referral_code FROM users WHERE referral_code = $1', 
                    [referralCode]
                );
                if (result.rows.length === 0) {
                    isUnique = true;
                }
                await client.query('COMMIT'); // Commit transaction if code is unique
            } catch (error) {
                await client.query('ROLLBACK'); // Rollback on error during check
                console.error('Error checking referral code uniqueness:', error);
                throw error; // Re-throw to be caught by the outer catch
            }
        }

        if (!isUnique) {
            throw new Error('Failed to generate a unique referral code after multiple attempts.');
        }

        return referralCode;

    } catch (error) {
        if (client) {
            client.release(); // Release client connection in case of error
        }
        throw error; // Re-throw the error
    } finally {
        if (client) {
            client.release(); // Ensure client release in finally block
        }
    }
}

module.exports = {
    generateReferralCode,
};

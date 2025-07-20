const pool = require('../config/db');

/**
 * Migration script to set withdrawal passwords for existing users
 * Sets withdrawal_password_hash to match password_hash for users who don't have one set
 */

async function setDefaultWithdrawalPasswords() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration: Setting default withdrawal passwords...');
        
        // Find users who don't have a withdrawal password set
        const usersWithoutWithdrawalPassword = await client.query(`
            SELECT id, username, password_hash 
            FROM users 
            WHERE withdrawal_password_hash IS NULL
        `);
        
        console.log(`Found ${usersWithoutWithdrawalPassword.rows.length} users without withdrawal passwords`);
        
        if (usersWithoutWithdrawalPassword.rows.length === 0) {
            console.log('No users need withdrawal password setup. Migration complete.');
            return;
        }
        
        // Update each user to set withdrawal_password_hash = password_hash
        let updated = 0;
        for (const user of usersWithoutWithdrawalPassword.rows) {
            await client.query(`
                UPDATE users 
                SET withdrawal_password_hash = $1 
                WHERE id = $2
            `, [user.password_hash, user.id]);
            
            updated++;
            console.log(`Updated user ${user.username} (${user.id}) - ${updated}/${usersWithoutWithdrawalPassword.rows.length}`);
        }
        
        console.log(`✅ Migration completed successfully! Updated ${updated} users.`);
        console.log('Users can now use their account password for withdrawals.');
        console.log('They can set a separate withdrawal password later if they prefer.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Check if this script is being run directly
if (require.main === module) {
    setDefaultWithdrawalPasswords()
        .then(() => {
            console.log('Migration script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { setDefaultWithdrawalPasswords };

// Reset Admin User Password
// Run this from the server directory: node reset_admin_password.js

const pool = require('./config/db');
const bcrypt = require('bcrypt');

async function resetAdminPassword() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Resetting admin user password...\n');
        
        // Hash the new password
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update the admin user's password
        const result = await client.query(`
            UPDATE users 
            SET password_hash = $1 
            WHERE role = 'admin' 
            RETURNING id, username, email
        `, [hashedPassword]);
        
        if (result.rows.length > 0) {
            const admin = result.rows[0];
            console.log('✅ Password reset successful!');
            console.log('Admin user:', admin);
            console.log('\n📋 Login Credentials:');
            console.log('Username:', admin.username);
            console.log('Password: admin123');
            console.log('\n🌐 Login at: http://localhost:3000/admin.html');
        } else {
            console.log('❌ No admin user found to reset');
        }
        
    } catch (error) {
        console.error('❌ Error resetting password:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

resetAdminPassword();

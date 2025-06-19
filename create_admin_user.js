// Script to create an admin user for testing
const bcrypt = require('bcrypt');
const pool = require('./server/config/db');

async function createAdminUser() {
    try {
        // Check if admin user already exists
        const existingAdmin = await pool.query(
            'SELECT * FROM users WHERE role = $1 OR username = $2',
            ['admin', 'admin']
        );

        if (existingAdmin.rows.length > 0) {
            console.log('Admin user already exists:');
            console.log('Username:', existingAdmin.rows[0].username);
            console.log('Email:', existingAdmin.rows[0].email);
            console.log('Role:', existingAdmin.rows[0].role);
            console.log('Tier:', existingAdmin.rows[0].tier);
            return;
        }

        // Generate password hash
        const password = 'admin123'; // Change this to a secure password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Generate unique referral code
        const referralCode = 'ADMIN' + Math.random().toString(36).substr(2, 6).toUpperCase();

        // Create admin user
        const newAdmin = await pool.query(`
            INSERT INTO users (
                username, 
                email, 
                password_hash, 
                referral_code, 
                role, 
                tier,
                is_active,
                email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, username, email, role, tier
        `, [
            'admin',
            'admin@affiliate.com',
            passwordHash,
            referralCode,
            'admin',
            'diamond',
            true,
            true
        ]);

        console.log('Admin user created successfully:');
        console.log('ID:', newAdmin.rows[0].id);
        console.log('Username:', newAdmin.rows[0].username);
        console.log('Email:', newAdmin.rows[0].email);
        console.log('Role:', newAdmin.rows[0].role);
        console.log('Tier:', newAdmin.rows[0].tier);
        console.log('Login with: admin / admin123');

        // Create main account for admin user
        await pool.query(`
            INSERT INTO accounts (user_id, type, balance, is_active)
            VALUES ($1, $2, $3, $4)
        `, [newAdmin.rows[0].id, 'main', 10000.00, true]);

        console.log('Admin account created with balance: 10000.00 USDT');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        process.exit(0);
    }
}

createAdminUser();

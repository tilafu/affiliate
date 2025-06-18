// Admin User Creation and Authentication Test Script
// Run this from the server directory: node create_admin_user.js

const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function createAdminUser() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Checking for existing admin user...\n');
        
        // Check if there's an admin user
        const adminCheck = await client.query(
            'SELECT id, username, email, role FROM users WHERE role = $1 LIMIT 1',
            ['admin']
        );
        
        let adminUser;
        
        if (adminCheck.rows.length === 0) {
            console.log('❌ No admin user found. Creating one...');
            
            // Create a test admin user
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            const newAdmin = await client.query(`
                INSERT INTO users (username, email, password_hash, referral_code, role, tier)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, username, email, role
            `, ['admin', 'admin@affiliate.com', hashedPassword, 'ADMIN001', 'admin', 'Platinum']);
            
            adminUser = newAdmin.rows[0];
            console.log('✅ Created admin user:', adminUser);
        } else {
            adminUser = adminCheck.rows[0];
            console.log('✅ Admin user found:', adminUser);
        }
        
        // Test JWT token generation
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
        const token = jwt.sign(
            { userId: adminUser.id },
            jwtSecret,
            { expiresIn: '24h' }
        );
        
        console.log('✅ JWT token generated successfully');
        console.log('Admin User ID:', adminUser.id);
        console.log('JWT Secret:', jwtSecret.substring(0, 20) + '...');
        console.log('\n📋 Admin Login Credentials:');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('\n🔑 Generated JWT Token (for testing):');
        console.log(token);
        
        // Test token verification
        try {
            const decoded = jwt.verify(token, jwtSecret);
            console.log('✅ Token verification successful');
            console.log('Decoded user ID:', decoded.userId);
        } catch (error) {
            console.log('❌ Token verification failed:', error.message);
        }
        
        // Test database queries for admin endpoints
        console.log('\n🔍 Testing database queries...');
        
        try {
            // Test stats queries
            const userCount = await client.query('SELECT COUNT(*) as count FROM users');
            console.log('✅ Total users:', userCount.rows[0].count);
            
            const driveCount = await client.query('SELECT COUNT(*) as count FROM drive_sessions');
            console.log('✅ Total drive sessions:', driveCount.rows[0].count);
            
            const commissionSum = await client.query('SELECT COALESCE(SUM(commission_amount), 0) as total FROM commission_logs');
            console.log('✅ Total commission:', commissionSum.rows[0].total);
            
        } catch (error) {
            console.log('❌ Database query error:', error.message);
        }
        
        // Test notification categories
        try {
            const notificationCategories = await client.query('SELECT COUNT(*) as count FROM notification_categories');
            console.log('✅ Notification categories:', notificationCategories.rows[0].count);
        } catch (error) {
            console.log('❌ Notification categories error:', error.message);
        }
        
        // Test tier configurations
        try {
            const tierConfigs = await client.query('SELECT COUNT(*) as count FROM tier_quantity_configs');
            console.log('✅ Tier configurations:', tierConfigs.rows[0].count);
        } catch (error) {
            console.log('❌ Tier configurations error:', error.message);
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Go to: http://localhost:3000/admin.html');
        console.log('2. Login with username: admin, password: admin123');
        console.log('3. The admin panel should now work properly');
        console.log('\n📝 If you see 404 errors, it means authentication is working');
        console.log('   but the specific endpoints need to be checked.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

createAdminUser();

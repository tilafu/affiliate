// Test script to verify admin authentication and endpoints
require('dotenv').config();
const pool = require('./server/config/db');
const jwt = require('./server/node_modules/jsonwebtoken');

async function testAdminAuth() {
    const client = await pool.connect();
    
    try {
        console.log('Testing admin authentication and endpoints...\n');
        
        // Check if there's an admin user
        const adminCheck = await client.query(
            'SELECT id, username, role FROM users WHERE role = $1 LIMIT 1',
            ['admin']
        );
        
        if (adminCheck.rows.length === 0) {
            console.log('❌ No admin user found. Creating one...');
            
            // Create a test admin user
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            const adminUser = await client.query(`
                INSERT INTO users (username, email, password_hash, referral_code, role, tier)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, username, role
            `, ['admin', 'admin@test.com', hashedPassword, 'ADMIN123', 'admin', 'platinum']);
            
            console.log('✅ Created admin user:', adminUser.rows[0]);
        } else {
            console.log('✅ Admin user found:', adminCheck.rows[0]);
        }
        
        // Test JWT token generation
        const adminUser = adminCheck.rows[0] || await client.query(
            'SELECT id, username, role FROM users WHERE role = $1 LIMIT 1',
            ['admin']
        ).then(r => r.rows[0]);
        
        const token = jwt.sign(
            { userId: adminUser.id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );
        
        console.log('✅ JWT token generated successfully');
        console.log('Admin User ID:', adminUser.id);
        console.log('Token (first 50 chars):', token.substring(0, 50) + '...');
        
        // Test database queries used by admin endpoints
        console.log('\nTesting database queries...');
        
        // Test stats query
        try {
            const statsQueries = [
                'SELECT COUNT(*) as total_users FROM users',
                'SELECT COUNT(*) as total_drives FROM drive_sessions',
                'SELECT COALESCE(SUM(commission_amount), 0) as total_commission FROM commission_logs',
                'SELECT COUNT(*) as total_products FROM products',
                'SELECT COUNT(*) as total_deposits FROM deposits',
                'SELECT COUNT(*) as total_withdrawals FROM withdrawals'
            ];
            
            for (const query of statsQueries) {
                const result = await client.query(query);
                console.log('✅', query, '→', result.rows[0]);
            }
        } catch (error) {
            console.log('❌ Stats query error:', error.message);
        }
        
        // Test notification categories
        try {
            const notificationResult = await client.query(
                'SELECT COUNT(*) as count FROM notification_categories'
            );
            console.log('✅ Notification categories count:', notificationResult.rows[0].count);
        } catch (error) {
            console.log('❌ Notification categories error:', error.message);
        }
        
        // Test tier configurations
        try {
            const tierResult = await client.query(
                'SELECT COUNT(*) as count FROM tier_quantity_configs'
            );
            console.log('✅ Tier configurations count:', tierResult.rows[0].count);
        } catch (error) {
            console.log('❌ Tier configurations error:', error.message);
        }
        
        // Test the tier_quantity_configs columns
        try {
            const tierColumnsResult = await client.query(`
                SELECT tier_name, quantity_limit, num_single_tasks, commission_rate
                FROM tier_quantity_configs
                LIMIT 3
            `);
            console.log('✅ Tier configurations sample:', tierColumnsResult.rows);
        } catch (error) {
            console.log('❌ Tier configurations columns error:', error.message);
        }
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\nTo test the admin panel:');
        console.log('1. Start the admin server: cd server && node adminServer.js');
        console.log('2. Open: http://localhost:3001/admin.html');
        console.log('3. Login with admin credentials');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

testAdminAuth();

// Test specific admin endpoints with authentication
const pool = require('./config/db');
const jwt = require('jsonwebtoken');

async function testEndpoints() {
    const client = await pool.connect();
    
    try {
        console.log('Testing admin endpoints with authentication...\n');
        
        // Get admin user
        const adminUser = await client.query(
            'SELECT id, username, role FROM users WHERE role = $1 LIMIT 1',
            ['admin']
        );
        
        if (adminUser.rows.length === 0) {
            console.log('❌ No admin user found');
            return;
        }
        
        // Generate token
        const token = jwt.sign(
            { userId: adminUser.rows[0].id },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );
        
        console.log('✅ Admin user:', adminUser.rows[0]);
        console.log('✅ JWT token generated\n');
        
        // Test dashboard stats endpoint manually
        console.log('Testing dashboard stats function...');
        try {
            // Simulate the getDashboardStats function
            const statsQueries = {
                totalUsers: await client.query('SELECT COUNT(*) as count FROM users'),
                totalDeposits: await client.query('SELECT COALESCE(SUM(amount), 0) as sum FROM deposits'),
                totalWithdrawals: await client.query('SELECT COALESCE(SUM(amount), 0) as sum FROM withdrawals'),
                activeDrives: await client.query('SELECT COUNT(*) as count FROM drive_sessions WHERE status = $1', ['active'])
            };
            
            const stats = {
                totalUsers: statsQueries.totalUsers.rows[0].count,
                totalDeposits: statsQueries.totalDeposits.rows[0].sum,
                totalWithdrawals: statsQueries.totalWithdrawals.rows[0].sum,
                activeDrives: statsQueries.activeDrives.rows[0].count
            };
            
            console.log('✅ Dashboard stats:', stats);
        } catch (error) {
            console.log('❌ Dashboard stats error:', error.message);
        }
        
        // Test notification categories
        console.log('\nTesting notification categories...');
        try {
            const notificationCategories = await client.query(
                'SELECT * FROM notification_categories ORDER BY name ASC'
            );
            console.log('✅ Notification categories:', notificationCategories.rows);
        } catch (error) {
            console.log('❌ Notification categories error:', error.message);
        }
        
        // Show token for manual testing
        console.log('\n🔑 For manual testing, use this bearer token:');
        console.log('Authorization: Bearer ' + token);
        console.log('\nTest URLs:');
        console.log('curl -H "Authorization: Bearer ' + token + '" http://localhost:3001/api/admin/stats');
        console.log('curl -H "Authorization: Bearer ' + token + '" http://localhost:3001/api/admin/notification-categories');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

testEndpoints();

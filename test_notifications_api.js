const pool = require('./server/config/db');

async function testNotificationsAPI() {
    try {
        console.log('Testing notifications API...');
        
        // Check if we can connect to DB
        const client = await pool.connect();
        console.log('Database connected successfully');
        
        // Check notifications table
        const notificationsCount = await client.query('SELECT COUNT(*) FROM notifications');
        console.log('Total notifications in database:', notificationsCount.rows[0].count);
        
        // Check general_notifications table
        const generalNotificationsCount = await client.query('SELECT COUNT(*) FROM general_notifications');
        console.log('Total general notifications in database:', generalNotificationsCount.rows[0].count);
        
        // Check notification_categories table
        const categoriesCount = await client.query('SELECT COUNT(*) FROM notification_categories');
        console.log('Total notification categories in database:', categoriesCount.rows[0].count);
        
        // Check if tables exist and have data
        if (notificationsCount.rows[0].count > 0) {
            const sampleNotifications = await client.query('SELECT * FROM notifications LIMIT 3');
            console.log('Sample notifications:', sampleNotifications.rows);
        }
        
        // Test the API query structure
        const testUserId = 1; // Assuming user ID 1 exists
        const testQuery = `
            SELECT 
                n.id, 
                n.title,
                n.message, 
                n.image_url,
                n.priority,
                n.created_at, 
                n.is_read,
                nc.name as category_name,
                nc.color as category_color,
                nc.icon as category_icon,
                nc.description as category_description
             FROM notifications n
             LEFT JOIN notification_categories nc ON n.category_id = nc.id
             WHERE n.user_id = $1
             ORDER BY n.priority DESC, n.created_at DESC
        `;
        
        const testResult = await client.query(testQuery, [testUserId]);
        console.log('Test query result for user 1:', testResult.rows);
        
        client.release();
        console.log('Test completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testNotificationsAPI();

const pool = require('./server/config/db');

async function testNotificationsTables() {
    try {
        // Check if notification_categories table exists and has data
        console.log('Checking notification_categories table...');
        const categoriesResult = await pool.query('SELECT COUNT(*) FROM notification_categories');
        console.log('notification_categories count:', categoriesResult.rows[0].count);
        
        if (categoriesResult.rows[0].count === '0') {
            console.log('No categories found, creating default category...');
            await pool.query(`
                INSERT INTO notification_categories (name, color, icon, description) 
                VALUES ('General', '#007bff', 'fas fa-bell', 'General notifications')
                ON CONFLICT (name) DO NOTHING
            `);
            console.log('Default category created.');
        }
        
        // Check notifications table
        console.log('Checking notifications table...');
        const notificationsResult = await pool.query('SELECT COUNT(*) FROM notifications');
        console.log('notifications count:', notificationsResult.rows[0].count);
        
        // Check general_notifications table
        console.log('Checking general_notifications table...');
        const generalResult = await pool.query('SELECT COUNT(*) FROM general_notifications');
        console.log('general_notifications count:', generalResult.rows[0].count);
        
        // Check if we have any users to test with
        console.log('Checking users table...');
        const usersResult = await pool.query('SELECT id, username FROM users LIMIT 3');
        console.log('Sample users:', usersResult.rows);
        
        if (usersResult.rows.length > 0) {
            const sampleUserId = usersResult.rows[0].id;
            console.log(`Testing notification query for user ${sampleUserId}...`);
            
            // Test the actual query from getUserNotifications
            const testResult = await pool.query(
                `SELECT 
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
                 ORDER BY n.priority DESC, n.created_at DESC`,
                [sampleUserId]
            );
            console.log(`Found ${testResult.rows.length} user notifications`);
            
            // Test general notifications query
            const generalTestResult = await pool.query(
                `SELECT 
                    gn.id,
                    gn.title,
                    gn.message,
                    gn.image_url,
                    gn.priority,
                    gn.created_at,
                    true as is_general,
                    nc.name as category_name,
                    nc.color as category_color,
                    nc.icon as category_icon,
                    nc.description as category_description
                 FROM general_notifications gn
                 JOIN notification_categories nc ON gn.category_id = nc.id
                 WHERE gn.is_active = true 
                 AND (gn.end_date IS NULL OR gn.end_date > NOW())
                 ORDER BY gn.priority DESC, gn.created_at DESC`
            );
            console.log(`Found ${generalTestResult.rows.length} general notifications`);
        }
        
        console.log('All tests completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Database test error:', error);
        process.exit(1);
    }
}

testNotificationsTables();

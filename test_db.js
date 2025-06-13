const pool = require('./server/config/db');

async function testDatabase() {
    try {
        console.log('Testing database connection...');
        
        // Test basic connection
        const client = await pool.connect();
        console.log('✓ Database connected successfully');
        
        // Test a simple query
        const result = await client.query('SELECT COUNT(*) as count FROM users');
        console.log('✓ User count query successful:', result.rows[0].count);
        
        // Test task sets query
        const taskSetsResult = await client.query('SELECT COUNT(*) as count FROM drive_task_sets');
        console.log('✓ Task sets count:', taskSetsResult.rows[0].count);
        
        // Test a join query (similar to what we use)
        const joinResult = await client.query(`
            SELECT 
                uadi.id,
                dts.is_combo
            FROM user_active_drive_items uadi
            JOIN drive_task_sets dts ON uadi.drive_task_set_id_override = dts.id
            LIMIT 1
        `);
        console.log('✓ Join query successful. Sample result:', joinResult.rows[0]);
        
        client.release();
        console.log('✓ All database tests passed');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Database test failed:', error);
        process.exit(1);
    }
}

testDatabase();

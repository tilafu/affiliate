const pool = require('./server/config/db');

async function checkProductRatingsTable() {
    try {
        console.log('Checking product_ratings table...');
        
        // Check if table exists
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'product_ratings'
            );
        `);
        
        console.log('product_ratings table exists:', tableExists.rows[0].exists);
        
        if (tableExists.rows[0].exists) {
            // Get table structure
            const columns = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'product_ratings'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nTable structure:');
            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });
            
            // Check for any existing data
            const count = await pool.query('SELECT COUNT(*) FROM product_ratings');
            console.log(`\nExisting records: ${count.rows[0].count}`);
        }
        
        // Also check user_commission_history
        const historyExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_commission_history'
            );
        `);
        
        console.log('\nuser_commission_history table exists:', historyExists.rows[0].exists);
        
        // Check drive_sessions for commission_earned column
        const driveColumns = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'drive_sessions'
            AND column_name = 'commission_earned';
        `);
        
        console.log('\ndrive_sessions.commission_earned column exists:', driveColumns.rows.length > 0);
        
    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await pool.end();
    }
}

checkProductRatingsTable();

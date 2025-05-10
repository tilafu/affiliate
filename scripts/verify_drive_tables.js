const pool = require('../server/config/db');

async function verifyDriveTables() {
    const client = await pool.connect();
    try {
        console.log('Checking drive-related tables...');
        
        // Check drive_sessions table
        const sessionTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'drive_sessions'
            );
        `);
        
        console.log(`drive_sessions table exists: ${sessionTableCheck.rows[0].exists ? 'YES' : 'NO'}`);
        
        // Check drive_orders table
        const ordersTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'drive_orders'
            );
        `);
        
        console.log(`drive_orders table exists: ${ordersTableCheck.rows[0].exists ? 'YES' : 'NO'}`);
        
        // Check products table
        const productsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'products'
            );
        `);
        
        console.log(`products table exists: ${productsTableCheck.rows[0].exists ? 'YES' : 'NO'}`);
        
        // Check required columns in products table
        if (productsTableCheck.rows[0].exists) {
            const productColumns = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'products';
            `);
            
            console.log('\nProducts table columns:');
            productColumns.rows.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });
            
            // Check if image_url and commission_rate columns exist
            const hasImageUrl = productColumns.rows.some(col => col.column_name === 'image_url');
            const hasCommissionRate = productColumns.rows.some(col => col.column_name === 'commission_rate');
            
            console.log(`\nproducts.image_url column exists: ${hasImageUrl ? 'YES' : 'NO'}`);
            console.log(`products.commission_rate column exists: ${hasCommissionRate ? 'YES' : 'NO'}`);
            
            if (!hasImageUrl || !hasCommissionRate) {
                console.log('\nMissing columns in products table. Run these SQL commands:');
                if (!hasImageUrl) {
                    console.log(`ALTER TABLE products ADD COLUMN image_url VARCHAR(255) DEFAULT '/assets/uploads/product_default.png';`);
                }
                if (!hasCommissionRate) {
                    console.log(`ALTER TABLE products ADD COLUMN commission_rate DECIMAL(5, 3) DEFAULT 0.01;`);
                }
            }
        }
        
        console.log('\nChecking for sample products...');
        // Check if any products exist
        const productCount = await client.query('SELECT COUNT(*) FROM products');
        console.log(`Number of products in database: ${productCount.rows[0].count}`);
        
        if (parseInt(productCount.rows[0].count) === 0) {
            console.log('\nNo products found. Run these SQL commands to add sample products:');
            console.log(`
INSERT INTO products (name, price, image_url, commission_rate) VALUES
('Basic Data Drive', 10.00, '/assets/uploads/product_default.png', 0.01),
('Standard Data Drive', 25.00, '/assets/uploads/product_default.png', 0.015),
('Premium Data Drive', 50.00, '/assets/uploads/product_default.png', 0.02),
('Enterprise Data Drive', 100.00, '/assets/uploads/product_default.png', 0.025);
            `);
        }
        
    } catch (error) {
        console.error('Error verifying drive tables:', error);
    } finally {
        client.release();
        // Close the pool to end the script
        pool.end();
    }
}

verifyDriveTables();

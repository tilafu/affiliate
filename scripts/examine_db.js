// Script to examine the database structure
const pool = require('./server/config/db');

async function examineDatabase() {
  const client = await pool.connect();
  try {
    console.log('--- Database Tables ---');
    // List all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Tables in the database:');
    tables.rows.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
    // Check products table structure
    console.log('\n--- Products Table Structure ---');
    const productColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products'
      ORDER BY ordinal_position;
    `);
    
    productColumns.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Check sample products
    console.log('\n--- Sample Products ---');
    const products = await client.query('SELECT id, name, price, is_active FROM products LIMIT 5;');
    console.log(products.rows);
    
    // Check drive_sessions table structure
    console.log('\n--- Drive Sessions Table Structure ---');
    const sessionColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drive_sessions'
      ORDER BY ordinal_position;
    `);
    
    sessionColumns.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Check for drive_orders table structure
    console.log('\n--- Drive Orders Table Structure ---');
    const ordersColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'drive_orders'
      ORDER BY ordinal_position;
    `);
    
    if (ordersColumns.rows.length > 0) {
      ordersColumns.rows.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
      });
    } else {
      console.log('drive_orders table not found!');
    }
    
  } catch (error) {
    console.error('Error examining database:', error);
  } finally {
    client.release();
    pool.end();
  }
}

examineDatabase();

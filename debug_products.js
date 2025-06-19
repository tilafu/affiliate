require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function debugProducts() {
  try {
    console.log('🔍 Checking database connection...');
    
    // Test database connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected at:', connectionTest.rows[0].now);
    
    // Check products count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log('📊 Total products count:', countResult.rows[0].count);
    
    // Check products table structure
    const structureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);
    console.log('🏗️ Products table structure:');
    structureResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check sample products
    const sampleResult = await pool.query('SELECT id, name, price, status, is_active FROM products LIMIT 5');
    console.log('📝 Sample products:');
    sampleResult.rows.forEach(product => {
      console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: ${product.price}, Status: ${product.status}, Active: ${product.is_active}`);
    });
    
    // Check high-value products (price > 5000)
    const highValueResult = await pool.query(`
      SELECT id, name, price, status, is_active 
      FROM products 
      WHERE price > 5000 
      AND status = 'active'
      AND is_active = true
      ORDER BY price DESC
      LIMIT 10
    `);
    console.log('💰 High-value products (price > 5000):');
    if (highValueResult.rows.length === 0) {
      console.log('  ❌ No high-value products found');
    } else {
      highValueResult.rows.forEach(product => {
        console.log(`  - ID: ${product.id}, Name: ${product.name}, Price: $${product.price}`);
      });
    }
    
    // Check users table for testing authentication
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log('👥 Total users count:', usersResult.rows[0].count);
    
    // Check if admin user exists
    const adminResult = await pool.query("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1");
    if (adminResult.rows.length > 0) {
      console.log('🔑 Admin user found:', adminResult.rows[0]);
    } else {
      console.log('❌ No admin user found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('🔚 Database connection closed');
  }
}

debugProducts();

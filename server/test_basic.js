// Simple test script without external dependencies
const pool = require('./config/db');

async function testBasicEndpoints() {
  console.log('🧪 Testing basic functionality...');
  
  try {
    // Test database connection
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', dbTest.rows[0].now);
    
    // Check if we have users with tokens
    const userTest = await pool.query('SELECT id, username, role FROM users WHERE role = $1 LIMIT 1', ['admin']);
    if (userTest.rows.length > 0) {
      console.log('✅ Admin user found:', userTest.rows[0]);
    } else {
      console.log('❌ No admin user found');
    }
    
    // Test drive progress query
    const driveProgressTest = await pool.query(`
      SELECT 
        drives_completed,
        is_working_day,
        date
      FROM user_drive_progress 
      WHERE user_id = $1 
      ORDER BY date DESC 
      LIMIT 7
    `, [4]); // Using admin user ID
    
    console.log('📈 Drive progress data for user 4:', driveProgressTest.rows);
    
    // Test user_working_days table
    const workingDaysTest = await pool.query(`
      SELECT total_working_days, weekly_progress 
      FROM user_working_days 
      WHERE user_id = $1
    `, [4]);
    
    console.log('📊 Working days data for user 4:', workingDaysTest.rows);
    
    // Test products query
    const productsTest = await pool.query(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE price > 5000 
      AND status = 'active'
      AND is_active = true
    `);
    
    console.log('🛍️ High-value products count:', productsTest.rows[0].count);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await pool.end();
    console.log('✅ Test completed');
  }
}

testBasicEndpoints();

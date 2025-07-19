const db = require('./server/db');

async function checkDatabase() {
  try {
    console.log('Checking database tables and data...\n');
    
    // Check if chat_fake_users table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_fake_users'
      );
    `);
    
    console.log('chat_fake_users table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Count fake users
      const userCount = await db.query('SELECT COUNT(*) as count FROM chat_fake_users');
      console.log('Fake users count:', userCount.rows[0].count);
      
      // Show first few fake users
      const users = await db.query('SELECT id, username, display_name FROM chat_fake_users LIMIT 5');
      console.log('Sample fake users:');
      users.rows.forEach(user => {
        console.log(`  - ID: ${user.id}, Username: ${user.username}, Display Name: ${user.display_name}`);
      });
    }
    
    // Check chat_groups table
    const groupTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_groups'
      );
    `);
    
    console.log('\nchat_groups table exists:', groupTableCheck.rows[0].exists);
    
    if (groupTableCheck.rows[0].exists) {
      const groupCount = await db.query('SELECT COUNT(*) as count FROM chat_groups');
      console.log('Chat groups count:', groupCount.rows[0].count);
    }
    
    console.log('\nDatabase check complete.');
    
  } catch (error) {
    console.error('Database check failed:', error.message);
  } finally {
    process.exit(0);
  }
}

checkDatabase();

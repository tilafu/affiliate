const bcrypt = require('bcrypt');
const pool = require('./config/db');

async function checkAdminPassword() {
  try {
    // Get the admin user
    const result = await pool.query("SELECT id, username, password_hash FROM users WHERE username = 'Mash' OR role = 'admin'");
    
    if (result.rows.length === 0) {
      console.log('No admin user found');
      return;
    }
    
    const user = result.rows[0];
    console.log(`Found admin user: ${user.username} (ID: ${user.id})`);
    
    // Test common passwords
    const testPasswords = ['admin', 'admin123', 'password', '123456', 'Mash123', 'mash', 'eli123'];
    
    for (const password of testPasswords) {
      try {
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
          console.log(`✅ Password found: ${password}`);
          return;
        }
      } catch (e) {
        console.log(`Error testing password "${password}":`, e.message);
      }
    }
    
    console.log('❌ None of the common passwords worked');
    console.log('You may need to reset the password or create a new admin user');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminPassword();

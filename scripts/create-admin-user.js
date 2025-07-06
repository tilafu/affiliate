/**
 * Create Admin User
 * Creates or updates the admin user with the correct password hash
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Create database connection
const db = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'affiliate_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function createAdminUser() {
  try {
    console.log('Creating/updating admin user...');
    
    // Generate password hash for 'admin123'
    const password = 'admin123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    console.log('Generated password hash for admin123');
    
    // Check if admin user exists
    const checkAdmin = await db.query("SELECT id, username FROM users WHERE username = 'admin'");
    
    if (checkAdmin.rows.length > 0) {
      // Update existing admin
      await db.query(`
        UPDATE users 
        SET password_hash = $1, role = 'admin', tier = 'diamond'
        WHERE username = 'admin'
      `, [passwordHash]);
      
      console.log('Updated existing admin user with new password hash');
      
    } else {
      // Create new admin user
      await db.query(`
        INSERT INTO users (username, email, password_hash, referral_code, role, tier) 
        VALUES ('admin', 'admin@affiliate.com', $1, 'ADMIN001', 'admin', 'diamond')
      `, [passwordHash]);
      
      console.log('Created new admin user');
    }
    
    // Verify admin user
    const admin = await db.query("SELECT id, username, role FROM users WHERE username = 'admin'");
    
    if (admin.rows.length > 0) {
      console.log('Admin user verified:', admin.rows[0]);
      console.log('\nAdmin credentials:');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      console.log('Failed to verify admin user');
    }
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await db.end();
    process.exit(0);
  }
}

// Run the script
createAdminUser();

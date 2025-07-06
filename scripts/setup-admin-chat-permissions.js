/**
 * Setup Admin Chat Permissions
 * Adds chat management permissions to admin users and creates initial data
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');

// Create database connection
const db = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'affiliate_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function setupAdminChatPermissions() {
  try {
    console.log('Setting up admin chat permissions...');
    
    // Check if any admins exist
    const checkAdmins = await db.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    
    if (parseInt(checkAdmins.rows[0].count) === 0) {
      console.log('No admin users found. Creating default admin user...');
      
      // Create default admin user with password hash for 'admin123'
      const passwordHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
      
      await db.query(`
        INSERT INTO users (username, email, password_hash, referral_code, role, tier)
        VALUES ('admin', 'admin@affiliate.com', $1, 'ADMIN001', 'admin', 'diamond')
        ON CONFLICT (username) DO NOTHING
      `, [passwordHash]);
      
      console.log('Default admin user created.');
    }
    
    // Grant chat management permission to all admins
    await db.query(`
      UPDATE admins 
      SET permissions = permissions || '{"chat_management": true}'::jsonb
    `);
    
    console.log('Successfully granted chat management permissions to all admins');
    
    `);
    
    // Get admin ID for reference
    const adminResult = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminResult.rows[0].id;
    
    console.log(`Admin ID: ${adminId}`);
    
    // Create fake users
    console.log('Creating fake users...');
    
    // First, check how many fake users already exist
    const existingUsers = await db.query('SELECT COUNT(*) FROM chat_fake_users');
    const existingUserCount = parseInt(existingUsers.rows[0].count);
    
    if (existingUserCount > 0) {
      console.log(`Found ${existingUserCount} existing fake users. Skipping creation.`);
    } else {
      // Create 200 fake users
      const numUsers = 200;
      
      for (let i = 0; i < numUsers; i++) {
        const username = faker.internet.userName();
        const displayName = faker.person.fullName();
        const avatar = faker.image.avatar();
        const bio = faker.lorem.paragraph(1);
        
        await db.query(`
          INSERT INTO chat_fake_users (username, display_name, avatar_url, bio, created_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [username, displayName, avatar, bio, adminId]);
        
        if (i % 50 === 0) {
          console.log(`Created ${i} fake users...`);
        }
      }
      
      console.log(`Created ${numUsers} fake users.`);
    }
    
    console.log('\nSetup complete!');
  } catch (error) {
    console.error('Error setting up admin chat permissions:', error);
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await db.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  } try {
      await db.end();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the setup
setupAdminChatPermissions();

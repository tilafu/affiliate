/**
 * Migration: Add Support Group Functionality
 * This script adds support group functionality to allow isolated user-admin conversations
 */

const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

async function runSupportGroupMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting support group migration...');
    await client.query('BEGIN');

    // Read and execute the SQL migration file
    const sqlPath = path.join(__dirname, '../../sql/add_support_group_flag.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await client.query(statement);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Support group migration completed successfully!');
    
    // Verify the changes
    const supportGroupCheck = await client.query(`
      SELECT id, name, is_support_group 
      FROM chat_groups 
      WHERE name = 'Support Team'
    `);
    
    if (supportGroupCheck.rows.length > 0) {
      const group = supportGroupCheck.rows[0];
      console.log(`✅ Support Team group found: ID=${group.id}, is_support_group=${group.is_support_group}`);
    } else {
      console.log('⚠️  Support Team group not found - may need to run chat initialization first');
    }

    // Check if the new column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' 
      AND column_name = 'support_conversation_user_id'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ support_conversation_user_id column added successfully');
    } else {
      console.log('❌ Failed to add support_conversation_user_id column');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
if (require.main === module) {
  runSupportGroupMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runSupportGroupMigration };

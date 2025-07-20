/**
 * Support Group Migration Script
 * Adds support group functionality to enable isolated support conversations
 */

const db = require('./server/db');
const fs = require('fs');
const path = require('path');

async function runSupportGroupMigration() {
  let client;
  
  try {
    console.log('🚀 Starting Support Group Migration...');
    
    // Read the SQL migration file
    const sqlFilePath = path.join(__dirname, 'sql', 'add_support_group_flag.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    client = await db.pool.connect();
    
    console.log('📄 Executing migration in transaction...');
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // Execute the entire SQL content as one block
      await client.query(sqlContent);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('✅ Transaction committed successfully');
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    }
    
    // Verify the changes
    console.log('\n✅ Verifying migration...');
    
    // Check if is_support_group column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_groups' AND column_name = 'is_support_group'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('   ✓ is_support_group column added to chat_groups');
    }
    
    // Check if support_conversation_user_id column exists
    const msgColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' AND column_name = 'support_conversation_user_id'
    `);
    
    if (msgColumnCheck.rows.length > 0) {
      console.log('   ✓ support_conversation_user_id column added to chat_messages');
    }
    
    // Check if Support Team is marked as support group
    const supportTeamCheck = await client.query(`
      SELECT id, name, is_support_group 
      FROM chat_groups 
      WHERE name = 'Support Team'
    `);
    
    if (supportTeamCheck.rows.length > 0 && supportTeamCheck.rows[0].is_support_group) {
      console.log('   ✓ Support Team group is now marked as support group');
      console.log(`   📋 Support Team Group ID: ${supportTeamCheck.rows[0].id}`);
    }
    
    console.log('\n🎉 Support Group Migration completed successfully!');
    console.log('\n📝 Changes applied:');
    console.log('   • Users can now post messages in Support Team group');
    console.log('   • Each user sees only their own conversation with support');
    console.log('   • Admin responses will appear as "Support" to users');
    console.log('   • Admins can see all support conversations in admin panel');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await db.pool.end();
    process.exit(0);
  }
}

// Run the migration
runSupportGroupMigration();

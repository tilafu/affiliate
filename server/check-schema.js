/**
 * Database Schema Checker
 * Quick script to examine the current chat table structure
 */

const db = require('./db');

async function main() {
  try {
    console.log('=== CHAT TABLES SCHEMA ===\n');
    
    // Check chat_messages table
    const messagesSchema = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' 
      ORDER BY ordinal_position
    `);
    
    console.log('CHAT_MESSAGES TABLE:');
    messagesSchema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    console.log('\n');
    
    // Check fake users table
    const fakeUsersSchema = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'chat_fake_users' 
      ORDER BY ordinal_position
    `);
    
    console.log('CHAT_FAKE_USERS TABLE:');
    fakeUsersSchema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    console.log('\n');
    
    // Sample data
    console.log('=== SAMPLE DATA ===\n');
    
    const sampleMessages = await db.query('SELECT * FROM chat_messages LIMIT 3');
    console.log('Sample messages:', JSON.stringify(sampleMessages.rows, null, 2));
    
    const sampleFakeUsers = await db.query('SELECT id, username, display_name FROM chat_fake_users LIMIT 5');
    console.log('\nSample fake users:', JSON.stringify(sampleFakeUsers.rows, null, 2));
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

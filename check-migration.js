const db = require('./server/db');

async function checkMigration() {
  try {
    // Check if columns exist
    const result = await db.query(`
      SELECT name, is_support_group 
      FROM chat_groups 
      WHERE name = 'Support Team'
    `);
    
    console.log('Support Team status:', result.rows);
    
    // Check if support_conversation_user_id column exists
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages' AND column_name = 'support_conversation_user_id'
    `);
    
    console.log('support_conversation_user_id column exists:', columnCheck.rows.length > 0);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.pool.end();
  }
}

checkMigration();

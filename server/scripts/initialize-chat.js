const db = require('./db');
const fs = require('fs');

async function initializeChat() {
  try {
    console.log('Reading SQL file...');
    const sql = fs.readFileSync('../sql/initialize_chat_system.sql', 'utf8');
    console.log('Executing chat system initialization...');
    const result = await db.query(sql);
    console.log('Chat system initialized successfully!');
    
    // Verify setup
    const groups = await db.query('SELECT id, name, is_public, member_count FROM chat_groups ORDER BY name');
    console.log('\n=== CHAT GROUPS ===');
    groups.rows.forEach(g => console.log(`- ${g.id}: ${g.name} (Public: ${g.is_public}, Members: ${g.member_count})`));
    
    const fakeUsers = await db.query('SELECT COUNT(*) as count FROM chat_fake_users');
    console.log(`\n=== FAKE USERS ===\nTotal: ${fakeUsers.rows[0].count}`);
    
    await db.pool.end();
  } catch (error) {
    console.error('Error initializing chat:', error);
    process.exit(1);
  }
}

initializeChat();

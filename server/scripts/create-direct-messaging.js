const db = require('./db');
const fs = require('fs');

async function createDirectMessagingTables() {
  try {
    console.log('Creating direct messaging tables...');
    const sql = fs.readFileSync('../sql/create_direct_messaging.sql', 'utf8');
    await db.query(sql);
    console.log('Direct messaging tables created successfully!');
    
    await db.pool.end();
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  }
}

createDirectMessagingTables();

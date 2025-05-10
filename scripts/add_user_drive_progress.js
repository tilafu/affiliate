// Script to add user drive progress tracking tables

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

async function main() {
  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../sql/add_user_drive_progress.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      console.log('Executing SQL to add user drive progress tables...');
      await client.query(sql);
      console.log('SQL executed successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error executing SQL:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

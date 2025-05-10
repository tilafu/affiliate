// This script adds drive_session_id column to commission_logs table
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '../.env');

// Load environment variables
dotenv.config({ path: envPath });

// Create a new pool instance
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function addDriveSessionIdColumn() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/add_drive_session_id_to_commission_logs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await pool.query(sql);
    
    console.log('Successfully added drive_session_id column to commission_logs table');
    
    // Close the pool
    await pool.end();
  } catch (error) {
    console.error('Error executing SQL:', error);
    process.exit(1);
  }
}

// Run the migration
addDriveSessionIdColumn();

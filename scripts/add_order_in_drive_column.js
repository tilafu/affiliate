/**
 * Script to add order_in_drive column to drive_orders table
 */
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load .env from project root

// Create a new pool using environment variables directly
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'affiliate',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432, // Default PostgreSQL port
});

async function applyMigration() {
  try {
    console.log('Starting migration: Adding order_in_drive column to drive_orders table');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../sql/add_order_in_drive_column.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL script
    await pool.query(sqlScript);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration
applyMigration();

/**
 * Script to add order_in_drive column to drive_orders table
 */
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Create a new pool with hardcoded credentials
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  database: 'affiliatedb', // Adjust this if your database name is different
  port: 5432,
});

async function applyMigration() {
  try {
    console.log('Starting migration: Adding drive_configuration_id column to drive_sessions table');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../sql/add_drive_configuration_id_to_drive_sessions.sql');
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

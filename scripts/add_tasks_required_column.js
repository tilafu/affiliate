#!/usr/bin/env node
/**
 * Script to run the add_tasks_required_to_drive_configs.sql migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../server/config/db.config');

const pool = new Pool(config);

async function runMigration() {
  try {
    console.log('Starting migration to add tasks_required to drive_configurations...');
    
    const sqlFilePath = path.join(__dirname, '../sql/add_tasks_required_to_drive_configs.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    await pool.query(sqlContent);
    
    console.log('Migration completed successfully.');
    
    // Verify the changes
    const { rows } = await pool.query('SELECT id, name, tasks_required FROM drive_configurations');
    
    console.log('\nUpdated drive_configurations:');
    console.table(rows);
    
  } catch (err) {
    console.error('Error running migration:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
  }
}

runMigration();

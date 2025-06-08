const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'affiliate_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

/**
 * Check the current structure of notification_categories table
 */
async function checkNotificationCategoriesStructure() {
  try {
    console.log('🔍 Checking notification_categories table structure...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'notification_categories' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ notification_categories table does not exist!');
      return false;
    }
    
    console.log('✅ notification_categories table structure:');
    console.table(result.rows);
    
    // Check if color and icon columns exist
    const columns = result.rows.map(row => row.column_name);
    const hasColor = columns.includes('color');
    const hasIcon = columns.includes('icon');
    
    console.log(`\n📊 Column Status:`);
    console.log(`   - color column: ${hasColor ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - icon column: ${hasIcon ? '✅ EXISTS' : '❌ MISSING'}`);
    
    return { hasColor, hasIcon, columns };
  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
    return false;
  }
}

/**
 * Add missing columns to notification_categories table
 */
async function addMissingColumns(missingColumns) {
  try {
    console.log('\n🔧 Adding missing columns...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (!missingColumns.hasColor) {
        console.log('   Adding color column...');
        await client.query(`
          ALTER TABLE notification_categories 
          ADD COLUMN color VARCHAR(7) DEFAULT '#007bff';
        `);
        console.log('   ✅ color column added');
      }
      
      if (!missingColumns.hasIcon) {
        console.log('   Adding icon column...');
        await client.query(`
          ALTER TABLE notification_categories 
          ADD COLUMN icon VARCHAR(50) DEFAULT 'fas fa-bell';
        `);
        console.log('   ✅ icon column added');
      }
      
      await client.query('COMMIT');
      console.log('✅ All missing columns added successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    throw error;
  }
}

/**
 * Create default notification categories if none exist
 */
async function createDefaultCategories() {
  try {
    console.log('\n📝 Checking for existing categories...');
    
    const countResult = await pool.query('SELECT COUNT(*) FROM notification_categories');
    const categoryCount = parseInt(countResult.rows[0].count);
    
    if (categoryCount > 0) {
      console.log(`✅ Found ${categoryCount} existing categories. Skipping default creation.`);
      return;
    }
    
    console.log('🔧 Creating default notification categories...');
    
    const defaultCategories = [
      { name: 'System', color: '#007bff', icon: 'fas fa-cog' },
      { name: 'Withdrawal', color: '#dc3545', icon: 'fas fa-money-bill-wave' },
      { name: 'Deposit', color: '#28a745', icon: 'fas fa-coins' },
      { name: 'General', color: '#6c757d', icon: 'fas fa-bell' },
      { name: 'Important', color: '#fd7e14', icon: 'fas fa-exclamation-triangle' },
      { name: 'Task', color: '#20c997', icon: 'fas fa-tasks' }
    ];
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const category of defaultCategories) {
        await client.query(
          'INSERT INTO notification_categories (name, color, icon, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [category.name, category.color, category.icon]
        );
        console.log(`   ✅ Created category: ${category.name}`);
      }
      
      await client.query('COMMIT');
      console.log('✅ All default categories created successfully!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error creating default categories:', error.message);
    throw error;
  }
}

/**
 * Test the fixed notification system
 */
async function testNotificationSystem() {
  try {
    console.log('\n🧪 Testing notification system...');
    
    // Test the query that was failing
    const result = await pool.query(`
      SELECT 
        gn.id,
        gn.title,
        gn.message,
        gn.priority,
        gn.image_url,
        gn.is_active,
        gn.start_date,
        gn.end_date,
        gn.created_at,
        nc.name as category_name,
        nc.color as category_color,
        nc.icon as category_icon
      FROM general_notifications gn
      LEFT JOIN notification_categories nc ON gn.category_id = nc.id
      WHERE gn.is_active = true
      AND (gn.start_date IS NULL OR gn.start_date <= NOW())
      AND (gn.end_date IS NULL OR gn.end_date >= NOW())
      ORDER BY gn.priority DESC, gn.created_at DESC
      LIMIT 10;
    `);
    
    console.log(`✅ Query executed successfully! Found ${result.rows.length} active general notifications.`);
    
    if (result.rows.length > 0) {
      console.log('📊 Sample notification data:');
      console.table(result.rows.slice(0, 3));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Main function to fix the notification database
 */
async function main() {
  console.log('🚀 Starting notification database fix...\n');
  
  try {
    // Step 1: Check current structure
    const structure = await checkNotificationCategoriesStructure();
    if (!structure) {
      console.log('❌ Cannot proceed without notification_categories table');
      process.exit(1);
    }
    
    // Step 2: Add missing columns if needed
    if (!structure.hasColor || !structure.hasIcon) {
      await addMissingColumns(structure);
    } else {
      console.log('✅ All required columns already exist!');
    }
    
    // Step 3: Create default categories if none exist
    await createDefaultCategories();
    
    // Step 4: Test the system
    await testNotificationSystem();
    
    console.log('\n🎉 Notification database fix completed successfully!');
    console.log('💡 You can now restart your server and the admin notifications should work.');
    
  } catch (error) {
    console.error('\n💥 Fix failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Additional utility functions
const utils = {
  /**
   * List all notification tables and their row counts
   */
  async listNotificationTables() {
    try {
      const tables = ['notification_categories', 'general_notifications', 'notifications', 'general_notification_reads'];
      
      console.log('\n📊 Notification Tables Overview:');
      
      for (const tableName of tables) {
        try {
          const result = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
          const count = result.rows[0].count;
          console.log(`   ${tableName}: ${count} rows`);
        } catch (error) {
          console.log(`   ${tableName}: ❌ Error - ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Error listing tables:', error.message);
    }
  },

  /**
   * Clear all notification data (use with caution!)
   */
  async clearNotificationData() {
    try {
      console.log('⚠️  Clearing all notification data...');
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM general_notification_reads');
        await client.query('DELETE FROM notifications');
        await client.query('DELETE FROM general_notifications');
        await client.query('DELETE FROM notification_categories');
        await client.query('COMMIT');
        
        console.log('✅ All notification data cleared!');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error clearing data:', error.message);
    }
  }
};

// Export functions for use in other scripts
module.exports = {
  main,
  checkNotificationCategoriesStructure,
  addMissingColumns,
  createDefaultCategories,
  testNotificationSystem,
  utils
};

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

const pool = require('./server/config/db');
const fs = require('fs');
const path = require('path');

async function runTierManagementMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting Tier Management Migration...');
          // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'tier_management_migration_fixed.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📖 Migration SQL loaded successfully');
        
        // Execute the migration
        await client.query('BEGIN');
        console.log('🔄 Running migration queries...');
        
        // Split the SQL into individual statements and execute them
        const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                console.log(`   Executing statement ${i + 1}/${statements.length}...`);
                await client.query(statement);
            }
        }
        
        await client.query('COMMIT');
        
        console.log('✅ Tier Management Migration completed successfully!');
        
        // Verify the migration by checking if new columns exist
        console.log('🔍 Verifying migration...');
        
        const verifyQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tier_quantity_configs' 
            ORDER BY ordinal_position;
        `;
        
        const result = await client.query(verifyQuery);
        
        console.log('📋 Current tier_quantity_configs table structure:');
        console.table(result.rows);
        
        // Check existing tiers
        const tiersQuery = `
            SELECT tier_name, quantity_limit, is_active 
            FROM tier_quantity_configs 
            ORDER BY tier_name;
        `;
        
        const tiersResult = await client.query(tiersQuery);
        
        if (tiersResult.rows.length > 0) {
            console.log('🎯 Existing tier configurations:');
            console.table(tiersResult.rows);
        } else {
            console.log('⚠️  No tier configurations found. You may need to create some through the admin panel.');
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Database connection closed');
    }
}

// Run the migration
if (require.main === module) {
    runTierManagementMigration()
        .then(() => {
            console.log('🎉 Migration script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = runTierManagementMigration;

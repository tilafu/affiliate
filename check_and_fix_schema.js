// Database Schema Checker and Query Fixer
// This script checks for missing columns and fixes queries that reference non-existent fields

const pool = require('./server/config/db');
const fs = require('fs');
const path = require('path');

async function checkDatabaseSchema() {
    const client = await pool.connect();
    try {
        console.log('=== Checking Database Schema ===\n');

        // Check tier_quantity_configs table structure
        console.log('1. Checking tier_quantity_configs table structure:');
        const tierConfigsResult = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tier_quantity_configs'
            ORDER BY ordinal_position;
        `);
        
        console.log('Current columns in tier_quantity_configs:');
        tierConfigsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });

        // Check membership_tiers table structure
        console.log('\n2. Checking membership_tiers table structure:');
        const membershipTiersResult = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'membership_tiers'
            ORDER BY ordinal_position;
        `);
        
        console.log('Current columns in membership_tiers:');
        membershipTiersResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });

        // Check what columns are referenced in queries but don't exist
        console.log('\n3. Checking for missing columns referenced in code:');
        
        const expectedTierConfigColumns = [
            'id', 'tier_name', 'quantity_limit', 'is_active', 'created_at', 'updated_at',
            'num_single_tasks', 'num_combo_tasks', 'min_price_single', 'max_price_single',
            'min_price_combo', 'max_price_combo', 'commission_rate', 'description'
        ];

        const actualTierConfigColumns = tierConfigsResult.rows.map(row => row.column_name);
        const missingTierConfigColumns = expectedTierConfigColumns.filter(col => !actualTierConfigColumns.includes(col));
        
        if (missingTierConfigColumns.length > 0) {
            console.log('Missing columns in tier_quantity_configs:');
            missingTierConfigColumns.forEach(col => console.log(`  - ${col}`));
        } else {
            console.log('✓ All expected columns exist in tier_quantity_configs');
        }

        // Check users table for tier column
        console.log('\n4. Checking users table for tier-related columns:');
        const usersResult = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name IN ('tier', 'tier_id', 'user_tier_id')
            ORDER BY column_name;
        `);
        
        console.log('Tier-related columns in users table:');
        usersResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        return {
            tierConfigColumns: actualTierConfigColumns,
            membershipTierColumns: membershipTiersResult.rows.map(row => row.column_name),
            missingTierConfigColumns
        };

    } catch (error) {
        console.error('Error checking database schema:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function fixMissingColumns() {
    const client = await pool.connect();
    try {
        console.log('\n=== Fixing Missing Columns ===\n');

        // Add missing columns to tier_quantity_configs if they don't exist
        const columnsToAdd = [
            'num_single_tasks INTEGER DEFAULT 40',
            'num_combo_tasks INTEGER DEFAULT 0',
            'min_price_single NUMERIC(10,2) DEFAULT 10.00',
            'max_price_single NUMERIC(10,2) DEFAULT 100.00',
            'min_price_combo NUMERIC(10,2) DEFAULT 50.00',
            'max_price_combo NUMERIC(10,2) DEFAULT 500.00',
            'commission_rate NUMERIC(5,2) DEFAULT 5.00',
            'description TEXT'
        ];

        for (const columnDef of columnsToAdd) {
            const columnName = columnDef.split(' ')[0];
            try {
                await client.query(`ALTER TABLE tier_quantity_configs ADD COLUMN IF NOT EXISTS ${columnDef}`);
                console.log(`✓ Added column: ${columnName}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`- Column ${columnName} already exists`);
                } else {
                    console.error(`✗ Failed to add column ${columnName}:`, error.message);
                }
            }
        }

        // Update existing records with default values based on tier
        console.log('\nUpdating existing records with default values...');
        await client.query(`
            UPDATE tier_quantity_configs SET 
                num_single_tasks = COALESCE(num_single_tasks, 
                    CASE 
                        WHEN LOWER(tier_name) = 'bronze' THEN 30
                        WHEN LOWER(tier_name) = 'silver' THEN 40
                        WHEN LOWER(tier_name) = 'gold' THEN 50
                        WHEN LOWER(tier_name) = 'platinum' THEN 60
                        ELSE 40
                    END),
                num_combo_tasks = COALESCE(num_combo_tasks, 0),
                min_price_single = COALESCE(min_price_single,
                    CASE 
                        WHEN LOWER(tier_name) = 'bronze' THEN 10.00
                        WHEN LOWER(tier_name) = 'silver' THEN 15.00
                        WHEN LOWER(tier_name) = 'gold' THEN 20.00
                        WHEN LOWER(tier_name) = 'platinum' THEN 25.00
                        ELSE 10.00
                    END),
                max_price_single = COALESCE(max_price_single,
                    CASE 
                        WHEN LOWER(tier_name) = 'bronze' THEN 80.00
                        WHEN LOWER(tier_name) = 'silver' THEN 120.00
                        WHEN LOWER(tier_name) = 'gold' THEN 180.00
                        WHEN LOWER(tier_name) = 'platinum' THEN 250.00
                        ELSE 100.00
                    END),
                min_price_combo = COALESCE(min_price_combo,
                    CASE 
                        WHEN LOWER(tier_name) = 'bronze' THEN 50.00
                        WHEN LOWER(tier_name) = 'silver' THEN 75.00
                        WHEN LOWER(tier_name) = 'gold' THEN 100.00
                        WHEN LOWER(tier_name) = 'platinum' THEN 150.00
                        ELSE 50.00
                    END),
                max_price_combo = COALESCE(max_price_combo,
                    CASE 
                        WHEN LOWER(tier_name) = 'bronze' THEN 300.00
                        WHEN LOWER(tier_name) = 'silver' THEN 450.00
                        WHEN LOWER(tier_name) = 'gold' THEN 600.00
                        WHEN LOWER(tier_name) = 'platinum' THEN 800.00
                        ELSE 500.00
                    END),
                commission_rate = COALESCE(commission_rate, 5.00),
                description = COALESCE(description, 
                    CASE 
                        WHEN LOWER(tier_name) = 'bronze' THEN 'Entry level tier with basic features'
                        WHEN LOWER(tier_name) = 'silver' THEN 'Intermediate tier with enhanced features'
                        WHEN LOWER(tier_name) = 'gold' THEN 'Advanced tier with premium features'
                        WHEN LOWER(tier_name) = 'platinum' THEN 'Ultimate tier with all features'
                        ELSE 'Custom tier configuration'
                    END)
            WHERE num_single_tasks IS NULL 
               OR min_price_single IS NULL 
               OR max_price_single IS NULL 
               OR min_price_combo IS NULL 
               OR max_price_combo IS NULL 
               OR commission_rate IS NULL 
               OR description IS NULL;
        `);
        console.log('✓ Updated existing records with default values');

    } catch (error) {
        console.error('Error fixing missing columns:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function validateQueries() {
    console.log('\n=== Validating Queries ===\n');

    // Test the queries used in tierManagementController
    const client = await pool.connect();
    try {
        // Test getTierConfigurations query
        console.log('Testing getTierConfigurations query...');
        const configResult = await client.query(`
            SELECT 
                id,
                tier_name,
                quantity_limit,
                num_single_tasks,
                num_combo_tasks,
                min_price_single,
                max_price_single,
                min_price_combo,
                max_price_combo,
                commission_rate,
                description,
                is_active,
                created_at,
                updated_at
            FROM tier_quantity_configs 
            ORDER BY 
                CASE LOWER(tier_name)
                    WHEN 'bronze' THEN 1
                    WHEN 'silver' THEN 2
                    WHEN 'gold' THEN 3
                    WHEN 'platinum' THEN 4
                    ELSE 5
                END
        `);
        console.log(`✓ getTierConfigurations query works - returned ${configResult.rows.length} rows`);

        // Test getTierStatistics query
        console.log('Testing getTierStatistics query...');
        const statsResult = await client.query(`
            SELECT 
                tqc.tier_name,
                tqc.is_active,
                COUNT(u.id) as user_count,
                COUNT(CASE WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d,
                AVG(a.balance) as avg_balance
            FROM tier_quantity_configs tqc
            LEFT JOIN users u ON LOWER(u.tier) = LOWER(tqc.tier_name)
            LEFT JOIN accounts a ON a.user_id = u.id AND a.type = 'main'
            GROUP BY tqc.tier_name, tqc.is_active
            ORDER BY 
                CASE LOWER(tqc.tier_name)
                    WHEN 'bronze' THEN 1
                    WHEN 'silver' THEN 2
                    WHEN 'gold' THEN 3
                    WHEN 'platinum' THEN 4
                    ELSE 5
                END
        `);
        console.log(`✓ getTierStatistics query works - returned ${statsResult.rows.length} rows`);

        // Display current tier data
        console.log('\nCurrent tier configurations:');
        configResult.rows.forEach(tier => {
            console.log(`  ${tier.tier_name}: ${tier.quantity_limit} limit, ${tier.num_single_tasks} single tasks, $${tier.min_price_single}-$${tier.max_price_single} price range`);
        });

    } catch (error) {
        console.error('Error validating queries:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    try {
        console.log('Starting database schema check and fix...\n');
        
        // Check current schema
        const schemaInfo = await checkDatabaseSchema();
        
        // Fix missing columns if any
        if (schemaInfo.missingTierConfigColumns.length > 0) {
            await fixMissingColumns();
        }
        
        // Validate that all queries work
        await validateQueries();
        
        console.log('\n=== Schema Check Complete ===');
        console.log('✓ All database schema issues have been resolved');
        console.log('✓ Tier management queries are working correctly');
        console.log('✓ Ready to use the tier management system');
        
    } catch (error) {
        console.error('\n✗ Schema check failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the script
main();

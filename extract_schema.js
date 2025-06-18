const fs = require('fs');
const path = require('path');
const pool = require('./server/config/db');

/**
 * Extract complete database schema and relationships
 */
async function extractDatabaseSchema() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Extracting database schema for affiliate_db...');
        
        const timestamp = new Date().toISOString();
        const schemaFile = 'affiliate_db_complete_schema.sql';
        const relationsFile = 'affiliate_db_relations.txt';
        
        let schemaContent = `-- Complete Database Schema for affiliate_db
-- Generated on: ${timestamp}
-- Database: ${process.env.DB_NAME}

`;
        
        let relationsContent = `Database Schema Analysis for affiliate_db
Generated on: ${timestamp}
Database: ${process.env.DB_NAME}

================================================================================
TABLE STRUCTURES AND RELATIONSHIPS
================================================================================

`;

        // 1. Get all tables
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        
        const tablesResult = await client.query(tablesQuery);
        console.log(`📋 Found ${tablesResult.rows.length} tables`);
        
        // 2. For each table, get detailed information
        for (const table of tablesResult.rows) {
            const tableName = table.table_name;
            console.log(`📊 Processing table: ${tableName}`);
            
            relationsContent += `\n--- TABLE: ${tableName.toUpperCase()} ---\n`;
            
            // Get column information
            const columnsQuery = `
                SELECT 
                    c.column_name,
                    c.data_type,
                    c.character_maximum_length,
                    c.numeric_precision,
                    c.numeric_scale,
                    c.is_nullable,
                    c.column_default,
                    c.ordinal_position
                FROM information_schema.columns c
                WHERE c.table_name = $1
                    AND c.table_schema = 'public'
                ORDER BY c.ordinal_position;
            `;
            
            const columnsResult = await client.query(columnsQuery, [tableName]);
            
            relationsContent += 'Columns:\n';
            for (const col of columnsResult.rows) {
                const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
                const precision = col.numeric_precision ? `(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})` : '';
                const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                
                relationsContent += `  ${col.ordinal_position}. ${col.column_name} - ${col.data_type}${length}${precision} ${nullable}${defaultVal}\n`;
            }
            
            // Get constraints
            const constraintsQuery = `
                SELECT 
                    tc.constraint_name,
                    tc.constraint_type,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints tc
                LEFT JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                LEFT JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.table_name = $1
                    AND tc.table_schema = 'public'
                ORDER BY tc.constraint_type, kcu.column_name;
            `;
            
            const constraintsResult = await client.query(constraintsQuery, [tableName]);
            
            if (constraintsResult.rows.length > 0) {
                relationsContent += '\nConstraints:\n';
                for (const constraint of constraintsResult.rows) {
                    if (constraint.constraint_type === 'FOREIGN KEY') {
                        relationsContent += `  FK: ${constraint.column_name} -> ${constraint.foreign_table_name}(${constraint.foreign_column_name})\n`;
                    } else if (constraint.constraint_type === 'PRIMARY KEY') {
                        relationsContent += `  PK: ${constraint.column_name}\n`;
                    } else if (constraint.constraint_type === 'UNIQUE') {
                        relationsContent += `  UNIQUE: ${constraint.column_name}\n`;
                    }
                }
            }
            
            // Get indexes
            const indexesQuery = `
                SELECT 
                    indexname,
                    indexdef
                FROM pg_indexes
                WHERE tablename = $1
                    AND schemaname = 'public'
                ORDER BY indexname;
            `;
            
            const indexesResult = await client.query(indexesQuery, [tableName]);
            
            if (indexesResult.rows.length > 0) {
                relationsContent += '\nIndexes:\n';
                for (const index of indexesResult.rows) {
                    relationsContent += `  ${index.indexname}: ${index.indexdef}\n`;
                }
            }
            
            relationsContent += '\n';
        }
        
        // 3. Get all foreign key relationships summary
        relationsContent += `\n================================================================================
FOREIGN KEY RELATIONSHIPS SUMMARY
================================================================================\n\n`;
        
        const fkQuery = `
            SELECT 
                tc.table_name as source_table,
                kcu.column_name as source_column,
                ccu.table_name AS target_table,
                ccu.column_name AS target_column,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name, kcu.column_name;
        `;
        
        const fkResult = await client.query(fkQuery);
        
        for (const fk of fkResult.rows) {
            relationsContent += `${fk.source_table}.${fk.source_column} -> ${fk.target_table}.${fk.target_column} (${fk.constraint_name})\n`;
        }
        
        // 4. Generate CREATE TABLE statements
        schemaContent += '-- CREATE TABLE statements\n\n';
        
        for (const table of tablesResult.rows) {
            const tableName = table.table_name;
            
            // Get table creation SQL (this is a simplified version)
            const createTableQuery = `
                SELECT 
                    'CREATE TABLE ' || table_name || ' (' || 
                    string_agg(
                        column_name || ' ' || 
                        CASE 
                            WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
                            WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
                            WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
                            WHEN data_type = 'integer' THEN 'INTEGER'
                            WHEN data_type = 'bigint' THEN 'BIGINT'
                            WHEN data_type = 'boolean' THEN 'BOOLEAN'
                            WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
                            WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
                            WHEN data_type = 'date' THEN 'DATE'
                            WHEN data_type = 'text' THEN 'TEXT'
                            WHEN data_type = 'uuid' THEN 'UUID'
                            ELSE UPPER(data_type)
                        END ||
                        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
                        ', ' ORDER BY ordinal_position
                    ) || ');' as create_statement
                FROM information_schema.columns
                WHERE table_name = $1
                    AND table_schema = 'public'
                GROUP BY table_name;
            `;
            
            const createResult = await client.query(createTableQuery, [tableName]);
            if (createResult.rows.length > 0) {
                schemaContent += `${createResult.rows[0].create_statement}\n\n`;
            }
        }
        
        // Write files
        fs.writeFileSync(schemaFile, schemaContent);
        fs.writeFileSync(relationsFile, relationsContent);
        
        console.log('✅ Schema extraction completed!');
        console.log(`📄 Files created:`);
        console.log(`   - ${schemaFile} (CREATE TABLE statements)`);
        console.log(`   - ${relationsFile} (Detailed relationships and structure)`);
        
        // Also update the existing affiliate_db_schema.sql if it exists
        if (fs.existsSync('affiliate_db_schema.sql')) {
            fs.writeFileSync('affiliate_db_schema.sql', schemaContent);
            console.log(`   - affiliate_db_schema.sql (Updated existing file)`);
        }
        
    } catch (error) {
        console.error('❌ Error extracting schema:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the extraction
if (require.main === module) {
    extractDatabaseSchema()
        .then(() => {
            console.log('🎉 Database schema extraction completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed to extract database schema:', error);
            process.exit(1);
        });
}

module.exports = { extractDatabaseSchema };

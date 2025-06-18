const pool = require('./server/config/db');

async function checkTableConstraints() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Checking tier_quantity_configs table constraints...');
        
        // Check constraints
        const constraintsQuery = `
            SELECT 
                conname as constraint_name,
                contype as constraint_type,
                pg_get_constraintdef(oid) as constraint_definition
            FROM pg_constraint 
            WHERE conrelid = 'tier_quantity_configs'::regclass;
        `;
        
        const constraintsResult = await client.query(constraintsQuery);
        
        if (constraintsResult.rows.length > 0) {
            console.log('📋 Current constraints on tier_quantity_configs:');
            console.table(constraintsResult.rows);
        } else {
            console.log('✅ No constraints found on tier_quantity_configs');
        }
        
        // Check current table structure
        const structureQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tier_quantity_configs' 
            ORDER BY ordinal_position;
        `;
        
        const structureResult = await client.query(structureQuery);
        console.log('📋 Current table structure:');
        console.table(structureResult.rows);
        
        // Check existing data
        const dataQuery = `
            SELECT * FROM tier_quantity_configs ORDER BY tier_name;
        `;
        
        const dataResult = await client.query(dataQuery);
        if (dataResult.rows.length > 0) {
            console.log('📋 Existing data:');
            console.table(dataResult.rows);
        } else {
            console.log('⚠️  No existing data in tier_quantity_configs');
        }
        
    } catch (error) {
        console.error('❌ Error checking constraints:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkTableConstraints();

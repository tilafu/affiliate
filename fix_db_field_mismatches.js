// Database Field Mismatch Fix Script
// This script fixes critical database field mismatches found in the codebase

const fs = require('fs');
const path = require('path');

const fixes = [
    {
        file: 'server/controllers/adminDriveController.js',
        fixes: [
            {
                description: 'Fix user_tier_id to tier field mismatch (line ~1519)',
                search: "SELECT id, user_tier_id FROM users WHERE id = $1",
                replace: "SELECT id, tier FROM users WHERE id = $1"
            },
            {
                description: 'Fix user_tier_id variable reference (line ~1523)',
                search: "const userTierId = user.rows[0].user_tier_id;",
                replace: "const userTier = user.rows[0].tier;"
            },
            {
                description: 'Fix user_tier_id to tier field mismatch (line ~1576)',
                search: "SELECT id, user_tier_id FROM users WHERE id = $1",
                replace: "SELECT id, tier FROM users WHERE id = $1"
            },
            {
                description: 'Fix user_tier_id variable reference (line ~1580)',
                search: "const userTierId = user.rows[0].user_tier_id;",
                replace: "const userTier = user.rows[0].tier;"
            },
            {
                description: 'Fix tier_quantity_configs query to use tier_name instead of tier_id',
                search: "SELECT min_price_single, max_price_single FROM tier_quantity_configs WHERE tier_id = $1",
                replace: "SELECT quantity_limit FROM tier_quantity_configs WHERE tier_name = $1"
            },
            {
                description: 'Fix tier_quantity_configs query references',
                search: "SELECT tqc.*, ut.name as tier_name FROM tier_quantity_configs tqc JOIN user_tiers ut ON tqc.tier_id = ut.id ORDER BY ut.id",
                replace: "SELECT * FROM tier_quantity_configs ORDER BY tier_name"
            },
            {
                description: 'Fix tier_quantity_configs UPDATE query',
                search: "WHERE tier_id = $7",
                replace: "WHERE tier_name = $7"
            }
        ]
    },
    {
        file: 'server/controllers/user.js',
        fixes: [
            {
                description: 'Remove mobile_number from SELECT query',
                search: "SELECT id, username, email, referral_code, tier, mobile_number, created_at FROM users WHERE id = $1",
                replace: "SELECT id, username, email, referral_code, tier, created_at FROM users WHERE id = $1"
            },
            {
                description: 'Remove mobile_number from UPDATE query',
                search: "UPDATE users SET mobile_number = $1 WHERE id = $2 RETURNING id, username, email, mobile_number, created_at, tier, referral_code",
                replace: "UPDATE users SET mobile_number = $1 WHERE id = $2 RETURNING id, username, email, created_at, tier, referral_code"
            }
        ]
    }
];

function applyFixes() {
    console.log('🔧 Starting database field mismatch fixes...\n');
    let totalFixes = 0;
    
    for (const fileFixGroup of fixes) {
        const filePath = fileFixGroup.file;
        const fullPath = path.resolve(filePath);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`❌ File not found: ${filePath}`);
            continue;
        }
        
        console.log(`📝 Processing: ${filePath}`);
        let content = fs.readFileSync(fullPath, 'utf8');
        let fileChanges = 0;
        
        for (const fix of fileFixGroup.fixes) {
            if (content.includes(fix.search)) {
                content = content.replace(new RegExp(fix.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.replace);
                fileChanges++;
                totalFixes++;
                console.log(`  ✅ ${fix.description}`);
            } else {
                console.log(`  ⚠️  Pattern not found: ${fix.description}`);
            }
        }
        
        if (fileChanges > 0) {
            // Create backup
            const backupPath = `${fullPath}.backup-${Date.now()}`;
            fs.copyFileSync(fullPath, backupPath);
            console.log(`  💾 Backup created: ${backupPath}`);
            
            // Write fixed content
            fs.writeFileSync(fullPath, content);
            console.log(`  📁 Applied ${fileChanges} fixes to ${filePath}`);
        }
        
        console.log('');
    }
    
    console.log(`🎉 Completed! Applied ${totalFixes} fixes total.`);
    
    if (totalFixes > 0) {
        console.log('\n📋 Next steps:');
        console.log('1. Review the changes in the modified files');
        console.log('2. Test the application functionality');
        console.log('3. Consider adding missing database columns if needed:');
        console.log('   - Add mobile_number to users table if mobile functionality is required');
        console.log('   - Add pricing columns to tier_quantity_configs if needed');
        console.log('4. Restart your application servers');
    }
}

// Also create SQL script to add missing columns if needed
function createMigrationSQL() {
    const sqlContent = `-- Database Migration: Add missing columns
-- Generated: ${new Date().toISOString()}
-- Run these queries if you need the missing functionality

-- Add mobile_number to users table (if mobile functionality is needed)
ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20);

-- Add pricing columns to tier_quantity_configs (if pricing functionality is needed)
ALTER TABLE tier_quantity_configs ADD COLUMN min_price_single NUMERIC(10,2);
ALTER TABLE tier_quantity_configs ADD COLUMN max_price_single NUMERIC(10,2);

-- Create user_tiers table (if separate tier management is needed)
CREATE TABLE user_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tiers
INSERT INTO user_tiers (name, description) VALUES 
('bronze', 'Bronze tier - basic level'),
('silver', 'Silver tier - intermediate level'),
('gold', 'Gold tier - advanced level'),
('platinum', 'Platinum tier - premium level');

-- Update tier_quantity_configs to reference user_tiers (if needed)
-- Note: This would require data migration and is optional
-- ALTER TABLE tier_quantity_configs ADD COLUMN tier_id INTEGER REFERENCES user_tiers(id);
`;
    
    fs.writeFileSync('database_migration_optional.sql', sqlContent);
    console.log('📄 Created optional migration SQL file: database_migration_optional.sql');
}

if (require.main === module) {
    applyFixes();
    createMigrationSQL();
}

module.exports = { applyFixes, createMigrationSQL };

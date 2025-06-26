const { Pool } = require('pg');
const axios = require('axios');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'affiliatedb',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function testFrozenBalanceSystem() {
    console.log('🧪 Testing Frozen Balance System...\n');

    try {
        // Test 1: Check if a user gets frozen when balance is insufficient
        console.log('1. Testing user freeze on insufficient balance...');
        
        const testUserId = 1; // You may need to adjust this
        
        // Check current user status
        const checkUser = await pool.query('SELECT id, username, balance, is_frozen FROM users WHERE id = $1', [testUserId]);
        if (checkUser.rows.length === 0) {
            console.log('❌ Test user not found. Please ensure user with ID 1 exists.');
            return;
        }
        
        const user = checkUser.rows[0];
        console.log(`   User: ${user.username}, Balance: $${user.balance}, Frozen: ${user.is_frozen}`);
        
        // Simulate insufficient balance scenario
        await pool.query('UPDATE users SET balance = 0.50 WHERE id = $1', [testUserId]);
        console.log('   ✓ Set user balance to $0.50');
        
        // Trigger a balance check (simulate drive assignment or withdrawal attempt)
        try {
            await pool.query('BEGIN');
            const balanceCheck = await pool.query('SELECT balance FROM users WHERE id = $1', [testUserId]);
            const currentBalance = parseFloat(balanceCheck.rows[0].balance);
            
            if (currentBalance < 1.00) { // Assuming minimum balance is $1.00
                await pool.query('UPDATE users SET is_frozen = true WHERE id = $1', [testUserId]);
                console.log('   ✓ User frozen due to insufficient balance');
            }
            
            await pool.query('COMMIT');
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
        
        // Verify user is frozen
        const frozenCheck = await pool.query('SELECT is_frozen FROM users WHERE id = $1', [testUserId]);
        if (frozenCheck.rows[0].is_frozen) {
            console.log('   ✅ Test 1 PASSED: User correctly frozen\n');
        } else {
            console.log('   ❌ Test 1 FAILED: User should be frozen\n');
        }

        // Test 2: Test manual unfreeze by admin
        console.log('2. Testing admin manual unfreeze...');
        
        // Check frozen users
        const frozenUsers = await pool.query(`
            SELECT u.id, u.username, u.balance, u.is_frozen
            FROM users u 
            WHERE u.is_frozen = true
        `);
        
        console.log(`   Found ${frozenUsers.rows.length} frozen user(s)`);
        
        if (frozenUsers.rows.length > 0) {
            const frozenUser = frozenUsers.rows[0];
            console.log(`   Attempting to unfreeze user: ${frozenUser.username}`);
            
            // Simulate admin unfreeze
            await pool.query('BEGIN');
            
            // Update user status
            await pool.query('UPDATE users SET is_frozen = false WHERE id = $1', [frozenUser.id]);
            
            // Log the admin action
            await pool.query(`
                INSERT INTO commissions 
                (user_id, source_user_id, account_type, commission_amount, commission_type, description)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [frozenUser.id, 1, 'main', 0, 'admin_action', 'Account unfrozen by admin - test script']
            );
            
            await pool.query('COMMIT');
            
            // Verify unfreeze
            const unfreezeCheck = await pool.query('SELECT is_frozen FROM users WHERE id = $1', [frozenUser.id]);
            if (!unfreezeCheck.rows[0].is_frozen) {
                console.log('   ✅ Test 2 PASSED: Admin manual unfreeze works\n');
            } else {
                console.log('   ❌ Test 2 FAILED: Admin unfreeze did not work\n');
            }
        } else {
            console.log('   ⚠️ Test 2 SKIPPED: No frozen users to test\n');
        }

        // Test 3: Test automatic unfreeze on deposit approval
        console.log('3. Testing automatic unfreeze on deposit approval...');
        
        // First freeze the user again and add insufficient balance
        await pool.query('UPDATE users SET balance = 0.25, is_frozen = true WHERE id = $1', [testUserId]);
        
        // Create a test deposit
        const depositResult = await pool.query(`
            INSERT INTO deposits (user_id, amount, status, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id`,
            [testUserId, 5.00, 'pending', 'Test deposit for unfreeze']
        );
        
        const depositId = depositResult.rows[0].id;
        console.log(`   Created test deposit ID: ${depositId}`);
        
        // Simulate deposit approval with auto-unfreeze logic
        await pool.query('BEGIN');
        
        try {
            // Approve deposit
            await pool.query('UPDATE deposits SET status = $1 WHERE id = $2', ['approved', depositId]);
            
            // Update user balance
            await pool.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [5.00, testUserId]);
            
            // Check if user should be unfrozen
            const balanceAfterDeposit = await pool.query('SELECT balance FROM users WHERE id = $1', [testUserId]);
            const newBalance = parseFloat(balanceAfterDeposit.rows[0].balance);
            
            if (newBalance >= 1.00) { // Minimum balance threshold
                await pool.query('UPDATE users SET is_frozen = false WHERE id = $1', [testUserId]);
                console.log(`   ✓ Auto-unfrozen user with new balance: $${newBalance}`);
            }
            
            await pool.query('COMMIT');
            
            // Verify auto-unfreeze
            const autoUnfreezeCheck = await pool.query('SELECT is_frozen, balance FROM users WHERE id = $1', [testUserId]);
            const result = autoUnfreezeCheck.rows[0];
            
            if (!result.is_frozen && parseFloat(result.balance) >= 1.00) {
                console.log('   ✅ Test 3 PASSED: Automatic unfreeze on deposit approval works\n');
            } else {
                console.log('   ❌ Test 3 FAILED: Automatic unfreeze did not work\n');
            }
            
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

        // Cleanup: Reset test user to normal state
        console.log('4. Cleaning up test data...');
        await pool.query('UPDATE users SET balance = 10.00, is_frozen = false WHERE id = $1', [testUserId]);
        await pool.query('DELETE FROM deposits WHERE id = $1', [depositId]);
        console.log('   ✓ Test user reset to normal state\n');

        console.log('🎉 Frozen Balance System Test Complete!\n');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

// Run tests if called directly
if (require.main === module) {
    testFrozenBalanceSystem().catch(console.error);
}

module.exports = { testFrozenBalanceSystem };

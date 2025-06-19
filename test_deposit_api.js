const pool = require('./server/config/db');

async function testDepositEndpoints() {
  try {
    console.log('Testing deposit API endpoints...\n');
    
    // Test database connection
    const client = await pool.connect();
    console.log('✓ Database connected successfully');
    
    // Get a sample user
    const userQuery = await client.query('SELECT id, username FROM users LIMIT 1');
    if (userQuery.rows.length === 0) {
      console.log('✗ No users found in database');
      client.release();
      return;
    }
    
    const userId = userQuery.rows[0].id;
    const username = userQuery.rows[0].username;
    console.log(`✓ Testing with user: ${username} (ID: ${userId})\n`);
    
    // Test getUserTotalDeposits logic
    console.log('Testing getUserTotalDeposits query...');
    const totalQuery = `
      SELECT 
          COALESCE(
              (SELECT SUM(amount) FROM deposits WHERE user_id = $1 AND status = 'completed') + 
              (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_logs WHERE user_id = $1 AND commission_type = 'admin_deposit'),
              0
          ) AS total_deposits
    `;
    const totalResult = await client.query(totalQuery, [userId]);
    const totalDeposits = totalResult.rows[0].total_deposits;
    console.log(`✓ Total deposits for user ${userId}: $${totalDeposits}`);
    
    // Test getUserDeposits logic
    console.log('\nTesting getUserDeposits query...');
    const depositsQuery = `
      SELECT 
        id, 
        amount, 
        status, 
        created_at AS date, 
        description, 
        txn_hash,
        'deposit' as type,
        NULL as admin_note
      FROM deposits
      WHERE user_id = $1
      
      UNION ALL
      
      SELECT 
        id,
        commission_amount as amount,
        'completed' as status,
        created_at AS date,
        description,
        NULL as txn_hash,
        'admin_adjustment' as type,
        description as admin_note
      FROM commission_logs
      WHERE user_id = $1 AND commission_type = 'admin_deposit'
      
      ORDER BY date DESC
    `;
    
    const depositsResult = await client.query(depositsQuery, [userId]);
    console.log(`✓ Found ${depositsResult.rows.length} deposit records for user ${userId}:`);
    
    depositsResult.rows.forEach((deposit, index) => {
      console.log(`  ${index + 1}. ${deposit.type}: $${deposit.amount} - ${deposit.status} - ${deposit.date}`);
    });
    
    // Check what's actually in the deposits table
    console.log('\nChecking deposits table contents...');
    const allDeposits = await client.query('SELECT * FROM deposits LIMIT 5');
    console.log(`Total deposits in table: ${allDeposits.rows.length}`);
    allDeposits.rows.forEach((deposit, index) => {
      console.log(`  ${index + 1}. User ${deposit.user_id}: $${deposit.amount} - ${deposit.status} - ${deposit.created_at}`);
    });
    
    // Check commission_logs for admin_deposit type
    console.log('\nChecking commission_logs for admin_deposit...');
    const adminDeposits = await client.query('SELECT * FROM commission_logs WHERE commission_type = $1 LIMIT 5', ['admin_deposit']);
    console.log(`Admin deposits in commission_logs: ${adminDeposits.rows.length}`);
    adminDeposits.rows.forEach((deposit, index) => {
      console.log(`  ${index + 1}. User ${deposit.user_id}: $${deposit.commission_amount} - ${deposit.description} - ${deposit.created_at}`);
    });
    
    client.release();
    console.log('\n✓ Test completed successfully');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  }
  
  process.exit(0);
}

testDepositEndpoints();

const pool = require('./server/config/db');

async function checkUserData() {
  console.log('Starting debug script...');
  try {
    const userId = 2;
    
    console.log('Connecting to database...');
    // Check drive session
    const sessionResult = await pool.query(`
      SELECT ds.id, ds.status, ds.current_user_active_drive_item_id, dc.tasks_required
      FROM drive_sessions ds
      JOIN drive_configurations dc ON ds.drive_configuration_id = dc.id
      WHERE ds.user_id = $1 AND ds.status IN ('active', 'pending_reset', 'frozen')
      ORDER BY ds.started_at DESC LIMIT 1
    `, [userId]);
    
    console.log('Drive Session:', JSON.stringify(sessionResult.rows[0], null, 2));
    
    if (sessionResult.rows.length > 0) {
      const session = sessionResult.rows[0];
      
      // Check current active drive item
      const itemResult = await pool.query(`
        SELECT uadi.*,
               p1.name as p1_name, p1.price as p1_price,
               p2.name as p2_name, p2.price as p2_price,
               p3.name as p3_name, p3.price as p3_price
        FROM user_active_drive_items uadi
        LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
        LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
        LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
        WHERE uadi.id = $1
      `, [session.current_user_active_drive_item_id]);
      
      console.log('Current Active Item:', JSON.stringify(itemResult.rows[0], null, 2));
      
      // Check upcoming items in the drive
      const upcomingResult = await pool.query(`
        SELECT uadi.*,
               p1.name as p1_name, p1.price as p1_price,
               p2.name as p2_name, p2.price as p2_price,
               p3.name as p3_name, p3.price as p3_price
        FROM user_active_drive_items uadi
        LEFT JOIN products p1 ON uadi.product_id_1 = p1.id
        LEFT JOIN products p2 ON uadi.product_id_2 = p2.id
        LEFT JOIN products p3 ON uadi.product_id_3 = p3.id
        WHERE uadi.drive_session_id = $1 AND uadi.user_status IN ('CURRENT', 'PENDING')
        ORDER BY uadi.order_in_drive ASC LIMIT 10
      `, [session.id]);
        console.log('Upcoming Items:');
      console.log(`Found ${upcomingResult.rows.length} upcoming items`);
      upcomingResult.rows.forEach((item, index) => {
        console.log(`${index + 1}. Order ${item.order_in_drive}: ${item.task_type} - Status: ${item.user_status}`);
        if (item.p1_name) console.log(`   Product 1: ${item.p1_name} ($${item.p1_price})`);
        if (item.p2_name) console.log(`   Product 2: ${item.p2_name} ($${item.p2_price})`);
        if (item.p3_name) console.log(`   Product 3: ${item.p3_name} ($${item.p3_price})`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserData();

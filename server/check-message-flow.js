/**
 * Message Flow Analyzer
 * Shows how messages are stored and routed in the current system
 */

const db = require('./db');

async function main() {
  try {
    console.log('=== MESSAGE FLOW ANALYSIS ===\n');
    
    // Check message count by type
    const messageStats = await db.query(`
      SELECT 
        CASE 
          WHEN user_id IS NOT NULL THEN 'real_user'
          WHEN fake_user_id IS NOT NULL THEN 'fake_user'
          ELSE 'unknown'
        END as sender_type,
        COUNT(*) as message_count
      FROM chat_messages 
      GROUP BY sender_type
    `);
    
    console.log('MESSAGE BREAKDOWN BY SENDER TYPE:');
    messageStats.rows.forEach(row => {
      console.log(`  ${row.sender_type}: ${row.message_count} messages`);
    });
    
    console.log('\n');
    
    // Check recent messages with sender details
    const recentMessages = await db.query(`
      SELECT 
        cm.id,
        cm.group_id,
        cm.content,
        cm.created_at,
        CASE 
          WHEN cm.user_id IS NOT NULL THEN 'real_user'
          WHEN cm.fake_user_id IS NOT NULL THEN 'fake_user'
          ELSE 'unknown'
        END as sender_type,
        COALESCE(u.username, cfu.display_name, 'Unknown') as sender_name,
        cg.name as group_name
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      LEFT JOIN chat_fake_users cfu ON cm.fake_user_id = cfu.id
      LEFT JOIN chat_groups cg ON cm.group_id = cg.id
      ORDER BY cm.created_at DESC
      LIMIT 10
    `);
    
    console.log('RECENT MESSAGES (Last 10):');
    recentMessages.rows.forEach(msg => {
      console.log(`  [${msg.created_at}] ${msg.sender_name} (${msg.sender_type}) in "${msg.group_name}": ${msg.content.substring(0, 50)}...`);
    });
    
    console.log('\n');
    
    // Check group activity
    const groupActivity = await db.query(`
      SELECT 
        cg.id,
        cg.name,
        cg.is_personal_group,
        COUNT(cm.id) as message_count,
        MAX(cm.created_at) as last_activity
      FROM chat_groups cg
      LEFT JOIN chat_messages cm ON cg.id = cm.group_id
      GROUP BY cg.id, cg.name, cg.is_personal_group
      ORDER BY message_count DESC
    `);
    
    console.log('GROUP ACTIVITY:');
    groupActivity.rows.forEach(group => {
      console.log(`  "${group.name}" (${group.is_personal_group ? 'Personal' : 'Public'}): ${group.message_count} messages, last: ${group.last_activity || 'Never'}`);
    });
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

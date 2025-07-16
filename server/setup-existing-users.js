/**
 * Setup Groups for Existing Users
 * One-time script to create personal groups for users who registered before the auto-group feature
 */

const db = require('../db');
const { setupNewUser } = require('../services/user-group-service');

async function setupGroupsForExistingUsers() {
  try {
    console.log('🔄 Setting up groups for existing users...\n');

    // Get all users who don't have a personal group
    const usersWithoutGroups = await db.query(`
      SELECT u.id, u.username 
      FROM users u 
      LEFT JOIN chat_groups cg ON cg.owner_user_id = u.id AND cg.is_personal_group = true
      WHERE cg.id IS NULL AND u.role = 'user'
      ORDER BY u.created_at ASC
    `);

    console.log(`Found ${usersWithoutGroups.rows.length} users without personal groups:`);
    
    for (const user of usersWithoutGroups.rows) {
      console.log(`- ${user.username} (ID: ${user.id})`);
    }
    
    console.log('\n🚀 Creating groups...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutGroups.rows) {
      try {
        console.log(`⚙️  Setting up groups for ${user.username}...`);
        
        const result = await setupNewUser(user.id, user.username);
        
        console.log(`✅ SUCCESS: ${user.username}`);
        console.log(`   - Personal group: ${result.personalGroup.name}`);
        console.log(`   - Fake users added: ${result.fakeUsersAdded}`);
        console.log(`   - Common groups joined: ${result.commonGroupsJoined}\n`);
        
        successCount++;
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ ERROR setting up groups for ${user.username}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`✅ Successfully set up: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    
    if (successCount > 0) {
      console.log('\n🎉 Group setup completed! Users can now access their personal groups in the chat.');
    }

  } catch (error) {
    console.error('💥 Fatal error during group setup:', error);
  }
}

/**
 * Setup groups for a specific user by username
 */
async function setupGroupsForUser(username) {
  try {
    console.log(`🔄 Setting up groups for user: ${username}`);

    // Find the user
    const userResult = await db.query(`
      SELECT id, username FROM users WHERE username = $1 AND role = 'user'
    `, [username]);

    if (userResult.rows.length === 0) {
      console.log(`❌ User '${username}' not found or is not a regular user`);
      return;
    }

    const user = userResult.rows[0];

    // Check if user already has a personal group
    const existingGroup = await db.query(`
      SELECT id, name FROM chat_groups 
      WHERE owner_user_id = $1 AND is_personal_group = true
    `, [user.id]);

    if (existingGroup.rows.length > 0) {
      console.log(`ℹ️  User '${username}' already has a personal group: ${existingGroup.rows[0].name}`);
      return;
    }

    // Setup groups
    const result = await setupNewUser(user.id, user.username);
    
    console.log(`✅ SUCCESS: Groups set up for ${user.username}`);
    console.log(`   - Personal group: ${result.personalGroup.name}`);
    console.log(`   - Fake users added: ${result.fakeUsersAdded}`);
    console.log(`   - Common groups joined: ${result.commonGroupsJoined}`);

  } catch (error) {
    console.error(`❌ Error setting up groups for ${username}:`, error);
  }
}

/**
 * Check group status for a user
 */
async function checkUserGroupStatus(username) {
  try {
    const userResult = await db.query(`
      SELECT id, username FROM users WHERE username = $1
    `, [username]);

    if (userResult.rows.length === 0) {
      console.log(`❌ User '${username}' not found`);
      return;
    }

    const user = userResult.rows[0];

    // Get user's groups
    const groupsResult = await db.query(`
      SELECT 
        cg.id,
        cg.name,
        cg.is_personal_group,
        cg.is_public,
        cgm.role,
        (SELECT COUNT(*) FROM chat_group_members WHERE group_id = cg.id) as member_count
      FROM chat_groups cg
      JOIN chat_group_members cgm ON cgm.group_id = cg.id
      WHERE cgm.user_id = $1
      ORDER BY cg.is_personal_group DESC, cg.name ASC
    `, [user.id]);

    console.log(`\n📋 Group status for ${user.username}:`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Total groups: ${groupsResult.rows.length}`);

    if (groupsResult.rows.length === 0) {
      console.log(`   ❌ No groups found - user needs group setup!`);
    } else {
      groupsResult.rows.forEach(group => {
        const type = group.is_personal_group ? '👤 Personal' : '🌐 Public';
        console.log(`   ${type}: ${group.name} (${group.member_count} members, role: ${group.role})`);
      });
    }

  } catch (error) {
    console.error(`❌ Error checking group status:`, error);
  }
}

// If this script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Setup all existing users
    setupGroupsForExistingUsers().then(() => {
      console.log('\n✨ Script completed. You can now close this process.');
      process.exit(0);
    });
  } else if (args[0] === 'check' && args[1]) {
    // Check specific user
    checkUserGroupStatus(args[1]).then(() => {
      process.exit(0);
    });
  } else if (args[0] === 'setup' && args[1]) {
    // Setup specific user
    setupGroupsForUser(args[1]).then(() => {
      process.exit(0);
    });
  } else {
    console.log('Usage:');
    console.log('  node setup-existing-users.js                 # Setup all users');
    console.log('  node setup-existing-users.js check <username> # Check user status');
    console.log('  node setup-existing-users.js setup <username> # Setup specific user');
    process.exit(1);
  }
}

module.exports = {
  setupGroupsForExistingUsers,
  setupGroupsForUser,
  checkUserGroupStatus
};

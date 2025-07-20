/**
 * User Group Service
 * Handles automatic group creation for new users and manages user group associations
 */

const db = require('../db');

/**
 * Create a personal group for a new user with fake users
 */
const createUserGroup = async (userId, username) => {
  let client;
  
  try {
    // Use db.query for simpler connection management
    // First check if user already has a personal group
    const existingGroupCheck = await db.query(`
      SELECT id, name FROM chat_groups 
      WHERE owner_user_id = $1 AND is_personal_group = true
    `, [userId]);

    if (existingGroupCheck.rows.length > 0) {
      console.log(`User ${username} already has a personal group: ${existingGroupCheck.rows[0].name}`);
      return {
        group: existingGroupCheck.rows[0],
        fakeUsersAdded: 0,
        message: 'Group already exists'
      };
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Create the user's personal group
    const groupName = `${username}'s Community`;
    const groupDescription = `Welcome to ${username}'s personal community space! Connect and chat with other members.`;
    
    const groupResult = await client.query(`
      INSERT INTO chat_groups (name, description, created_by, is_personal_group, owner_user_id)
      VALUES ($1, $2, $3, true, $4)
      RETURNING id, name, description, created_at
    `, [groupName, groupDescription, userId, userId]);
    
    const group = groupResult.rows[0];

    // Add the user to their own group
    await client.query(`
      INSERT INTO chat_group_members (group_id, user_id, join_date, role)
      VALUES ($1, $2, NOW(), 'owner')
    `, [group.id, userId]);

    // Get approximately 20 fake users to add to the group
    const fakeUsersResult = await client.query(`
      SELECT id, username, display_name
      FROM chat_fake_users
      ORDER BY RANDOM()
      LIMIT 20
    `);

    // Add fake users to the group
    for (const fakeUser of fakeUsersResult.rows) {
      await client.query(`
        INSERT INTO chat_group_members (group_id, fake_user_id, join_date, role)
        VALUES ($1, $2, NOW(), 'member')
      `, [group.id, fakeUser.id]);
    }

    // Update user record to store their personal group (if column exists)
    try {
      await client.query(`
        UPDATE users 
        SET personal_group_id = $1
        WHERE id = $2
      `, [group.id, userId]);
    } catch (updateError) {
      // Column might not exist yet, but that's okay
      console.log('Note: Could not update user personal_group_id (column may not exist yet)');
    }

    await client.query('COMMIT');

    console.log(`Created personal group "${groupName}" for user ${username} with ${fakeUsersResult.rows.length} fake users`);
    
    return {
      group,
      fakeUsersAdded: fakeUsersResult.rows.length
    };

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error creating user group:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Add user to common/public groups
 */
const addUserToCommonGroups = async (userId) => {
  try {
    // Find public groups that new users should automatically join
    const commonGroupsResult = await db.query(`
      SELECT id, name
      FROM chat_groups
      WHERE is_public = true AND is_personal_group = false
      ORDER BY created_at ASC
    `);

    for (const group of commonGroupsResult.rows) {
      // Check if user is not already in the group
      const existingMember = await db.query(`
        SELECT 1 FROM chat_group_members
        WHERE group_id = $1 AND user_id = $2
      `, [group.id, userId]);

      if (existingMember.rows.length === 0) {
        await db.query(`
          INSERT INTO chat_group_members (group_id, user_id, join_date, role)
          VALUES ($1, $2, NOW(), 'member')
        `, [group.id, userId]);
        
        console.log(`Added user ${userId} to common group: ${group.name}`);
      }
    }

    return commonGroupsResult.rows;
  } catch (error) {
    console.error('Error adding user to common groups:', error);
    throw error;
  }
};

/**
 * Get groups that a user has access to
 */
const getUserGroups = async (userId) => {
  try {
    const query = `
      SELECT 
        cg.id,
        cg.name,
        cg.description,
        cg.is_personal_group,
        cg.is_support_group,
        cg.is_public,
        cg.owner_user_id as creator_id,
        COALESCE(
          u.avatar_url, 
          u.profile_image_url, 
          u.profile_image,
          '/assets/uploads/user.jpg'
        ) as creator_avatar_url,
        cgm.role,
        cgm.join_date,
        (SELECT COUNT(*) FROM chat_group_members WHERE group_id = cg.id) as member_count,
        (SELECT COUNT(*) FROM chat_messages WHERE group_id = cg.id) as message_count,
        (SELECT MAX(created_at) FROM chat_messages WHERE group_id = cg.id) as last_activity
      FROM chat_groups cg
      JOIN chat_group_members cgm ON cgm.group_id = cg.id
      LEFT JOIN users u ON u.id = cg.owner_user_id
      WHERE cgm.user_id = $1
      ORDER BY 
        cg.is_personal_group DESC,
        cg.is_support_group DESC,
        last_activity DESC NULLS LAST,
        cg.created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting user groups:', error);
    throw error;
  }
};

/**
 * Complete user setup (called after registration)
 */
const setupNewUser = async (userId, username) => {
  try {
    console.log(`Setting up new user: ${username} (ID: ${userId})`);
    
    // Create personal group with fake users
    const personalGroupResult = await createUserGroup(userId, username);
    
    // Add to common groups
    const commonGroups = await addUserToCommonGroups(userId);
    
    return {
      personalGroup: personalGroupResult.group,
      fakeUsersAdded: personalGroupResult.fakeUsersAdded,
      commonGroupsJoined: commonGroups.length
    };
  } catch (error) {
    console.error('Error setting up new user:', error);
    throw error;
  }
};

module.exports = {
  createUserGroup,
  addUserToCommonGroups,
  getUserGroups,
  setupNewUser
};

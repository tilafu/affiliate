/**
 * Admin Chat Model
 * Handles database operations for admin chat management
 */

const db = require('../db'); // Database connection module

/**
 * Get chat groups with pagination and search
 */
const getGroups = async ({ limit, offset, search }) => {
  let query = `
    SELECT 
      cg.id, 
      cg.name, 
      cg.description,
      cg.created_at,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id) AS member_count,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = cg.id) AS message_count,
      (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = cg.id) AS last_activity
    FROM 
      chat_groups cg
  `;
  
  const values = [];
  
  if (search) {
    query += ` WHERE cg.name ILIKE $1 OR cg.description ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  query += ` ORDER BY cg.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count total groups matching search criteria
 */
const getGroupsCount = async (search) => {
  let query = 'SELECT COUNT(*) FROM chat_groups';
  const values = [];
  
  if (search) {
    query += ` WHERE name ILIKE $1 OR description ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  const result = await db.query(query, values);
  // Safe access with fallback
  return result.rows && result.rows.length > 0 ? parseInt(result.rows[0].count) : 0;
};

/**
 * Get a specific group by ID with safe access
 */
const getGroupById = async (groupId) => {
  if (!groupId || isNaN(parseInt(groupId))) {
    throw new Error(`INVALID_GROUP_ID: Group ID must be a valid integer, received: ${groupId}`);
  }
  
  const query = `
    SELECT 
      cg.id, 
      cg.name, 
      cg.description,
      cg.created_at,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id) AS member_count,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id AND cgm.user_id IS NOT NULL) AS real_user_count,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id AND cgm.fake_user_id IS NOT NULL) AS fake_user_count,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = cg.id) AS message_count,
      (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = cg.id) AS last_activity
    FROM 
      chat_groups cg
    WHERE 
      cg.id = $1
  `;
  
  const result = await db.query(query, [parseInt(groupId)]);
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Check if a group exists with safe access
 */
const groupExists = async (groupId) => {
  if (!groupId || isNaN(parseInt(groupId))) {
    return false;
  }
  
  const query = 'SELECT EXISTS(SELECT 1 FROM chat_groups WHERE id = $1)';
  const result = await db.query(query, [parseInt(groupId)]);
  return result.rows && result.rows.length > 0 ? result.rows[0].exists : false;
};

/**
 * Get users in a group with pagination
 */
const getUsersInGroup = async (groupId, userType, { limit, offset }) => {
  let query;
  const values = [groupId];
  
  if (userType === 'fake_user') {
    query = `
      SELECT 
        cfu.id, 
        cfu.username, 
        cfu.display_name,
        cfu.avatar_url,
        cfu.created_at,
        cgm.join_date as joined_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.fake_user_id = cfu.id) AS message_count,
        (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.fake_user_id = cfu.id) AS last_message_at
      FROM 
        chat_fake_users cfu
      JOIN 
        chat_group_members cgm ON cgm.fake_user_id = cfu.id
      WHERE 
        cgm.group_id = $1
      ORDER BY 
        cgm.join_date DESC
      LIMIT $2 OFFSET $3
    `;
    values.push(limit, offset);
  } else if (userType === 'real_user') {
    query = `
      SELECT 
        u.id, 
        u.username, 
        u.email,
        u.created_at,
        cgm.join_date as joined_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = u.id) AS message_count,
        (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = u.id) AS last_message_at
      FROM 
        users u
      JOIN 
        chat_group_members cgm ON cgm.user_id = u.id
      WHERE 
        cgm.group_id = $1
      ORDER BY 
        cgm.join_date DESC
      LIMIT $2 OFFSET $3
    `;
    values.push(limit, offset);
  } else {
    // Combined query for both real and fake users
    query = `
      SELECT 
        'real_user' as user_type,
        u.id,
        u.username,
        u.email,
        cgm.join_date as joined_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = u.id) AS message_count
      FROM 
        users u
      JOIN 
        chat_group_members cgm ON cgm.user_id = u.id
      WHERE 
        cgm.group_id = $1 AND cgm.user_id IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'fake_user' as user_type,
        cfu.id,
        cfu.username,
        cfu.display_name as email,
        cgm.join_date as joined_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.fake_user_id = cfu.id) AS message_count
      FROM 
        chat_fake_users cfu
      JOIN 
        chat_group_members cgm ON cgm.fake_user_id = cfu.id
      WHERE 
        cgm.group_id = $1 AND cgm.fake_user_id IS NOT NULL
      
      ORDER BY 
        joined_at DESC
      LIMIT $2 OFFSET $3
    `;
    values.push(limit, offset);
  }
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count users in a group with safe access
 */
const getUsersInGroupCount = async (groupId, userType) => {
  let query;
  const values = [parseInt(groupId)];
  
  if (userType === 'fake_user') {
    query = 'SELECT COUNT(*) FROM chat_group_members WHERE group_id = $1 AND fake_user_id IS NOT NULL';
  } else if (userType === 'real_user') {
    query = 'SELECT COUNT(*) FROM chat_group_members WHERE group_id = $1 AND user_id IS NOT NULL';
  } else {
    // Count both real and fake users
    query = `
      SELECT COUNT(*) as count FROM chat_group_members 
      WHERE group_id = $1 AND (user_id IS NOT NULL OR fake_user_id IS NOT NULL)
    `;
  }
  
  const result = await db.query(query, values);
  return result.rows && result.rows.length > 0 ? parseInt(result.rows[0].count) : 0;
};

/**
 * Get all members of a group
 */
const getGroupMembers = async (groupId) => {
  const query = `
    SELECT 
      COALESCE(cgm.user_id, cgm.fake_user_id) as user_id, 
      CASE 
        WHEN cgm.fake_user_id IS NOT NULL THEN 'fake_user'
        ELSE 'real_user'
      END as user_type,
      cgm.join_date as joined_at
    FROM 
      chat_group_members cgm
    WHERE 
      cgm.group_id = $1
  `;
  
  const result = await db.query(query, [groupId]);
  return result.rows;
};

/**
 * Get fake users with pagination and search
 */
const getFakeUsers = async ({ limit, offset, search }) => {
  let query = `
    SELECT 
      cfu.id, 
      cfu.username, 
      cfu.display_name,
      cfu.avatar_url,
      cfu.created_at,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.fake_user_id = cfu.id) AS group_count,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.fake_user_id = cfu.id) AS message_count
    FROM 
      chat_fake_users cfu
  `;
  
  const values = [];
  
  if (search) {
    query += ` WHERE cfu.username ILIKE $1 OR cfu.display_name ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  query += ` ORDER BY cfu.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count total fake users matching search criteria
 */
const getFakeUsersCount = async (search) => {
  let query = 'SELECT COUNT(*) FROM chat_fake_users';
  const values = [];
  
  if (search) {
    query += ` WHERE username ILIKE $1 OR display_name ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  const result = await db.query(query, values);
  return parseInt(result.rows[0].count);
};

/**
 * Get a specific fake user by ID
 */
const getFakeUserById = async (userId) => {
  const query = `
    SELECT 
      id, 
      username, 
      display_name,
      avatar_url,
      created_at,
      (SELECT COUNT(*) FROM chat_group_members WHERE fake_user_id = $1) AS group_count,
      (SELECT COUNT(*) FROM chat_messages WHERE fake_user_id = $1) AS message_count
    FROM 
      chat_fake_users
    WHERE 
      id = $1
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows[0] || null;
};

/**
 * Get groups that a fake user belongs to
 */
const getGroupsForFakeUser = async (userId) => {
  const query = `
    SELECT 
      cg.id, 
      cg.name, 
      cg.description,
      cgm.join_date as joined_at,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = cg.id AND cm.fake_user_id = $1) AS message_count,
      (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = cg.id AND cm.fake_user_id = $1) AS last_message_at
    FROM 
      chat_groups cg
    JOIN 
      chat_group_members cgm ON cgm.group_id = cg.id AND cgm.fake_user_id = $1
    ORDER BY 
      cgm.join_date DESC
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Check if a fake user is in a group
 */
const isFakeUserInGroup = async (userId, groupId) => {
  const query = `
    SELECT EXISTS(
      SELECT 1 
      FROM chat_group_members 
      WHERE fake_user_id = $1 AND group_id = $2
    )
  `;
  
  const result = await db.query(query, [userId, groupId]);
  return result.rows[0].exists;
};

/**
 * Create a new message as a fake user with transaction support
 */
const createMessage = async ({ 
  groupId, 
  fakeUserId, 
  content, 
  messageType = 'text',
  isAdminGenerated = true,
  adminId
}) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // First, verify the fake user is in the group
    const membershipCheck = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM chat_group_members 
        WHERE fake_user_id = $1 AND group_id = $2
      )
    `, [fakeUserId, groupId]);
    
    if (!membershipCheck.rows[0].exists) {
      throw new Error(`FAKE_USER_NOT_IN_GROUP: Fake user ${fakeUserId} is not a member of group ${groupId}`);
    }
    
    // Create the message
    const messageQuery = `
      INSERT INTO chat_messages (
        group_id, 
        fake_user_id, 
        content, 
        media_type, 
        sent_by_admin, 
        admin_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, group_id, fake_user_id, content, media_type, created_at
    `;
    
    const messageResult = await client.query(messageQuery, [
      groupId, 
      fakeUserId, 
      content, 
      messageType, 
      isAdminGenerated, 
      adminId
    ]);
    
    const newMessage = messageResult.rows[0];
    
    // Log the admin action atomically
    await client.query(`
      INSERT INTO chat_admin_logs (
        admin_id,
        action_type,
        entity_type,
        entity_id,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      adminId,
      'POST_AS_FAKE_USER',
      'MESSAGE',
      newMessage.id,
      JSON.stringify({ 
        groupId, 
        fakeUserId, 
        messageType,
        contentLength: content.length 
      })
    ]);
    
    await client.query('COMMIT');
    return newMessage;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[createMessage] Transaction failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Schedule a message to be sent later with validation and transaction support
 */
const scheduleMessage = async ({ 
  groupId, 
  fakeUserId, 
  content, 
  messageType = 'text',
  scheduledAt,
  isAdminGenerated = true,
  adminId,
  isRecurring = false,
  recurringPattern = null
}) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Validate scheduled time is in the future
    const now = new Date();
    const scheduledTime = new Date(scheduledAt);
    
    if (scheduledTime <= now) {
      throw new Error(`INVALID_SCHEDULE_TIME: Scheduled time ${scheduledAt} must be in the future (current time: ${now.toISOString()})`);
    }
    
    // Verify the fake user is in the group
    const membershipCheck = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM chat_group_members 
        WHERE fake_user_id = $1 AND group_id = $2
      )
    `, [fakeUserId, groupId]);
    
    if (!membershipCheck.rows[0].exists) {
      throw new Error(`FAKE_USER_NOT_IN_GROUP: Fake user ${fakeUserId} is not a member of group ${groupId}`);
    }
    
    // Create the scheduled message
    const query = `
      INSERT INTO chat_scheduled_messages (
        group_id, 
        fake_user_id, 
        content, 
        media_type, 
        scheduled_time,
        is_recurring,
        recurrence_pattern,
        scheduled_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, group_id, fake_user_id, content, media_type, scheduled_time, is_recurring, recurrence_pattern, scheduled_by, created_at
    `;
    
    const result = await client.query(query, [
      groupId, 
      fakeUserId, 
      content, 
      messageType, 
      scheduledAt,
      isRecurring,
      recurringPattern,
      adminId
    ]);
    
    const scheduledMessage = result.rows[0];
    
    // Log the admin action atomically
    await client.query(`
      INSERT INTO chat_admin_logs (
        admin_id,
        action_type,
        entity_type,
        entity_id,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      adminId,
      'SCHEDULE_MESSAGE',
      'SCHEDULED_MESSAGE',
      scheduledMessage.id,
      JSON.stringify({ 
        groupId, 
        fakeUserId, 
        messageType,
        scheduledAt,
        isRecurring,
        recurringPattern
      })
    ]);
    
    await client.query('COMMIT');
    return scheduledMessage;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[scheduleMessage] Transaction failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get a scheduled message by ID
 */
const getScheduledMessageById = async (messageId) => {
  const query = `
    SELECT 
      id, 
      group_id, 
      fake_user_id,
      content, 
      media_type, 
      scheduled_time,
      is_recurring,
      recurrence_pattern,
      scheduled_by,
      is_sent
    FROM 
      chat_scheduled_messages
    WHERE 
      id = $1 
      AND is_sent = false
  `;
  
  const result = await db.query(query, [messageId]);
  return result.rows[0] || null;
};

/**
 * Cancel a scheduled message
 */
const cancelScheduledMessage = async (messageId) => {
  const query = `
    DELETE FROM chat_scheduled_messages
    WHERE 
      id = $1 
      AND is_sent = false
  `;
  
  await db.query(query, [messageId]);
  return true;
};

/**
 * Get scheduled messages with filtering and pagination
 */
const getScheduledMessages = async ({ 
  groupId, 
  userId, 
  userType,
  limit, 
  offset 
}) => {
  let query = `
    SELECT 
      csm.id, 
      csm.group_id, 
      csm.fake_user_id as user_id, 
      'fake_user' as user_type, 
      csm.content, 
      COALESCE(csm.media_type, 'text') as message_type, 
      true as is_admin_generated, 
      csm.scheduled_by as admin_id,
      csm.scheduled_time as scheduled_at,
      csm.is_recurring,
      csm.recurrence_pattern as recurring_pattern,
      cg.name AS group_name,
      cfu.display_name AS user_display_name,
      a.username AS admin_username
    FROM 
      chat_scheduled_messages csm
    JOIN 
      chat_groups cg ON cg.id = csm.group_id
    JOIN 
      chat_fake_users cfu ON cfu.id = csm.fake_user_id
    LEFT JOIN 
      users a ON a.id = csm.scheduled_by AND a.role = 'admin'
    WHERE 
      csm.is_sent = false
  `;
  
  const values = [];
  
  if (groupId) {
    query += ` AND csm.group_id = $${values.length + 1}`;
    values.push(groupId);
  }
  
  if (userId && userType === 'fake_user') {
    query += ` AND csm.fake_user_id = $${values.length + 1}`;
    values.push(userId);
  }
  
  query += ` ORDER BY csm.scheduled_time ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count scheduled messages
 */
const getScheduledMessagesCount = async ({ groupId, userId, userType }) => {
  let query = `
    SELECT COUNT(*) 
    FROM chat_scheduled_messages
    WHERE 
      is_sent = false
  `;
  
  const values = [];
  
  if (groupId) {
    query += ` AND group_id = $${values.length + 1}`;
    values.push(groupId);
  }
  
  if (userId && userType === 'fake_user') {
    query += ` AND fake_user_id = $${values.length + 1}`;
    values.push(userId);
  }
  
  const result = await db.query(query, values);
  return parseInt(result.rows[0].count);
};

/**
 * Log an admin action
 */
const logAdminAction = async ({
  adminId,
  actionType,
  entityType = null,
  entityId = null,
  details = {}
}) => {
  console.log('[logAdminAction] adminId:', adminId, 'actionType:', actionType, 'entityType:', entityType, 'entityId:', entityId, 'details:', details);
  const query = `
    INSERT INTO chat_admin_logs (
      admin_id,
      action_type,
      entity_type,
      entity_id,
      details
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;
  const result = await db.query(query, [
    adminId,
    actionType,
    entityType,
    entityId,
    JSON.stringify(details)
  ]);
  return result.rows[0].id;
};

/**
 * Get admin logs with filtering and pagination
 */
const getAdminLogs = async ({
  adminId,
  actionType,
  groupId,
  fakeUserId,
  startDate,
  endDate,
  limit,
  offset
}) => {
  let query = `
    SELECT 
      cal.id, 
      cal.admin_id, 
      cal.action_type, 
      cal.entity_type, 
      cal.entity_id, 
      cal.details, 
      cal.created_at,
      a.username AS admin_username,
      cg.name AS group_name,
      cfu.display_name AS fake_user_name
    FROM 
      chat_admin_logs cal
    LEFT JOIN users a ON a.id = cal.admin_id AND a.role = 'admin'
    LEFT JOIN chat_groups cg ON cg.id = cal.entity_id AND cal.entity_type = 'GROUP'
    LEFT JOIN chat_fake_users cfu ON cfu.id = cal.entity_id AND cal.entity_type = 'FAKE_USER'
    WHERE 1=1
  `;

  const values = [];

  if (adminId) {
    query += ` AND cal.admin_id = $${values.length + 1}`;
    values.push(adminId);
  }

  if (actionType) {
    query += ` AND cal.action_type = $${values.length + 1}`;
    values.push(actionType);
  }

  if (groupId) {
    query += ` AND cal.entity_id = $${values.length + 1} AND cal.entity_type = 'GROUP'`;
    values.push(groupId);
  }

  if (fakeUserId) {
    query += ` AND cal.entity_id = $${values.length + 1} AND cal.entity_type = 'FAKE_USER'`;
    values.push(fakeUserId);
  }

  if (startDate) {
    query += ` AND cal.created_at >= $${values.length + 1}`;
    values.push(startDate);
  }

  if (endDate) {
    query += ` AND cal.created_at <= $${values.length + 1}`;
    values.push(endDate);
  }

  query += ` ORDER BY cal.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count admin logs
 */
const getAdminLogsCount = async ({ 
  adminId, 
  actionType, 
  groupId, 
  fakeUserId,
  startDate,
  endDate
}) => {
  let query = `SELECT COUNT(*) FROM chat_admin_logs WHERE 1=1`;
  
  const values = [];
  
  if (adminId) {
    query += ` AND admin_id = $${values.length + 1}`;
    values.push(adminId);
  }
  
  if (actionType) {
    query += ` AND action_type = $${values.length + 1}`;
    values.push(actionType);
  }
  
  if (groupId) {
    query += ` AND group_id = $${values.length + 1}`;
    values.push(groupId);
  }
  
  if (fakeUserId) {
    query += ` AND fake_user_id = $${values.length + 1}`;
    values.push(fakeUserId);
  }
  
  if (startDate) {
    query += ` AND created_at >= $${values.length + 1}`;
    values.push(startDate);
  }
  
  if (endDate) {
    query += ` AND created_at <= $${values.length + 1}`;
    values.push(endDate);
  }
  
  const result = await db.query(query, values);
  return parseInt(result.rows[0].count);
};

/**
 * Get a specific log by ID
 */
const getLogById = async (logId) => {
  const query = `
    SELECT 
      cal.id, 
      cal.admin_id, 
      cal.action_type, 
      cal.group_id, 
      cal.fake_user_id, 
      cal.message_id, 
      cal.action_details,
      cal.created_at,
      a.username AS admin_username,
      cg.name AS group_name,
      cfu.display_name AS fake_user_name,
      cm.content AS message_content
    FROM 
      chat_admin_logs cal
    LEFT JOIN 
      users a ON a.id = cal.admin_id AND a.role = 'admin'
    LEFT JOIN 
      chat_groups cg ON cg.id = cal.group_id
    LEFT JOIN 
      chat_fake_users cfu ON cfu.id = cal.fake_user_id
    LEFT JOIN 
      chat_messages cm ON cm.id = cal.message_id
    WHERE 
      cal.id = $1
  `;
  
  const result = await db.query(query, [logId]);
  return result.rows[0] || null;
};

/**
 * Get templates with pagination
 */
const getTemplates = async ({ adminId, limit, offset }) => {
  const query = `
    SELECT 
      id, 
      name, 
      description, 
      admin_id, 
      content, 
      created_at, 
      updated_at
    FROM 
      chat_templates
    WHERE 
      admin_id = $1
    ORDER BY 
      updated_at DESC
    LIMIT $2 OFFSET $3
  `;
  
  const result = await db.query(query, [adminId, limit, offset]);
  return result.rows;
};

/**
 * Count templates for an admin
 */
const getTemplatesCount = async (adminId) => {
  const query = `SELECT COUNT(*) FROM chat_templates WHERE admin_id = $1`;
  const result = await db.query(query, [adminId]);
  return parseInt(result.rows[0].count);
};

/**
 * Get a specific template by ID
 */
const getTemplateById = async (templateId) => {
  const query = `
    SELECT 
      id, 
      name, 
      description, 
      admin_id, 
      content, 
      created_at, 
      updated_at
    FROM 
      chat_templates
    WHERE 
      id = $1
  `;
  
  const result = await db.query(query, [templateId]);
  return result.rows[0] || null;
};

/**
 * Create a new template
 */
const createTemplate = async ({ name, description, content, adminId }) => {
  const query = `
    INSERT INTO chat_templates (
      name, 
      description, 
      content, 
      admin_id
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, description, admin_id, content, created_at, updated_at
  `;
  
  const result = await db.query(query, [
    name, 
    description, 
    JSON.stringify(content), 
    adminId
  ]);
  
  return result.rows[0];
};

/**
 * Update an existing template
 */
const updateTemplate = async (templateId, { name, description, content }) => {
  let query = `
    UPDATE chat_templates 
    SET updated_at = NOW()
  `;
  
  const values = [templateId];
  let paramIndex = 2;
  
  if (name !== undefined) {
    query += `, name = $${paramIndex++}`;
    values.push(name);
  }
  
  if (description !== undefined) {
    query += `, description = $${paramIndex++}`;
    values.push(description);
  }
  
  if (content !== undefined) {
    query += `, content = $${paramIndex++}`;
    values.push(JSON.stringify(content));
  }
  
  query += ` WHERE id = $1 RETURNING id, name, description, admin_id, content, created_at, updated_at`;
  
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Delete a template
 */
const deleteTemplate = async (templateId) => {
  const query = `DELETE FROM chat_templates WHERE id = $1`;
  await db.query(query, [templateId]);
  return true;
};

/**
 * Get all conversations where fake users are active
 */
const getConversations = async ({ limit, offset, search }) => {
  let query = `
    SELECT 
      cg.id,
      cg.name,
      cg.description,
      cg.is_personal_group,
      cg.created_at,
      COUNT(DISTINCT cgm.user_id) as real_user_count,
      COUNT(DISTINCT cgm.fake_user_id) as fake_user_count,
      COUNT(cm.id) as message_count,
      MAX(cm.created_at) as last_activity,
      (
        SELECT cm2.content 
        FROM chat_messages cm2 
        WHERE cm2.group_id = cg.id 
        ORDER BY cm2.created_at DESC 
        LIMIT 1
      ) as last_message,
      (
        SELECT COALESCE(u.username, cfu.display_name)
        FROM chat_messages cm2
        LEFT JOIN users u ON cm2.user_id = u.id
        LEFT JOIN chat_fake_users cfu ON cm2.fake_user_id = cfu.id
        WHERE cm2.group_id = cg.id 
        ORDER BY cm2.created_at DESC 
        LIMIT 1
      ) as last_sender_name
    FROM chat_groups cg
    LEFT JOIN chat_group_members cgm ON cg.id = cgm.group_id
    LEFT JOIN chat_messages cm ON cg.id = cm.group_id
  `;

  const values = [];
  
  if (search) {
    query += ` WHERE cg.name ILIKE $1 OR cg.description ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  query += `
    GROUP BY cg.id, cg.name, cg.description, cg.is_personal_group, cg.created_at
    ORDER BY last_activity DESC NULLS LAST, cg.created_at DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;
  
  values.push(limit, offset);
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count total conversations matching search criteria
 */
const getConversationsCount = async (search) => {
  let query = 'SELECT COUNT(DISTINCT cg.id) FROM chat_groups cg';
  const values = [];
  
  if (search) {
    query += ` WHERE cg.name ILIKE $1 OR cg.description ILIKE $1`;
    values.push(`%${search}%`);
  }
  
  const result = await db.query(query, values);
  return parseInt(result.rows[0].count);
};

/**
 * Get conversation by ID with details
 */
const getConversationById = async (conversationId) => {
  const query = `
    SELECT 
      cg.id,
      cg.name,
      cg.description,
      cg.is_personal_group,
      cg.created_at,
      COUNT(DISTINCT cgm.user_id) as real_user_count,
      COUNT(DISTINCT cgm.fake_user_id) as fake_user_count,
      COUNT(cm.id) as message_count
    FROM chat_groups cg
    LEFT JOIN chat_group_members cgm ON cg.id = cgm.group_id
    LEFT JOIN chat_messages cm ON cg.id = cm.group_id
    WHERE cg.id = $1
    GROUP BY cg.id, cg.name, cg.description, cg.is_personal_group, cg.created_at
  `;
  
  const result = await db.query(query, [conversationId]);
  return result.rows[0];
};

/**
 * Get messages in a conversation with sender details
 */
const getConversationMessages = async (conversationId, { limit, offset }) => {
  const query = `
    SELECT 
      cm.id,
      cm.group_id,
      cm.content,
      cm.media_url,
      cm.media_type,
      cm.created_at,
      cm.updated_at,
      cm.is_pinned,
      cm.admin_id,
      cm.sent_by_admin,
      CASE 
        WHEN cm.user_id IS NOT NULL THEN 'real_user'
        WHEN cm.fake_user_id IS NOT NULL THEN 'fake_user'
        ELSE 'unknown'
      END as sender_type,
      COALESCE(u.username, cfu.display_name) as sender_name,
      COALESCE(u.id, cfu.id) as sender_id,
      cfu.avatar_url as sender_avatar,
      a.username as admin_username
    FROM chat_messages cm
    LEFT JOIN users u ON cm.user_id = u.id
    LEFT JOIN chat_fake_users cfu ON cm.fake_user_id = cfu.id
    LEFT JOIN users a ON cm.admin_id = a.id
    WHERE cm.group_id = $1
    ORDER BY cm.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const result = await db.query(query, [conversationId, limit, offset]);
  return result.rows.reverse(); // Return in chronological order
};

/**
 * Count messages in a conversation
 */
const getConversationMessagesCount = async (conversationId) => {
  const query = 'SELECT COUNT(*) FROM chat_messages WHERE group_id = $1';
  const result = await db.query(query, [conversationId]);
  return parseInt(result.rows[0].count);
};

/**
 * Send message as persona (fake user) with admin attribution
 */
const sendMessageAsPersona = async ({ groupId, fakeUserId, content, messageType = 'text', adminId }) => {
  const query = `
    INSERT INTO chat_messages (
      group_id, 
      fake_user_id, 
      content, 
      media_type, 
      admin_id, 
      sent_by_admin,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
    RETURNING *
  `;

  const result = await db.query(query, [groupId, fakeUserId, content, messageType, adminId]);
  return result.rows[0];
};

module.exports = {
  getGroups,
  getGroupsCount,
  getGroupById,
  groupExists,
  getUsersInGroup,
  getUsersInGroupCount,
  getGroupMembers,
  getFakeUsers,
  getFakeUsersCount,
  getFakeUserById,
  getGroupsForFakeUser,
  isFakeUserInGroup,
  createMessage,
  scheduleMessage,
  getScheduledMessageById,
  cancelScheduledMessage,
  getScheduledMessages,
  getScheduledMessagesCount,
  logAdminAction,
  getAdminLogs,
  getAdminLogsCount,
  getLogById,
  getTemplates,
  getTemplatesCount,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getConversations,
  getConversationsCount,
  getConversationById,
  getConversationMessages,
  getConversationMessagesCount,
  sendMessageAsPersona
};

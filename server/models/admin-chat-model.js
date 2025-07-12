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
  return parseInt(result.rows[0].count);
};

/**
 * Get a specific group by ID
 */
const getGroupById = async (groupId) => {
  const query = `
    SELECT 
      cg.id, 
      cg.name, 
      cg.description,
      cg.created_at,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id) AS member_count,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id AND cgm.user_type = 'real_user') AS real_user_count,
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.group_id = cg.id AND cgm.user_type = 'fake') AS fake_user_count,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = cg.id) AS message_count,
      (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = cg.id) AS last_activity
    FROM 
      chat_groups cg
    WHERE 
      cg.id = $1
  `;
  
  const result = await db.query(query, [groupId]);
  return result.rows[0] || null;
};

/**
 * Check if a group exists
 */
const groupExists = async (groupId) => {
  const query = 'SELECT EXISTS(SELECT 1 FROM chat_groups WHERE id = $1)';
  const result = await db.query(query, [groupId]);
  return result.rows[0].exists;
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
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = cfu.id AND cm.user_type = 'fake_user') AS message_count,
        (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = cfu.id AND cm.user_type = 'fake_user') AS last_message_at
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
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = u.id AND cm.user_type = 'real_user') AS message_count,
        (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = u.id AND cm.user_type = 'real_user') AS last_message_at
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
    query = `
      SELECT 
        cgm.user_id, 
        CASE 
          WHEN cgm.fake_user_id IS NOT NULL THEN 'fake_user'
          ELSE 'real_user'
        END as user_type,
        cgm.join_date as joined_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = $1 AND cm.user_id = cgm.user_id AND cm.user_type = cgm.user_type) AS message_count
      FROM 
        chat_group_members cgm
      WHERE 
        cgm.group_id = $1
      ORDER BY 
        cgm.join_date DESC
      LIMIT $2 OFFSET $3
    `;
    values.push(limit, offset);
  }
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Count users in a group
 */
const getUsersInGroupCount = async (groupId, userType) => {
  let query = 'SELECT COUNT(*) FROM chat_group_members WHERE group_id = $1';
  const values = [groupId];
  
  if (userType === 'fake_user') {
    query += ' AND fake_user_id IS NOT NULL';
  } else if (userType === 'real_user') {
    query += ' AND user_id IS NOT NULL';
  }
  
  const result = await db.query(query, values);
  return parseInt(result.rows[0].count);
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
      (SELECT COUNT(*) FROM chat_group_members cgm WHERE cgm.user_id = cfu.id AND cgm.user_type = 'fake') AS group_count,
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.user_id = cfu.id AND cm.user_type = 'fake_user') AS message_count
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
      (SELECT COUNT(*) FROM chat_group_members WHERE user_id = $1 AND user_type = 'fake') AS group_count,
      (SELECT COUNT(*) FROM chat_messages WHERE user_id = $1 AND user_type = 'fake') AS message_count
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
      (SELECT COUNT(*) FROM chat_messages cm WHERE cm.group_id = cg.id AND cm.user_id = $1 AND cm.user_type = 'fake_user') AS message_count,
      (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.group_id = cg.id AND cm.user_id = $1 AND cm.user_type = 'fake_user') AS last_message_at
    FROM 
      chat_groups cg
    JOIN 
      chat_group_members cgm ON cgm.group_id = cg.id AND cgm.user_id = $1 AND cgm.user_type = 'fake'
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
      WHERE user_id = $1 AND group_id = $2 AND user_type = 'fake'
    )
  `;
  
  const result = await db.query(query, [userId, groupId]);
  return result.rows[0].exists;
};

/**
 * Create a new message as a fake user
 */
const createMessage = async ({ 
  groupId, 
  fakeUserId, 
  content, 
  messageType = 'text',
  isAdminGenerated = true,
  adminId
}) => {
  const query = `
    INSERT INTO chat_messages (
      group_id, 
      user_id, 
      user_type, 
      content, 
      message_type, 
      is_admin_generated, 
      admin_id
    )
    VALUES ($1, $2, 'fake', $3, $4, $5, $6)
    RETURNING id, group_id, user_id, user_type, content, message_type, created_at
  `;
  
  const result = await db.query(query, [
    groupId, 
    fakeUserId, 
    content, 
    messageType, 
    isAdminGenerated, 
    adminId
  ]);
  
  return result.rows[0];
};

/**
 * Schedule a message to be sent later
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
  const query = `
    INSERT INTO chat_messages (
      group_id, 
      user_id, 
      user_type, 
      content, 
      message_type, 
      is_admin_generated, 
      admin_id,
      scheduled_at,
      is_recurring,
      recurring_pattern
    )
    VALUES ($1, $2, 'fake', $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, group_id, user_id, user_type, content, message_type, scheduled_at, is_recurring, recurring_pattern
  `;
  
  const result = await db.query(query, [
    groupId, 
    fakeUserId, 
    content, 
    messageType, 
    isAdminGenerated, 
    adminId,
    scheduledAt,
    isRecurring,
    recurringPattern ? JSON.stringify(recurringPattern) : null
  ]);
  
  return result.rows[0];
};

/**
 * Get a scheduled message by ID
 */
const getScheduledMessageById = async (messageId) => {
  const query = `
    SELECT 
      id, 
      group_id, 
      user_id, 
      user_type, 
      content, 
      message_type, 
      is_admin_generated, 
      admin_id,
      scheduled_at,
      is_recurring,
      recurring_pattern
    FROM 
      chat_messages
    WHERE 
      id = $1 
      AND scheduled_at IS NOT NULL 
      AND created_at IS NULL
  `;
  
  const result = await db.query(query, [messageId]);
  return result.rows[0] || null;
};

/**
 * Cancel a scheduled message
 */
const cancelScheduledMessage = async (messageId) => {
  const query = `
    DELETE FROM chat_messages
    WHERE 
      id = $1 
      AND scheduled_at IS NOT NULL 
      AND created_at IS NULL
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
      admins a ON a.id = csm.scheduled_by
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
  groupId = null, 
  fakeUserId = null, 
  messageId = null, 
  actionDetails = {}
}) => {
  const query = `
    INSERT INTO chat_admin_logs (
      admin_id, 
      action_type, 
      group_id, 
      fake_user_id, 
      message_id, 
      action_details
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  
  const result = await db.query(query, [
    adminId, 
    actionType, 
    groupId, 
    fakeUserId, 
    messageId, 
    JSON.stringify(actionDetails)
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
      cal.group_id, 
      cal.fake_user_id, 
      cal.message_id, 
      cal.action_details,
      cal.created_at,
      a.username AS admin_username,
      cg.name AS group_name,
      cfu.display_name AS fake_user_name
    FROM 
      chat_admin_logs cal
    LEFT JOIN 
      admins a ON a.id = cal.admin_id
    LEFT JOIN 
      chat_groups cg ON cg.id = cal.group_id
    LEFT JOIN 
      chat_fake_users cfu ON cfu.id = cal.fake_user_id
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
    query += ` AND cal.group_id = $${values.length + 1}`;
    values.push(groupId);
  }
  
  if (fakeUserId) {
    query += ` AND cal.fake_user_id = $${values.length + 1}`;
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
      admins a ON a.id = cal.admin_id
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
  deleteTemplate
};

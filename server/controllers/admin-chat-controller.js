/**
 * Admin Chat Controller
 * Handles business logic for admin chat management
 */

const adminChatModel = require('../models/admin-chat-model');

/**
 * Get all chat groups
 */
const getAllGroups = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ 
        error: 'INVALID_PAGE_PARAMETER',
        message: 'Page parameter must be a positive integer',
        details: { provided: page, expected: 'positive integer >= 1' }
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ 
        error: 'INVALID_LIMIT_PARAMETER',
        message: 'Limit parameter must be between 1 and 100',
        details: { provided: limit, expected: 'integer between 1 and 100' }
      });
    }
    
    const offset = (pageNum - 1) * limitNum;
    
    const groups = await adminChatModel.getGroups({ limit: limitNum, offset, search });
    const totalCount = await adminChatModel.getGroupsCount(search);
    
    res.json({
      groups,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
    
    // Log admin action
    await logAdminAction(req.user.id, 'VIEW_GROUPS', null, null, null, { search, page: pageNum, limit: limitNum });
  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({ 
      error: 'GROUPS_FETCH_FAILED',
      message: 'Failed to retrieve groups from database',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get details for a specific group
 */
const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.id; // Fixed: use 'id' parameter from route
    const group = await adminChatModel.getGroupById(groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json(group);
    
    // Log admin action - using req.user instead of req.user
    await logAdminAction(req.user.id, 'VIEW_GROUP_DETAILS', groupId, null, null);
  } catch (error) {
    console.error('Error getting group details:', error);
    res.status(500).json({ error: 'Failed to retrieve group details' });
  }
};

/**
 * Get users in a specific group
 */
const getGroupUsers = async (req, res) => {
  try {
    const groupId = req.params.id; // Fixed: use 'id' parameter from route
    const { page = 1, limit = 50, userType = 'fake_user' } = req.query;
    const offset = (page - 1) * limit;
    
    // Verify group exists
    const groupExists = await adminChatModel.groupExists(groupId);
    if (!groupExists) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const users = await adminChatModel.getUsersInGroup(groupId, userType, { limit, offset });
    const totalCount = await adminChatModel.getUsersInGroupCount(groupId, userType);
    
    res.json({
      users,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
    
    // Log admin action
    await logAdminAction(req.user.id, 'VIEW_GROUP_USERS', groupId, null, null, { userType });
  } catch (error) {
    console.error('Error getting group users:', error);
    res.status(500).json({ error: 'Failed to retrieve group users' });
  }
};

/**
 * Get all fake users
 */
const getAllFakeUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const users = await adminChatModel.getFakeUsers({ limit, offset, search });
    const totalCount = await adminChatModel.getFakeUsersCount(search);
    
    res.json({
      users,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
    
    // Log admin action
    await logAdminAction(req.user.id, 'VIEW_FAKE_USERS', null, null, null, { search });
  } catch (error) {
    console.error('Error getting fake users:', error);
    res.status(500).json({ error: 'Failed to retrieve fake users' });
  }
};

/**
 * Get details for a specific fake user
 */
const getFakeUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await adminChatModel.getFakeUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get groups this user belongs to
    const groups = await adminChatModel.getGroupsForFakeUser(userId);
    user.groups = groups;
    
    res.json(user);
    
    // Log admin action
    await logAdminAction(req.user.id, 'VIEW_FAKE_USER_DETAILS', null, userId, null);
  } catch (error) {
    console.error('Error getting fake user details:', error);
    res.status(500).json({ error: 'Failed to retrieve fake user details' });
  }
};

/**
 * Post a message as a fake user
 */
const postAsFakeUser = async (req, res) => {
  try {
    const { groupId, fakeUserId, message, messageType = 'text' } = req.body;
    
    // Validate required fields
    if (!groupId) {
      return res.status(400).json({ 
        error: 'MISSING_GROUP_ID',
        message: 'Group ID is required',
        details: 'groupId field is missing from request body'
      });
    }
    
    if (!fakeUserId) {
      return res.status(400).json({ 
        error: 'MISSING_FAKE_USER_ID',
        message: 'Fake user ID is required',
        details: 'fakeUserId field is missing from request body'
      });
    }
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ 
        error: 'INVALID_MESSAGE_CONTENT',
        message: 'Message content is required and must be a non-empty string',
        details: { provided: typeof message, expected: 'non-empty string' }
      });
    }
    
    // Validate message type
    const validMessageTypes = ['text', 'image', 'file', 'link'];
    if (!validMessageTypes.includes(messageType)) {
      return res.status(400).json({ 
        error: 'INVALID_MESSAGE_TYPE',
        message: 'Invalid message type',
        details: { provided: messageType, expected: validMessageTypes }
      });
    }
    
    // Validate IDs are positive integers
    const groupIdNum = parseInt(groupId);
    const fakeUserIdNum = parseInt(fakeUserId);
    
    if (isNaN(groupIdNum) || groupIdNum <= 0) {
      return res.status(400).json({ 
        error: 'INVALID_GROUP_ID_FORMAT',
        message: 'Group ID must be a positive integer',
        details: { provided: groupId, expected: 'positive integer' }
      });
    }
    
    if (isNaN(fakeUserIdNum) || fakeUserIdNum <= 0) {
      return res.status(400).json({ 
        error: 'INVALID_FAKE_USER_ID_FORMAT',
        message: 'Fake user ID must be a positive integer',
        details: { provided: fakeUserId, expected: 'positive integer' }
      });
    }
    
    const trimmedMessage = message.trim();
    
    // Create message in database with transaction support
    const newMessage = await adminChatModel.createMessage({
      groupId: groupIdNum,
      fakeUserId: fakeUserIdNum,
      content: trimmedMessage,
      messageType,
      isAdminGenerated: true,
      adminId: req.user.id
    });

    // Broadcast message via Socket.io
    const io = req.app.get('io');
    if (io && io.emitMessageToGroup) {
      try {
        io.emitMessageToGroup(groupIdNum, {
          id: newMessage.id,
          groupId: groupIdNum,
          userId: fakeUserIdNum,
          userType: 'fake',
          content: trimmedMessage,
          messageType,
          createdAt: newMessage.created_at
        });
      } catch (socketError) {
        console.error('Socket.io broadcast failed:', socketError);
        // Continue - don't fail the request for socket errors
      }
    }
    
    res.status(201).json({
      success: true,
      message: newMessage,
      meta: {
        adminId: req.user.id,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error posting as fake user:', error);
    
    // Handle specific error types
    if (error.message.includes('FAKE_USER_NOT_IN_GROUP')) {
      return res.status(400).json({ 
        error: 'FAKE_USER_NOT_IN_GROUP',
        message: 'The specified fake user is not a member of this group',
        details: error.message
      });
    }
    
    if (error.message.includes('does not exist') || error.code === '23503') {
      return res.status(404).json({ 
        error: 'RESOURCE_NOT_FOUND',
        message: 'Either the group or fake user does not exist',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'MESSAGE_POST_FAILED',
      message: 'Failed to post message as fake user',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Schedule a message to be sent later
 */
const scheduleMessage = async (req, res) => {
  try {
    const { 
      groupId, 
      fakeUserId, 
      message, 
      messageType = 'text',
      scheduledAt,
      isRecurring = false,
      recurringPattern = null
    } = req.body;
    
    // Validate required fields
    if (!groupId) {
      return res.status(400).json({ 
        error: 'MISSING_GROUP_ID',
        message: 'Group ID is required for scheduling a message'
      });
    }
    
    if (!fakeUserId) {
      return res.status(400).json({ 
        error: 'MISSING_FAKE_USER_ID',
        message: 'Fake user ID is required for scheduling a message'
      });
    }
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ 
        error: 'INVALID_MESSAGE_CONTENT',
        message: 'Message content is required and must be a non-empty string'
      });
    }
    
    if (!scheduledAt) {
      return res.status(400).json({ 
        error: 'MISSING_SCHEDULED_TIME',
        message: 'Scheduled time is required (scheduledAt field)'
      });
    }
    
    // Validate message type
    const validMessageTypes = ['text', 'image', 'file', 'link'];
    if (!validMessageTypes.includes(messageType)) {
      return res.status(400).json({ 
        error: 'INVALID_MESSAGE_TYPE',
        message: 'Invalid message type',
        details: { provided: messageType, expected: validMessageTypes }
      });
    }
    
    // Validate IDs
    const groupIdNum = parseInt(groupId);
    const fakeUserIdNum = parseInt(fakeUserId);
    
    if (isNaN(groupIdNum) || groupIdNum <= 0) {
      return res.status(400).json({ 
        error: 'INVALID_GROUP_ID_FORMAT',
        message: 'Group ID must be a positive integer'
      });
    }
    
    if (isNaN(fakeUserIdNum) || fakeUserIdNum <= 0) {
      return res.status(400).json({ 
        error: 'INVALID_FAKE_USER_ID_FORMAT',
        message: 'Fake user ID must be a positive integer'
      });
    }
    
    // Validate scheduled time format
    const scheduledTime = new Date(scheduledAt);
    if (isNaN(scheduledTime.getTime())) {
      return res.status(400).json({ 
        error: 'INVALID_SCHEDULED_TIME_FORMAT',
        message: 'Scheduled time must be a valid ISO date string',
        details: { provided: scheduledAt, expected: 'ISO 8601 date string' }
      });
    }
    
    // Validate recurring pattern if recurring is enabled
    if (isRecurring && !recurringPattern) {
      return res.status(400).json({ 
        error: 'MISSING_RECURRING_PATTERN',
        message: 'Recurring pattern is required when isRecurring is true'
      });
    }
    
    const trimmedMessage = message.trim();
    
    // Create scheduled message in database with transaction support
    const scheduledMessage = await adminChatModel.scheduleMessage({
      groupId: groupIdNum,
      fakeUserId: fakeUserIdNum,
      content: trimmedMessage,
      messageType,
      scheduledAt: scheduledTime,
      isAdminGenerated: true,
      adminId: req.user.id,
      isRecurring,
      recurringPattern
    });
    
    res.status(201).json({
      success: true,
      scheduledMessage,
      meta: {
        adminId: req.user.id,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error scheduling message:', error);
    
    // Handle specific error types
    if (error.message.includes('INVALID_SCHEDULE_TIME')) {
      return res.status(400).json({ 
        error: 'INVALID_SCHEDULE_TIME',
        message: 'Scheduled time must be in the future',
        details: error.message
      });
    }
    
    if (error.message.includes('FAKE_USER_NOT_IN_GROUP')) {
      return res.status(400).json({ 
        error: 'FAKE_USER_NOT_IN_GROUP',
        message: 'The specified fake user is not a member of this group',
        details: error.message
      });
    }
    
    if (error.message.includes('does not exist') || error.code === '23503') {
      return res.status(404).json({ 
        error: 'RESOURCE_NOT_FOUND',
        message: 'Either the group or fake user does not exist',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'MESSAGE_SCHEDULE_FAILED',
      message: 'Failed to schedule message',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Cancel a scheduled message
 */
const cancelScheduledMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Verify message exists and is scheduled
    const message = await adminChatModel.getScheduledMessageById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Scheduled message not found' });
    }
    
    // Cancel the scheduled message
    await adminChatModel.cancelScheduledMessage(messageId);
    
    res.json({ success: true, message: 'Scheduled message cancelled' });
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'CANCEL_SCHEDULED_MESSAGE', 
      message.groupId, 
      message.fakeUserId, 
      messageId
    );
  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    res.status(500).json({ error: 'Failed to cancel scheduled message' });
  }
};

/**
 * Get all scheduled messages
 */
const getScheduledMessages = async (req, res) => {
  try {
    const { groupId, userId, userType, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const messages = await adminChatModel.getScheduledMessages({ 
      groupId, 
      userId, 
      userType,
      limit, 
      offset 
    });
    
    const totalCount = await adminChatModel.getScheduledMessagesCount({ 
      groupId, 
      userId,
      userType 
    });
    
    res.json({
      messages,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'VIEW_SCHEDULED_MESSAGES', 
      groupId || null, 
      userId || null, 
      null,
      { userType }
    );
  } catch (error) {
    console.error('Error getting scheduled messages:', error);
    res.status(500).json({ error: 'Failed to retrieve scheduled messages' });
  }
};

/**
 * Preview how a conversation would appear
 */
const previewConversation = async (req, res) => {
  try {
    const { groupId, messages } = req.body;
    
    if (!groupId || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Group ID and messages array are required' 
      });
    }
    
    // Verify group exists
    const groupExists = await adminChatModel.groupExists(groupId);
    if (!groupExists) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Get existing group members for context
    const groupMembers = await adminChatModel.getGroupMembers(groupId);
    
    // Process messages to add user details
    const processedMessages = await Promise.all(
      messages.map(async (msg) => {
        // Verify fake user exists in group
        const userDetails = await adminChatModel.getFakeUserById(msg.fakeUserId);
        return {
          ...msg,
          user: userDetails,
          isPreview: true
        };
      })
    );
    
    res.json({
      groupId,
      messages: processedMessages,
      members: groupMembers
    });
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'PREVIEW_CONVERSATION', 
      groupId, 
      null, 
      null, 
      { messageCount: messages.length }
    );
  } catch (error) {
    console.error('Error previewing conversation:', error);
    res.status(500).json({ error: 'Failed to preview conversation' });
  }
};

/**
 * Get admin action logs
 */
const getAdminLogs = async (req, res) => {
  try {
    const { 
      adminId, 
      actionType, 
      groupId, 
      fakeUserId,
      startDate,
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const logs = await adminChatModel.getAdminLogs({ 
      adminId, 
      actionType, 
      groupId, 
      fakeUserId,
      startDate,
      endDate,
      limit, 
      offset 
    });
    
    const totalCount = await adminChatModel.getAdminLogsCount({ 
      adminId, 
      actionType, 
      groupId, 
      fakeUserId,
      startDate,
      endDate
    });
    
    res.json({
      logs,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error getting admin logs:', error);
    res.status(500).json({ error: 'Failed to retrieve admin logs' });
  }
};

/**
 * Get specific log details
 */
const getLogDetails = async (req, res) => {
  try {
    const { logId } = req.params;
    
    const log = await adminChatModel.getLogById(logId);
    
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error('Error getting log details:', error);
    res.status(500).json({ error: 'Failed to retrieve log details' });
  }
};

/**
 * Get conversation templates
 */
const getTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const templates = await adminChatModel.getTemplates({ 
      adminId: req.user.id, 
      limit, 
      offset 
    });
    
    const totalCount = await adminChatModel.getTemplatesCount(req.user.id);
    
    res.json({
      templates,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to retrieve templates' });
  }
};

/**
 * Create a new template
 */
const createTemplate = async (req, res) => {
  try {
    const { name, description, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    const template = await adminChatModel.createTemplate({
      name,
      description,
      content,
      adminId: req.user.id
    });
    
    res.status(201).json(template);
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'CREATE_TEMPLATE', 
      null, 
      null, 
      null, 
      { templateId: template.id, name }
    );
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

/**
 * Update an existing template
 */
const updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, description, content } = req.body;
    
    // Verify template exists and belongs to this admin
    const template = await adminChatModel.getTemplateById(templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.adminId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this template' });
    }
    
    const updatedTemplate = await adminChatModel.updateTemplate(templateId, {
      name,
      description,
      content
    });
    
    res.json(updatedTemplate);
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'UPDATE_TEMPLATE', 
      null, 
      null, 
      null, 
      { templateId, name }
    );
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

/**
 * Delete a template
 */
const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Verify template exists and belongs to this admin
    const template = await adminChatModel.getTemplateById(templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (template.adminId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    await adminChatModel.deleteTemplate(templateId);
    
    res.json({ success: true, message: 'Template deleted' });
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'DELETE_TEMPLATE', 
      null, 
      null, 
      null, 
      { templateId, name: template.name }
    );
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

/**
 * Log admin action helper function
 */
const logAdminAction = async (
  adminId,
  actionType,
  groupId = null,
  fakeUserId = null,
  messageId = null,
  actionDetails = {}
) => {
  // Determine entityType and entityId based on actionType
  let entityType = null;
  let entityId = null;
  if (actionType.includes('GROUP')) {
    entityType = 'GROUP';
    entityId = groupId;
  } else if (actionType.includes('FAKE_USER')) {
    entityType = 'FAKE_USER';
    entityId = fakeUserId;
  } else if (actionType.includes('MESSAGE')) {
    entityType = 'MESSAGE';
    entityId = messageId;
  }
  try {
    await adminChatModel.logAdminAction({
      adminId,
      actionType,
      entityType,
      entityId,
      details: actionDetails
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Non-blocking - continue even if logging fails
  }
};

/**
 * Get messages in a specific group for admin viewing
 */
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const db = require('../db');
    
    const messages = await db.query(`
      SELECT cm.*, 
             COALESCE(u.username, fu.username) as sender_name,
             CASE 
               WHEN cm.user_id IS NOT NULL THEN 'real_user'
               ELSE 'fake_user'
             END as sender_type,
             cm.created_at,
             cm.content,
             cm.is_active
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      LEFT JOIN chat_fake_users fu ON cm.fake_user_id = fu.id
      WHERE cm.group_id = $1 AND cm.is_active = true
      ORDER BY cm.created_at DESC
      LIMIT $2 OFFSET $3
    `, [groupId, limit, offset]);
    
    const totalCount = await db.query(
      'SELECT COUNT(*) FROM chat_messages WHERE group_id = $1 AND is_active = true',
      [groupId]
    );
    
    res.json({
      messages: messages.rows.reverse(), // Reverse to show oldest first
      pagination: {
        total: parseInt(totalCount.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount.rows[0].count / limit)
      }
    });
    
    await logAdminAction(req.user.id, 'VIEW_GROUP_MESSAGES', groupId);
  } catch (error) {
    console.error('Error getting group messages:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
};

/**
 * Reply to a message in a group as admin
 */
const replyToGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content, fakeUserId, replyToMessageId } = req.body;
    const adminId = req.user.id;
    
    const db = require('../db');
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const message = await db.query(`
      INSERT INTO chat_messages (
        group_id, content, admin_id, fake_user_id, 
        sent_by_admin, reply_to_message_id, created_at
      ) VALUES ($1, $2, $3, $4, true, $5, NOW()) 
      RETURNING *
    `, [groupId, content.trim(), adminId, fakeUserId, replyToMessageId || null]);
    
    // Get sender name for response
    let senderName = 'Admin';
    if (fakeUserId) {
      const fakeUser = await db.query('SELECT username FROM chat_fake_users WHERE id = $1', [fakeUserId]);
      if (fakeUser.rows.length > 0) {
        senderName = fakeUser.rows[0].username;
      }
    }
    
    const responseMessage = {
      ...message.rows[0],
      sender_name: senderName,
      sender_type: fakeUserId ? 'fake_user' : 'admin'
    };
    
    res.json({ message: responseMessage });
    
    await logAdminAction(adminId, 'REPLY_TO_GROUP_MESSAGE', groupId, null, fakeUserId, {
      replyToMessageId,
      content: content.substring(0, 100)
    });
  } catch (error) {
    console.error('Error replying to message:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
};

/**
 * Get all direct message conversations for admin oversight
 */
const getAllDirectMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const db = require('../db');
    
    let whereClause = '';
    let params = [limit, offset];
    
    if (search) {
      whereClause = 'WHERE u1.username ILIKE $3 OR u2.username ILIKE $3';
      params.push(`%${search}%`);
    }
    
    const conversations = await db.query(`
      SELECT dm.*, 
             u1.username as user1_name, 
             u2.username as user2_name,
             u1.id as user1_id,
             u2.id as user2_id,
             (SELECT content FROM direct_message_texts dmt 
              WHERE dmt.conversation_id = dm.id 
              ORDER BY dmt.created_at DESC LIMIT 1) as last_message,
             (SELECT COUNT(*) FROM direct_message_texts dmt 
              WHERE dmt.conversation_id = dm.id) as message_count,
             (SELECT created_at FROM direct_message_texts dmt 
              WHERE dmt.conversation_id = dm.id 
              ORDER BY dmt.created_at DESC LIMIT 1) as last_message_at
      FROM direct_messages dm
      JOIN users u1 ON dm.user1_id = u1.id
      JOIN users u2 ON dm.user2_id = u2.id
      ${whereClause}
      ORDER BY dm.updated_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    
    const totalCount = await db.query(`
      SELECT COUNT(*) FROM direct_messages dm
      JOIN users u1 ON dm.user1_id = u1.id
      JOIN users u2 ON dm.user2_id = u2.id
      ${whereClause}
    `, search ? [`%${search}%`] : []);
    
    res.json({ 
      conversations: conversations.rows,
      pagination: {
        total: parseInt(totalCount.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount.rows[0].count / limit)
      }
    });
    
    await logAdminAction(req.user.id, 'VIEW_DIRECT_MESSAGES', null, null, null, { search });
  } catch (error) {
    console.error('Error getting direct messages:', error);
    res.status(500).json({ error: 'Failed to retrieve direct messages' });
  }
};

/**
 * Get messages in a specific DM conversation for admin viewing
 */
const getDirectMessageConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const db = require('../db');
    
    const messages = await db.query(`
      SELECT dmt.*, u.username as sender_name, u.id as sender_id
      FROM direct_message_texts dmt
      JOIN users u ON dmt.sender_id = u.id
      WHERE dmt.conversation_id = $1
      ORDER BY dmt.created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);
    
    const totalCount = await db.query(
      'SELECT COUNT(*) FROM direct_message_texts WHERE conversation_id = $1',
      [conversationId]
    );
    
    res.json({ 
      messages: messages.rows.reverse(), // Show oldest first
      pagination: {
        total: parseInt(totalCount.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount.rows[0].count / limit)
      }
    });
    
    await logAdminAction(req.user.id, 'VIEW_DM_CONVERSATION', null, conversationId);
  } catch (error) {
    console.error('Error getting DM conversation:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation' });
  }
};

module.exports = {
  getAllGroups,
  getGroupDetails,
  getGroupUsers,
  getAllFakeUsers,
  getFakeUserDetails,
  postAsFakeUser,
  scheduleMessage,
  cancelScheduledMessage,
  getScheduledMessages,
  previewConversation,
  getAdminLogs,
  getLogDetails,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getGroupMessages,
  replyToGroupMessage,
  getAllDirectMessages,
  getDirectMessageConversation
};


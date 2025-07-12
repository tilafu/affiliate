/**
 * Admin Chat Controller
 * Handles business logic for admin chat management
 */

const adminChatModel = require('../models/admin-chat-model');
const socketManager = require('../chat-server'); // Import your Socket.io manager

/**
 * Get all chat groups
 */
const getAllGroups = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const groups = await adminChatModel.getGroups({ limit, offset, search });
    const totalCount = await adminChatModel.getGroupsCount(search);
    
    res.json({
      groups,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
    
    // Log admin action
    await logAdminAction(req.user.id, 'VIEW_GROUPS', null, null, null, { search, page, limit });
  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({ error: 'Failed to retrieve groups' });
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
    if (!groupId || !fakeUserId || !message) {
      return res.status(400).json({ error: 'Group ID, fake user ID, and message are required' });
    }
    
    // Verify group and user exist
    const userInGroup = await adminChatModel.isFakeUserInGroup(fakeUserId, groupId);
    if (!userInGroup) {
      return res.status(400).json({ error: 'User is not a member of this group' });
    }
    
    // Create message in database
    const newMessage = await adminChatModel.createMessage({
      groupId,
      fakeUserId,
      content: message,
      messageType,
      isAdminGenerated: true,
      adminId: req.user.id
    });
    
    // Broadcast message via Socket.io
    socketManager.emitMessageToGroup(groupId, {
      id: newMessage.id,
      groupId,
      userId: fakeUserId,
      userType: 'fake',
      content: message,
      messageType,
      createdAt: newMessage.createdAt
    });
    
    res.status(201).json(newMessage);
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'POST_AS_FAKE_USER', 
      groupId, 
      fakeUserId, 
      newMessage.id, 
      { messageType }
    );
  } catch (error) {
    console.error('Error posting as fake user:', error);
    res.status(500).json({ error: 'Failed to post message' });
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
    if (!groupId || !fakeUserId || !message || !scheduledAt) {
      return res.status(400).json({ 
        error: 'Group ID, fake user ID, message, and scheduledAt are required' 
      });
    }
    
    // Validate scheduled time is in the future
    const scheduledTime = new Date(scheduledAt);
    if (scheduledTime <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }
    
    // Verify group and user exist
    const userInGroup = await adminChatModel.isFakeUserInGroup(fakeUserId, groupId);
    if (!userInGroup) {
      return res.status(400).json({ error: 'User is not a member of this group' });
    }
    
    // Create scheduled message in database
    const scheduledMessage = await adminChatModel.scheduleMessage({
      groupId,
      fakeUserId,
      content: message,
      messageType,
      scheduledAt: scheduledTime,
      isAdminGenerated: true,
      adminId: req.user.id,
      isRecurring,
      recurringPattern
    });
    
    res.status(201).json(scheduledMessage);
    
    // Log admin action
    await logAdminAction(
      req.user.id, 
      'SCHEDULE_MESSAGE', 
      groupId, 
      fakeUserId, 
      scheduledMessage.id, 
      { 
        scheduledAt, 
        isRecurring, 
        recurringPattern 
      }
    );
  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({ error: 'Failed to schedule message' });
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
  try {
    await adminChatModel.logAdminAction({
      adminId,
      actionType,
      groupId,
      fakeUserId,
      messageId,
      actionDetails
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Non-blocking - continue even if logging fails
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
  deleteTemplate
};


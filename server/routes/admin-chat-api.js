/**
 * Admin Chat API Routes
 * Handles all admin-specific chat management endpoints
 * 
 * NOTE: This file is being deprecated in favor of admin-chat-api-integrated.js
 * It remains for backward compatibility, but all new development should use
 * the integrated version at /api/admin/chat
 */

const express = require('express');
const router = express.Router();
const adminChatController = require('../controllers/admin-chat-controller');
const { protect, admin } = require('../middlewares/auth'); // Use standardized auth middleware

// Apply admin authentication middleware to all routes
router.use(protect); // JWT authentication
router.use(admin);   // Admin role check

// Group management
router.get('/groups', adminChatController.getAllGroups);
router.get('/groups/:groupId', adminChatController.getGroupDetails);
router.get('/groups/:groupId/users', adminChatController.getGroupUsers);
router.get('/groups/:groupId/messages', adminChatController.getGroupMessages);
router.post('/groups/:groupId/reply', adminChatController.replyToGroupMessage);

// Fake user management
router.get('/users', adminChatController.getAllFakeUsers);
router.get('/users/:userId', adminChatController.getFakeUserDetails);

// Direct message management
router.get('/direct-messages', adminChatController.getAllDirectMessages);
router.get('/direct-messages/:conversationId/messages', adminChatController.getDirectMessageConversation);

// Posting and message management
router.post('/post', adminChatController.postAsFakeUser);
router.post('/schedule', adminChatController.scheduleMessage);
router.delete('/schedule/:messageId', adminChatController.cancelScheduledMessage);
router.get('/schedule', adminChatController.getScheduledMessages);

// Preview functionality
router.post('/preview', adminChatController.previewConversation);

// Admin logs
router.get('/logs', adminChatController.getAdminLogs);
router.get('/logs/:logId', adminChatController.getLogDetails);

// Templates (for future implementation)
router.get('/templates', adminChatController.getTemplates);
router.post('/templates', adminChatController.createTemplate);
router.put('/templates/:templateId', adminChatController.updateTemplate);
router.delete('/templates/:templateId', adminChatController.deleteTemplate);

module.exports = router;

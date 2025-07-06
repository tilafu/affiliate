/**
 * Admin Chat API Routes
 * Handles all admin-specific chat management endpoints
 */

const express = require('express');
const router = express.Router();
const adminChatController = require('../controllers/admin-chat-controller');
const adminChatAuth = require('../middleware/admin-chat-auth');

// Apply admin authentication middleware to all routes
router.use(adminChatAuth.verifyAdminChatAccess);

// Group management
router.get('/groups', adminChatController.getAllGroups);
router.get('/groups/:groupId', adminChatController.getGroupDetails);
router.get('/groups/:groupId/users', adminChatController.getGroupUsers);

// Fake user management
router.get('/users', adminChatController.getAllFakeUsers);
router.get('/users/:userId', adminChatController.getFakeUserDetails);

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

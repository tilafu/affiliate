/**
 * Admin Chat Integration with Existing Admin System
 * This module integrates the chat management with the existing admin authentication
 */

const express = require('express');
const router = express.Router();
const adminChatController = require('../controllers/admin-chat-controller');
const { protect, admin } = require('../middlewares/auth'); // Use existing auth middleware
const db = require('../db');

// Apply the same authentication middleware that main admin routes use
router.use(protect); // JWT authentication
router.use(admin);   // Admin role check

// === CHAT GROUPS ===
router.get('/groups', adminChatController.getAllGroups);
router.get('/groups/:id', adminChatController.getGroupDetails);
// NOTE: Group creation/modification endpoints would be implemented with proper handlers
// router.post('/groups', adminChatController.createGroup); // TODO: implement createGroup
// router.put('/groups/:id', adminChatController.updateGroup); // TODO: implement updateGroup  
// router.delete('/groups/:id', adminChatController.deleteGroup); // TODO: implement deleteGroup

// === GROUP MEMBERS ===
router.get('/groups/:id/members', adminChatController.getGroupUsers);
// NOTE: Member management endpoints would be implemented with proper handlers
// router.post('/groups/:id/members', adminChatController.addGroupMember); // TODO: implement addGroupMember
// router.delete('/groups/:id/members/:memberId', adminChatController.removeGroupMember); // TODO: implement removeGroupMember

// === FAKE USERS ===
router.get('/fake-users', adminChatController.getAllFakeUsers);
router.get('/fake-users/:id', adminChatController.getFakeUserDetails);
// NOTE: Fake user creation/modification endpoints would be implemented with proper handlers
// router.post('/fake-users', adminChatController.createFakeUser); // TODO: implement createFakeUser
// router.put('/fake-users/:id', adminChatController.updateFakeUser); // TODO: implement updateFakeUser
// router.delete('/fake-users/:id', adminChatController.deleteFakeUser); // TODO: implement deleteFakeUser
router.post('/fake-users/generate', function(req, res) {
    // Mock implementation until real one is created
    res.status(501).json({
        success: false, 
        message: "Fake user generation is not yet implemented",
        error: "NOT_IMPLEMENTED"
    });
});

// === CHAT MESSAGES ===
// Get messages in a specific group for admin viewing
router.get('/groups/:id/messages', adminChatController.getGroupMessages);
// Post a message as a fake user
router.post('/groups/:id/messages', adminChatController.postAsFakeUser);
// Reply to a group message as admin
router.post('/groups/:id/reply', adminChatController.replyToGroupMessage);
// NOTE: Message deletion would be implemented with proper handler
// router.delete('/messages/:id', adminChatController.deleteMessage); // TODO: implement deleteMessage

// === DIRECT MESSAGES MANAGEMENT ===
// Get all direct message conversations
router.get('/direct-messages', adminChatController.getAllDirectMessages);
// Get messages in a specific DM conversation
router.get('/direct-messages/:conversationId/messages', adminChatController.getDirectMessageConversation);

// === CONVERSATIONS (ADMIN VIEW) ===
// Get all conversations for admin overview
router.get('/conversations', adminChatController.getAllConversations);
// Get messages in a specific conversation
router.get('/conversations/:conversationId/messages', adminChatController.getConversationMessages);
// Send message as persona in conversation
router.post('/conversations/:conversationId/messages', adminChatController.sendConversationMessage);

// === SCHEDULED MESSAGES ===
router.get('/scheduled-messages', adminChatController.getScheduledMessages);
router.post('/scheduled-messages', adminChatController.scheduleMessage);
router.delete('/scheduled-messages/:id', adminChatController.cancelScheduledMessage);
// NOTE: Update scheduled message would be implemented with proper handler
// router.put('/scheduled-messages/:id', adminChatController.updateScheduledMessage); // TODO: implement updateScheduledMessage

// === TEMPLATES ===
router.get('/templates', adminChatController.getTemplates);
router.post('/templates', adminChatController.createTemplate);
router.put('/templates/:templateId', adminChatController.updateTemplate);
router.delete('/templates/:templateId', adminChatController.deleteTemplate);

// === ADMIN LOGS ===
router.get('/logs', adminChatController.getAdminLogs);
router.get('/logs/:logId', adminChatController.getLogDetails);

module.exports = router;

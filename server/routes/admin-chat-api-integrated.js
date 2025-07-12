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
router.post('/groups', adminChatController.postAsFakeUser); // Create group
router.put('/groups/:id', adminChatController.updateTemplate); // Update group
router.delete('/groups/:id', adminChatController.deleteTemplate); // Delete group

// Route for getting users in a specific group
router.get('/users/group/:groupId', adminChatController.getGroupUsers);

// === FAKE USERS ===
router.get('/fake-users', adminChatController.getAllFakeUsers);
router.get('/fake-users/:id', adminChatController.getFakeUserDetails);
router.post('/fake-users', adminChatController.postAsFakeUser); // Create fake user
router.put('/fake-users/:id', adminChatController.updateTemplate); // Update fake user
router.delete('/fake-users/:id', adminChatController.deleteTemplate); // Delete fake user
router.post('/fake-users/generate', function(req, res) {
    // Mock implementation until real one is created
    res.json({success: true, message: "Fake user generation would happen here"});
});

// === GROUP MEMBERS ===
router.get('/groups/:id/members', adminChatController.getGroupUsers);
router.post('/groups/:id/members', adminChatController.postAsFakeUser); // Add member
router.delete('/groups/:id/members/:memberId', adminChatController.deleteTemplate); // Remove member

// === CHAT MESSAGES ===
router.get('/groups/:id/messages', adminChatController.previewConversation);
router.post('/groups/:id/messages', adminChatController.postAsFakeUser);
router.delete('/messages/:id', adminChatController.deleteTemplate);

// === SCHEDULED MESSAGES ===
router.get('/scheduled-messages', adminChatController.getScheduledMessages);
router.get('/groups/:id/scheduled-messages', adminChatController.getScheduledMessages);
router.post('/scheduled-messages', adminChatController.scheduleMessage);
router.put('/scheduled-messages/:id', adminChatController.updateTemplate);
router.delete('/scheduled-messages/:id', adminChatController.cancelScheduledMessage);

// === ADMIN LOGS ===
router.get('/logs', adminChatController.getAdminLogs);

module.exports = router;

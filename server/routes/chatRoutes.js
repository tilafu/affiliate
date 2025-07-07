const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/auth');

// Middleware to ensure user is authenticated
router.use(authMiddleware.protect);

// Group Routes
router.get('/groups', chatController.getUserGroups);
router.get('/groups/:id', chatController.getGroupDetails);
router.post('/groups', authMiddleware.admin, chatController.createGroup);
router.put('/groups/:id', authMiddleware.admin, chatController.updateGroup);
router.delete('/groups/:id', authMiddleware.admin, chatController.deleteGroup);

// Group Members Routes
router.get('/groups/:id/members', chatController.getGroupMembers);
router.post('/groups/:id/members', authMiddleware.admin, chatController.addGroupMember);
router.delete('/groups/:id/members/:memberId', authMiddleware.admin, chatController.removeGroupMember);

// Messages Routes
router.get('/groups/:id/messages', chatController.getGroupMessages);
router.post('/groups/:id/messages', chatController.sendMessage);
router.put('/messages/:id', chatController.updateMessage);
router.delete('/messages/:id', chatController.deleteMessage);
router.post('/messages/:id/read', chatController.markMessageAsRead);

// Fake Users (Admin Avatars) Routes
router.get('/fake-users', authMiddleware.admin, chatController.getFakeUsers);
router.post('/fake-users', authMiddleware.admin, chatController.createFakeUser);
router.put('/fake-users/:id', authMiddleware.admin, chatController.updateFakeUser);
router.delete('/fake-users/:id', authMiddleware.admin, chatController.deleteFakeUser);

// Scheduled Messages Routes
router.get('/scheduled-messages', authMiddleware.admin, chatController.getScheduledMessages);
router.post('/scheduled-messages', authMiddleware.admin, chatController.createScheduledMessage);
router.put('/scheduled-messages/:id', authMiddleware.admin, chatController.updateScheduledMessage);
router.delete('/scheduled-messages/:id', authMiddleware.admin, chatController.deleteScheduledMessage);

module.exports = router;

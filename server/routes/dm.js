/**
 * Direct Message (DM) API Routes
 */

const express = require('express');
const router = express.Router();
const { check, body } = require('express-validator');
const { protect } = require('../middlewares/auth');
const dmController = require('../controllers/dm-controller');

// All DM routes should be authenticated
router.use(protect);

// GET /api/admin-chat/dms - Get all DM conversations for current user
router.get('/dms', dmController.getDMConversations);

// GET /api/admin-chat/dms/:conversationId - Get messages in a conversation
router.get('/dms/:conversationId', dmController.getDMMessages);

// POST /api/admin-chat/dms - Create a new DM conversation
router.post('/dms', [
    check('recipientId', 'Recipient ID is required').not().isEmpty()
], dmController.createDMConversation);

// POST /api/admin-chat/dms/:conversationId/message - Send a message
router.post('/dms/:conversationId/message', [
    check('message', 'Message is required for text messages').optional(),
    // For non-text messages, attachment will be handled via file upload middleware
], dmController.sendDMMessage);

// DELETE /api/admin-chat/dms/:conversationId - Delete a conversation
router.delete('/dms/:conversationId', dmController.deleteDMConversation);

// GET /api/admin-chat/fake-users/:fakeUserId/messages - Get all messages for a fake user (admin only)
router.get('/fake-users/:fakeUserId/messages', dmController.getFakeUserMessages);

module.exports = router;

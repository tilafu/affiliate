/**
 * Enhanced Direct Message (DM) API Routes
 */

const express = require('express');
const router = express.Router();
const { check, body } = require('express-validator');
const { protect, admin } = require('../middlewares/auth');
const dmController = require('../controllers/dm-controller-enhanced');

// All DM routes should be authenticated
router.use(protect);

// GET /api/admin-chat/dms - Get all DM conversations for current user
router.get('/dms', dmController.getDMConversations);

// GET /api/admin-chat/dms/:conversationId - Get messages in a conversation
router.get('/dms/:conversationId', dmController.getDMMessages);

// POST /api/admin-chat/dms - Create a new DM conversation
router.post('/dms', [
    check('recipientId', 'Recipient ID is required').not().isEmpty().isInt()
], dmController.createDMConversation);

// POST /api/admin-chat/dms/:conversationId/message - Send a message
router.post('/dms/:conversationId/message', 
    dmController.upload.single('attachment'),
    [
        check('messageType', 'Invalid message type').optional().isIn(['text', 'image', 'file', 'voicenote']),
        body('message').if(body('messageType').equals('text').or(body('messageType').not().exists()))
            .notEmpty().withMessage('Message is required for text messages')
    ], 
    dmController.sendDMMessage
);

// POST /api/admin-chat/dms/messages/:messageId/reactions - Add reaction to a message
router.post('/dms/messages/:messageId/reactions', [
    check('reactionType', 'Reaction type is required').not().isEmpty()
        .isIn(['like', 'love', 'laugh', 'angry', 'sad', 'wow'])
], dmController.addMessageReaction);

// DELETE /api/admin-chat/dms/messages/:messageId/reactions - Remove reaction from a message
router.delete('/dms/messages/:messageId/reactions', [
    check('reactionType', 'Reaction type is required').not().isEmpty()
], dmController.removeMessageReaction);

// PUT /api/admin-chat/dms/:conversationId/settings - Update conversation settings
router.put('/dms/:conversationId/settings', [
    check('notificationsEnabled', 'Notifications enabled must be boolean').optional().isBoolean(),
    check('isMuted', 'Is muted must be boolean').optional().isBoolean(),
    check('mutedUntil', 'Muted until must be a valid date').optional().isISO8601(),
    check('customNickname', 'Custom nickname must be a string').optional().isString().isLength({ max: 100 })
], dmController.updateConversationSettings);

// DELETE /api/admin-chat/dms/:conversationId - Delete/Archive a conversation
router.delete('/dms/:conversationId', dmController.deleteDMConversation);

// GET /api/admin-chat/fake-users/:fakeUserId/messages - Get all messages for a fake user (admin only)
router.get('/fake-users/:fakeUserId/messages', admin, dmController.getFakeUserMessages);

// GET /api/admin-chat/notifications/unread-count - Get unread notifications count
router.get('/notifications/unread-count', dmController.getUnreadNotificationsCount);

module.exports = router;

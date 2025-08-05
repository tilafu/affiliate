/**
 * Enhanced DM API Routes
 * Handles fake user DMs, support conversations, and admin notifications
 * Extends the existing DM system for the new feature requirements
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { authenticateAdmin } = require('../middleware/admin-auth');
const db = require('../db');

// Rate limiting for messages
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (error) {
  console.warn('express-rate-limit not installed, using fallback implementation');
  rateLimit = (options) => {
    return (req, res, next) => {
      next();
    };
  };
}

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { error: 'Too many messages sent. Please try again later.' }
});

// =============================================
// SUPPORT CONVERSATION API
// =============================================

/**
 * GET /api/user/chat/support
 * Get or create user's support conversation
 */
router.get('/support', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Use database function to get or create support conversation
    const result = await db.query(
      'SELECT get_or_create_support_conversation($1) as conversation_id',
      [userId]
    );
    
    const conversationId = result.rows[0].conversation_id;
    
    // Get conversation details
    const conversationDetails = await db.query(`
      SELECT 
        c.id,
        c.created_at,
        c.last_message_at,
        'Help & Support' as name,
        '/images/avatars/support-agent.png' as avatar_url,
        'support' as conversation_type
      FROM chat_dm_conversations c
      WHERE c.id = $1
    `, [conversationId]);
    
    res.json({
      success: true,
      conversation: conversationDetails.rows[0]
    });
    
  } catch (error) {
    console.error('Error getting support conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get support conversation'
    });
  }
});

/**
 * GET /api/user/chat/support/messages
 * Get support messages with pagination
 */
router.get('/support/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    // Get user's support conversation
    const convResult = await db.query(`
      SELECT id FROM chat_dm_conversations 
      WHERE user_id_1 = $1 AND is_support_conversation = TRUE AND status = 'active'
    `, [userId]);
    
    if (convResult.rows.length === 0) {
      return res.json({
        success: true,
        messages: [],
        pagination: { page: parseInt(page), limit: parseInt(limit), total: 0 }
      });
    }
    
    const conversationId = convResult.rows[0].id;
    
    // Get messages
    const messages = await db.query(`
      SELECT 
        m.id,
        m.message as content,
        m.message_type,
        m.attachment_url,
        m.created_at,
        m.sender_type,
        CASE 
          WHEN m.sender_type = 'real_user' THEN u.username
          WHEN m.sender_type = 'fake_user' THEN fu.username
          ELSE 'Support'
        END as sender_name,
        CASE 
          WHEN m.sender_type = 'real_user' THEN u.avatar_url
          WHEN m.sender_type = 'fake_user' THEN fu.avatar_url
          ELSE '/images/avatars/support-agent.png'
        END as sender_avatar,
        m.is_notification
      FROM chat_dm_messages m
      LEFT JOIN users u ON m.sender_id = u.id AND m.sender_type = 'real_user'
      LEFT JOIN chat_fake_users fu ON m.fake_user_sender_id = fu.id AND m.sender_type = 'fake_user'
      WHERE m.conversation_id = $1 AND m.status != 'deleted'
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);
    
    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM chat_dm_messages WHERE conversation_id = $1 AND status != \'deleted\'',
      [conversationId]
    );
    
    res.json({
      success: true,
      messages: messages.rows.reverse(), // Reverse to get chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Error getting support messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get support messages'
    });
  }
});

/**
 * POST /api/user/chat/support/messages
 * Send message to support
 */
router.post('/support/messages', protect, messageLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, messageType = 'text' } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    // Get or create support conversation
    const convResult = await db.query(
      'SELECT get_or_create_support_conversation($1) as conversation_id',
      [userId]
    );
    
    const conversationId = convResult.rows[0].conversation_id;
    
    // Insert message
    const messageResult = await db.query(`
      INSERT INTO chat_dm_messages (
        conversation_id, 
        sender_id, 
        sender_type, 
        message, 
        message_type, 
        created_at
      ) VALUES ($1, $2, 'real_user', $3, $4, NOW()) 
      RETURNING id, created_at
    `, [conversationId, userId, content.trim(), messageType]);
    
    const message = {
      id: messageResult.rows[0].id,
      content: content.trim(),
      message_type: messageType,
      created_at: messageResult.rows[0].created_at,
      sender_type: 'real_user',
      sender_name: req.user.username,
      sender_avatar: req.user.avatar_url
    };
    
    // TODO: Emit Socket.IO event for real-time updates
    // io.to(`support-conversation-${conversationId}`).emit('new-message', message);
    
    res.json({
      success: true,
      message
    });
    
  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// =============================================
// FAKE USER DM API
// =============================================

/**
 * POST /api/user/chat/fake-user-dm/:fakeUserId
 * Start or get DM conversation with a fake user
 */
router.post('/fake-user-dm/:fakeUserId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fakeUserId } = req.params;
    
    if (!fakeUserId) {
      return res.status(400).json({
        success: false,
        message: 'Fake user ID is required'
      });
    }
    
    // Verify fake user exists and is active
    const fakeUserCheck = await db.query(
      'SELECT id, username, display_name, avatar_url FROM chat_fake_users WHERE id = $1 AND is_active = TRUE',
      [fakeUserId]
    );
    
    if (fakeUserCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fake user not found or inactive'
      });
    }
    
    const fakeUser = fakeUserCheck.rows[0];
    
    // Get or create conversation
    const convResult = await db.query(
      'SELECT get_or_create_fake_user_conversation($1, $2) as conversation_id',
      [userId, fakeUserId]
    );
    
    const conversationId = convResult.rows[0].conversation_id;
    
    // Get conversation details
    const conversationDetails = await db.query(`
      SELECT 
        c.id,
        c.created_at,
        c.last_message_at,
        $2 as name,
        $3 as avatar_url,
        'fake_user_dm' as conversation_type
      FROM chat_dm_conversations c
      WHERE c.id = $1
    `, [conversationId, fakeUser.display_name || fakeUser.username, fakeUser.avatar_url]);
    
    res.json({
      success: true,
      conversation: conversationDetails.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating fake user DM:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation'
    });
  }
});

/**
 * GET /api/user/chat/direct-messages
 * List user's DM conversations (including fake users)
 */
router.get('/direct-messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const conversations = await db.query(`
      SELECT 
        c.id,
        c.created_at,
        c.last_message_at,
        c.conversation_type,
        c.user2_type,
        CASE 
          WHEN c.user2_type = 'real_user' THEN u2.username
          WHEN c.user2_type = 'fake_user' THEN COALESCE(fu.display_name, fu.username)
          WHEN c.user2_type = 'support' THEN 'Help & Support'
          ELSE 'Unknown'
        END as name,
        CASE 
          WHEN c.user2_type = 'real_user' THEN u2.avatar_url
          WHEN c.user2_type = 'fake_user' THEN fu.avatar_url
          WHEN c.user2_type = 'support' THEN '/images/avatars/support-agent.png'
          ELSE NULL
        END as avatar_url,
        -- Last message preview
        (SELECT message FROM chat_dm_messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC LIMIT 1) as last_message,
        -- Unread count for this user
        (SELECT COUNT(*) FROM chat_dm_messages m
         WHERE m.conversation_id = c.id 
           AND m.sender_type != 'real_user' 
           AND m.is_read = FALSE) as unread_count
      FROM chat_dm_conversations c
      LEFT JOIN users u2 ON c.user_id_2 = u2.id AND c.user2_type = 'real_user'
      LEFT JOIN chat_fake_users fu ON c.fake_user_id = fu.id AND c.user2_type = 'fake_user'
      WHERE c.user_id_1 = $1 AND c.status = 'active'
      ORDER BY c.last_message_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      conversations: conversations.rows
    });
    
  } catch (error) {
    console.error('Error getting DM conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations'
    });
  }
});

/**
 * GET /api/user/chat/direct-messages/:id/messages
 * Get messages from a specific DM conversation
 */
router.get('/direct-messages/:id/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    // Verify user has access to this conversation
    const accessCheck = await db.query(
      'SELECT 1 FROM chat_dm_conversations WHERE id = $1 AND user_id_1 = $2',
      [conversationId, userId]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }
    
    // Get messages
    const messages = await db.query(`
      SELECT 
        m.id,
        m.message as content,
        m.message_type,
        m.attachment_url,
        m.created_at,
        m.sender_type,
        CASE 
          WHEN m.sender_type = 'real_user' THEN u.username
          WHEN m.sender_type = 'fake_user' THEN COALESCE(fu.display_name, fu.username)
          ELSE 'Support'
        END as sender_name,
        CASE 
          WHEN m.sender_type = 'real_user' THEN u.avatar_url
          WHEN m.sender_type = 'fake_user' THEN fu.avatar_url
          ELSE '/images/avatars/support-agent.png'
        END as sender_avatar,
        m.is_notification
      FROM chat_dm_messages m
      LEFT JOIN users u ON m.sender_id = u.id AND m.sender_type = 'real_user'
      LEFT JOIN chat_fake_users fu ON m.fake_user_sender_id = fu.id AND m.sender_type = 'fake_user'
      WHERE m.conversation_id = $1 AND m.status != 'deleted'
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);
    
    // Mark messages as read
    await db.query(`
      UPDATE chat_dm_messages 
      SET is_read = TRUE 
      WHERE conversation_id = $1 AND sender_type != 'real_user' AND is_read = FALSE
    `, [conversationId]);
    
    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM chat_dm_messages WHERE conversation_id = $1 AND status != \'deleted\'',
      [conversationId]
    );
    
    res.json({
      success: true,
      messages: messages.rows.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Error getting DM messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages'
    });
  }
});

/**
 * POST /api/user/chat/direct-messages/:id/messages
 * Send message in DM conversation
 */
router.post('/direct-messages/:id/messages', protect, messageLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const { content, messageType = 'text' } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    // Verify user has access to this conversation
    const accessCheck = await db.query(
      'SELECT 1 FROM chat_dm_conversations WHERE id = $1 AND user_id_1 = $2 AND status = \'active\'',
      [conversationId, userId]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }
    
    // Insert message
    const messageResult = await db.query(`
      INSERT INTO chat_dm_messages (
        conversation_id, 
        sender_id, 
        sender_type, 
        message, 
        message_type, 
        created_at
      ) VALUES ($1, $2, 'real_user', $3, $4, NOW()) 
      RETURNING id, created_at
    `, [conversationId, userId, content.trim(), messageType]);
    
    const message = {
      id: messageResult.rows[0].id,
      content: content.trim(),
      message_type: messageType,
      created_at: messageResult.rows[0].created_at,
      sender_type: 'real_user',
      sender_name: req.user.username,
      sender_avatar: req.user.avatar_url
    };
    
    // TODO: Emit Socket.IO event for real-time updates
    // io.to(`dm-conversation-${conversationId}`).emit('new-message', message);
    
    res.json({
      success: true,
      message
    });
    
  } catch (error) {
    console.error('Error sending DM message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// =============================================
// ADMIN NOTIFICATION API
// =============================================

/**
 * POST /api/admin/chat/notifications
 * Send notification to user's personal group
 */
router.post('/notifications', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { userId, content, notificationStyle = {} } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({
        success: false,
        message: 'User ID and content are required'
      });
    }
    
    // Find user's personal group (assuming there's a way to identify personal groups)
    // This might need adjustment based on your group structure
    const personalGroupResult = await db.query(`
      SELECT cg.id 
      FROM chat_groups cg
      JOIN chat_group_members cgm ON cg.id = cgm.group_id
      WHERE cgm.user_id = $1 
        AND cg.group_type = 'personal' 
        AND cg.is_active = TRUE
      LIMIT 1
    `, [userId]);
    
    if (personalGroupResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User personal group not found'
      });
    }
    
    const groupId = personalGroupResult.rows[0].id;
    
    // Insert notification message
    const messageResult = await db.query(`
      INSERT INTO chat_messages (
        group_id,
        content,
        sent_by_admin,
        admin_id,
        is_notification,
        is_admin_notification,
        notification_style,
        created_at
      ) VALUES ($1, $2, true, $3, true, true, $4, NOW())
      RETURNING id, created_at
    `, [groupId, content.trim(), adminId, JSON.stringify(notificationStyle)]);
    
    const notification = {
      id: messageResult.rows[0].id,
      content: content.trim(),
      notification_style: notificationStyle,
      created_at: messageResult.rows[0].created_at,
      group_id: groupId
    };
    
    // TODO: Emit Socket.IO event for real-time updates
    // io.to(`group-${groupId}`).emit('admin-notification', notification);
    
    res.json({
      success: true,
      notification
    });
    
  } catch (error) {
    console.error('Error sending admin notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
});

// =============================================
// ADMIN DM MANAGEMENT API
// =============================================

/**
 * GET /api/admin/chat/support
 * List all support conversations for admin
 */
router.get('/admin/support', authenticateAdmin, async (req, res) => {
  try {
    const conversations = await db.query(`
      SELECT * FROM admin_support_conversations
      ORDER BY 
        CASE WHEN unread_count > 0 THEN 0 ELSE 1 END,
        last_message_at DESC
    `);
    
    res.json({
      success: true,
      conversations: conversations.rows
    });
    
  } catch (error) {
    console.error('Error getting support conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get support conversations'
    });
  }
});

/**
 * POST /api/admin/chat/support/:id/messages
 * Respond to support ticket
 */
router.post('/admin/support/:id/messages', authenticateAdmin, messageLimiter, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { content, messageType = 'text', personaId } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    // Verify conversation exists and is support type
    const convCheck = await db.query(
      'SELECT 1 FROM chat_dm_conversations WHERE id = $1 AND is_support_conversation = TRUE',
      [conversationId]
    );
    
    if (convCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Support conversation not found'
      });
    }
    
    let senderType = 'support';
    let senderId = req.user.id;
    let fakeUserSenderId = null;
    
    // If persona specified, use fake user
    if (personaId) {
      const personaCheck = await db.query(
        'SELECT id FROM chat_fake_users WHERE id = $1 AND is_active = TRUE',
        [personaId]
      );
      
      if (personaCheck.rows.length > 0) {
        senderType = 'fake_user';
        senderId = null;
        fakeUserSenderId = personaId;
      }
    }
    
    // Insert response message
    const messageResult = await db.query(`
      INSERT INTO chat_dm_messages (
        conversation_id, 
        sender_id, 
        sender_type, 
        fake_user_sender_id,
        message, 
        message_type, 
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
      RETURNING id, created_at
    `, [conversationId, senderId, senderType, fakeUserSenderId, content.trim(), messageType]);
    
    const message = {
      id: messageResult.rows[0].id,
      content: content.trim(),
      message_type: messageType,
      created_at: messageResult.rows[0].created_at,
      sender_type: senderType
    };
    
    // TODO: Emit Socket.IO event for real-time updates
    // io.to(`support-conversation-${conversationId}`).emit('new-message', message);
    
    res.json({
      success: true,
      message
    });
    
  } catch (error) {
    console.error('Error sending support response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send response'
    });
  }
});

/**
 * GET /api/admin/chat/direct-messages
 * List all DM conversations for admin monitoring
 */
router.get('/admin/direct-messages', authenticateAdmin, async (req, res) => {
  try {
    const conversations = await db.query(`
      SELECT * FROM admin_fake_user_dms
      ORDER BY last_message_at DESC
    `);
    
    res.json({
      success: true,
      conversations: conversations.rows
    });
    
  } catch (error) {
    console.error('Error getting admin DM conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get DM conversations'
    });
  }
});

module.exports = router;

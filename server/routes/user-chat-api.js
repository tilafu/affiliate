/**
 * User Chat API Routes
 * Handles user-facing chat functionality (not admin)
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getUserGroups } = require('../services/user-group-service');
const db = require('../db');

/**
 * GET /api/user/chat/groups
 * Get all groups that the authenticated user has access to
 */
router.get('/groups', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await getUserGroups(userId);
    
    res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups'
    });
  }
});

/**
 * GET /api/user/chat/groups/:groupId/messages
 * Get messages for a specific group (with pagination)
 */
router.get('/groups/:groupId/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Verify user has access to this group
    const memberCheck = await db.query(`
      SELECT 1 FROM chat_group_members 
      WHERE group_id = $1 AND user_id = $2
    `, [groupId, userId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this group'
      });
    }

    // Get messages with user/fake user details including avatars
    const messagesQuery = `
      SELECT 
        cm.id,
        cm.group_id,
        cm.content,
        cm.media_url,
        cm.media_type,
        cm.created_at,
        cm.updated_at,
        cm.is_pinned,
        CASE 
          WHEN cm.user_id IS NOT NULL THEN 'real_user'
          ELSE 'fake_user'
        END as sender_type,
        COALESCE(u.username, cfu.display_name) as sender_name,
        COALESCE(u.id, cfu.id) as sender_id,
        COALESCE(
          u.avatar_url, 
          u.profile_image_url, 
          u.profile_image,
          cfu.avatar_url, 
          '/assets/uploads/user.jpg'
        ) as sender_avatar
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      LEFT JOIN chat_fake_users cfu ON cm.fake_user_id = cfu.id
      WHERE cm.group_id = $1
      ORDER BY cm.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const messages = await db.query(messagesQuery, [groupId, limit, offset]);

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM chat_messages
      WHERE group_id = $1
    `, [groupId]);

    const totalMessages = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      success: true,
      messages: messages.rows.reverse(), // Reverse to show oldest first
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMessages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

/**
 * POST /api/user/chat/groups/:groupId/messages
 * Send a message to a group
 */
router.post('/groups/:groupId/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { content, mediaUrl, mediaType = 'text' } = req.body;

    if (!content && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Message content or media is required'
      });
    }

    // Verify user has access to this group
    const memberCheck = await db.query(`
      SELECT 1 FROM chat_group_members 
      WHERE group_id = $1 AND user_id = $2
    `, [groupId, userId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this group'
      });
    }

    // Insert message
    const messageResult = await db.query(`
      INSERT INTO chat_messages (group_id, user_id, content, media_url, media_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, group_id, user_id, content, media_url, media_type, created_at
    `, [groupId, userId, content, mediaUrl, mediaType]);

    const newMessage = messageResult.rows[0];

    // Get sender details for real-time broadcast
    const senderResult = await db.query(`
      SELECT username FROM users WHERE id = $1
    `, [userId]);

    const messageWithSender = {
      ...newMessage,
      sender_type: 'real_user',
      sender_name: senderResult.rows[0].username,
      sender_id: userId
    };

    // TODO: Broadcast via Socket.io
    // const io = req.app.get('io');
    // if (io) {
    //   io.to(`group_${groupId}`).emit('new_message', messageWithSender);
    // }

    res.status(201).json({
      success: true,
      message: messageWithSender
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

/**
 * GET /api/user/chat/groups/:groupId/members
 * Get members of a specific group (for DM initiation)
 */
router.get('/groups/:groupId/members', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    // Verify user has access to this group
    const memberCheck = await db.query(`
      SELECT 1 FROM chat_group_members 
      WHERE group_id = $1 AND user_id = $2
    `, [groupId, userId]);

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this group'
      });
    }

    // Get all members (real and fake users)
    const membersQuery = `
      SELECT 
        COALESCE(u.id, cfu.id) as id,
        COALESCE(u.username, cfu.username) as username,
        COALESCE(u.username, cfu.display_name) as display_name,
        cfu.avatar_url,
        CASE 
          WHEN cgm.user_id IS NOT NULL THEN 'real_user'
          ELSE 'fake_user'
        END as user_type,
        cgm.join_date,
        cgm.role
      FROM chat_group_members cgm
      LEFT JOIN users u ON cgm.user_id = u.id
      LEFT JOIN chat_fake_users cfu ON cgm.fake_user_id = cfu.id
      WHERE cgm.group_id = $1 AND COALESCE(u.id, cfu.id) != $2
      ORDER BY 
        user_type DESC, -- fake users first
        COALESCE(u.username, cfu.display_name) ASC
    `;

    const members = await db.query(membersQuery, [groupId, userId]);

    res.json({
      success: true,
      members: members.rows
    });

  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group members'
    });
  }
});

module.exports = router;

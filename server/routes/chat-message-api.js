/**
 * Admin Chat API Routes - Message Management
 * This file contains the server-side routes for managing chat messages
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/admin-auth');

// Error handling middleware
const handleErrors = (err, req, res, next) => {
  console.error('Chat Message API Error:', err);
  res.status(500).json({ error: err.message });
};

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

/**
 * Get all messages for a group
 * GET /api/admin/chat/groups/:groupId/messages
 */
router.get('/groups/:groupId/messages', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, before, after } = req.query;
    
    // Validate group exists
    const groupExists = await pool.query('SELECT id FROM chat_groups WHERE id = $1', [groupId]);
    if (groupExists.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    let query = `
      SELECT 
        m.id, m.content, m.message_type, m.created_at, m.user_id, m.user_type,
        CASE 
          WHEN m.user_type = 'fake_user' THEN fu.display_name
          WHEN m.user_type = 'admin' THEN a.username
          ELSE 'Unknown'
        END as display_name,
        CASE 
          WHEN m.user_type = 'fake_user' THEN fu.avatar_url
          ELSE NULL
        END as avatar_url
      FROM chat_messages m
      LEFT JOIN chat_fake_users fu ON m.user_id = fu.id AND m.user_type = 'fake_user'
      LEFT JOIN users a ON m.user_id = a.id AND m.user_type = 'admin'
      WHERE m.group_id = $1
    `;
    
    const params = [groupId];
    
    // Add time filters if provided
    if (before) {
      query += ' AND m.created_at < $2';
      params.push(before);
    } else if (after) {
      query += ' AND m.created_at > $2';
      params.push(after);
    }
    
    // Add order and limit
    query += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const { rows } = await pool.query(query, params);
    
    // Get total message count for pagination
    const countResult = await pool.query('SELECT COUNT(*) FROM chat_messages WHERE group_id = $1', [groupId]);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      messages: rows,
      pagination: {
        total: totalCount,
        returned: rows.length
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Send a message in a group
 * POST /api/admin/chat/groups/:groupId/messages
 */
router.post('/groups/:groupId/messages', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { user_id, user_type, content, message_type = 'text' } = req.body;
    
    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    if (!user_id || !user_type) {
      return res.status(400).json({ error: 'User ID and user type are required' });
    }
    
    // Validate user type
    if (user_type !== 'fake_user' && user_type !== 'admin') {
      return res.status(400).json({ error: 'Invalid user type' });
    }
    
    // Validate group exists
    const groupExists = await pool.query('SELECT id FROM chat_groups WHERE id = $1', [groupId]);
    if (groupExists.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Validate user exists
    let userExists;
    if (user_type === 'fake_user') {
      userExists = await pool.query('SELECT id FROM chat_fake_users WHERE id = $1', [user_id]);
    } else {
      userExists = await pool.query('SELECT id FROM users WHERE id = $1 AND role = $2', [user_id, 'admin']);
    }
    
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Validate message type
    const validMessageTypes = ['text', 'image', 'link'];
    if (!validMessageTypes.includes(message_type)) {
      return res.status(400).json({ error: 'Invalid message type' });
    }
    
    // Check if user is a member of the group (for fake users)
    if (user_type === 'fake_user') {
      const memberExists = await pool.query(
        'SELECT id FROM chat_group_members WHERE group_id = $1 AND user_id = $2 AND user_type = $3',
        [groupId, user_id, user_type]
      );
      
      if (memberExists.rows.length === 0) {
        // If not a member, add them to the group
        await pool.query(
          'INSERT INTO chat_group_members (group_id, user_id, user_type) VALUES ($1, $2, $3)',
          [groupId, user_id, user_type]
        );
      }
    }
    
    // Insert message
    const query = `
      INSERT INTO chat_messages (group_id, user_id, user_type, content, message_type, admin_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      groupId,
      user_id,
      user_type,
      content,
      message_type,
      req.admin.id // Admin who sent the message
    ]);
    
    // Update group's last_activity
    await pool.query('UPDATE chat_groups SET last_activity = NOW() WHERE id = $1', [groupId]);
    
    // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.admin.id,
        'POST_AS_FAKE_USER',
        'chat_message',
        rows[0].id,
        JSON.stringify({
          group_id: groupId,
          fake_user_id: user_type === 'fake_user' ? user_id : null,
          message_type
        })
      ]
    );
    
    // Get user details for response
    let userDetails = {};
    if (user_type === 'fake_user') {
      const userResult = await pool.query('SELECT display_name, avatar_url FROM chat_fake_users WHERE id = $1', [user_id]);
      if (userResult.rows.length > 0) {
        userDetails = {
          display_name: userResult.rows[0].display_name,
          avatar_url: userResult.rows[0].avatar_url
        };
      }
    } else {
      const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [user_id]);
      if (userResult.rows.length > 0) {
        userDetails = {
          display_name: userResult.rows[0].username,
          avatar_url: null
        };
      }
    }
    
    res.status(201).json({
      message: {
        ...rows[0],
        ...userDetails
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a message
 * DELETE /api/admin/chat/messages/:messageId
 */
router.delete('/messages/:messageId', async (req, res, next) => {
  try {
    const { messageId } = req.params;
    
    // Get message details before deletion
    const messageResult = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [messageId]);
    
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = messageResult.rows[0];
    
    // Delete message
    await pool.query('DELETE FROM chat_messages WHERE id = $1', [messageId]);
    
    // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        req.admin.id,
        'DELETE_MESSAGE',
        'chat_message',
        messageId,
        JSON.stringify({
          group_id: message.group_id,
          user_id: message.user_id,
          user_type: message.user_type
        })
      ]
    );
    
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// Apply error handling middleware
router.use(handleErrors);

module.exports = router;

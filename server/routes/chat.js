/**
 * Chat API Routes
 * Handles chat group management, messages, and media uploads
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middlewares/auth');
const { authenticateAdmin } = require('../middleware/admin-auth');
const db = require('../db');

// Rate limiting for message sending
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (error) {
  console.warn('express-rate-limit not installed, using fallback implementation');
  // Fallback implementation of rate limiting middleware
  rateLimit = (options) => {
    return (req, res, next) => {
      next(); // Simply pass through without rate limiting
    };
  };
}

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { error: 'Too many messages sent. Please try again later.' }
});

// Configure file storage for chat media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'chat');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, uniqueName);
  }
});

// Filter allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  }
});

// Get all chat groups for the current user
router.get('/groups', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Get all groups where the user is a member
    const result = await db.query(
      `SELECT g.id, 
              CASE 
                WHEN $2 = true THEN g.name
                ELSE 'Affiliates Community'
              END as name,
              g.group_type, 
              COALESCE(g.avatar_url, '/assets/uploads/user.jpg') as avatar_url, 
              g.created_at,
              COUNT(DISTINCT gm.user_id) as member_count,
              (SELECT COUNT(*) FROM chat_messages cm 
               WHERE cm.group_id = g.id 
               AND cm.created_at > (SELECT last_read_at FROM chat_group_members 
                                    WHERE group_id = g.id AND user_id = $1)
              ) as unread_count,
              (SELECT jsonb_build_object(
                  'id', cm.id,
                  'content', cm.content,
                  'created_at', cm.created_at,
                  'user_id', cm.user_id,
                  'fake_user_id', cm.fake_user_id
               )
               FROM chat_messages cm
               WHERE cm.group_id = g.id
               ORDER BY cm.created_at DESC
               LIMIT 1
              ) as last_message
       FROM chat_groups g
       JOIN chat_group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       GROUP BY g.id
       ORDER BY (SELECT MAX(created_at) FROM chat_messages WHERE group_id = g.id) DESC NULLS LAST,
                g.created_at DESC`,
      [userId, isAdmin]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chat groups:', error);
    res.status(500).json({ error: 'Failed to fetch chat groups' });
  }
});

// Get a specific chat group
router.get('/groups/:id', protect, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Check if user is a member of the group
    const memberCheck = await db.query(
      'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    
    // Get group details with conditional naming
    const result = await db.query(
      `SELECT g.id, 
              CASE 
                WHEN $3 = true THEN g.name
                ELSE 'Affiliates Community'
              END as name,
              g.description, 
              g.group_type, 
              COALESCE(g.avatar_url, '/assets/uploads/user.jpg') as avatar_url, 
              g.created_at,
              COUNT(DISTINCT gm.user_id) as member_count
       FROM chat_groups g
       JOIN chat_group_members gm ON g.id = gm.group_id
       WHERE g.id = $1
       GROUP BY g.id`,
      [groupId, userId, isAdmin]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Update last read timestamp for this user
    await db.query(
      'UPDATE chat_group_members SET last_read_at = NOW() WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching chat group:', error);
    res.status(500).json({ error: 'Failed to fetch chat group details' });
  }
});

// Get messages for a specific group
router.get('/groups/:id/messages', protect, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    // Check if user is a member of the group
    const memberCheck = await db.query(
      'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    
    // Pagination parameters
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Get messages
    const result = await db.query(
      `SELECT m.id, m.content, m.created_at, m.media_url, m.media_type,
              m.user_id, u.username as user_username,
              m.fake_user_id, fu.display_name as fake_user_display_name
       FROM chat_messages m
       LEFT JOIN users u ON m.user_id = u.id
       LEFT JOIN chat_fake_users fu ON m.fake_user_id = fu.id
       WHERE m.group_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );
    
    // Reverse the messages to have them in chronological order
    const messages = result.rows.reverse();
    
    // Update last read timestamp for this user
    await db.query(
      'UPDATE chat_group_members SET last_read_at = NOW() WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message to a group
router.post('/groups/:id/messages', protect, messageLimiter, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { content, media_url, media_type, fake_user_id } = req.body;
    
    // Validate input
    if (!content && !media_url) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }
    
    // Check if user is a member of the group or an admin
    const memberCheck = await db.query(
      'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    const isAdmin = req.user.role === 'admin';
    
    if (memberCheck.rows.length === 0 && !isAdmin) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    
    // If a fake user ID is provided, verify that the user is an admin
    if (fake_user_id && !isAdmin) {
      return res.status(403).json({ error: 'Only admins can send messages as fake users' });
    }
    
    // Insert the message
    const messageResult = await db.query(
      `INSERT INTO chat_messages (
        group_id, content, user_id, admin_id, fake_user_id, 
        media_url, media_type, sent_by_admin, created_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, content, created_at, media_url, media_type, user_id, fake_user_id`,
      [
        groupId, 
        content || '', 
        fake_user_id ? null : userId, 
        isAdmin ? userId : null,
        fake_user_id,
        media_url,
        media_type,
        isAdmin
      ]
    );
    
    // Get additional info for the response
    const message = messageResult.rows[0];
    
    // Add username info
    if (message.user_id) {
      const userResult = await db.query(
        'SELECT username FROM users WHERE id = $1',
        [message.user_id]
      );
      if (userResult.rows.length > 0) {
        message.user_username = userResult.rows[0].username;
      }
    }
    
    // Add fake user info
    if (message.fake_user_id) {
      const fakeUserResult = await db.query(
        'SELECT display_name FROM chat_fake_users WHERE id = $1',
        [message.fake_user_id]
      );
      if (fakeUserResult.rows.length > 0) {
        message.fake_user_display_name = fakeUserResult.rows[0].display_name;
      }
    }
    
    // Emit the message via Socket.IO (will be handled in server.js)
    req.app.get('io').to(`group:${groupId}`).emit('new-message', message);
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Upload media for a chat message
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Create public URL for the file
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    
    res.json({
      url: fileUrl,
      type: req.file.mimetype,
      size: req.file.size,
      name: req.file.originalname
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Mark a message as read
router.post('/messages/:id/read', protect, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;
    
    // Get the group ID for this message
    const messageResult = await db.query(
      'SELECT group_id FROM chat_messages WHERE id = $1',
      [messageId]
    );
    
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const groupId = messageResult.rows[0].group_id;
    
    // Update the last read timestamp for this user in this group
    await db.query(
      'UPDATE chat_group_members SET last_read_at = NOW() WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    // Emit read receipt via Socket.IO
    req.app.get('io').to(`group:${groupId}`).emit('message-read', {
      message_id: messageId,
      user_id: userId,
      group_id: groupId
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Get members of a group
router.get('/groups/:id/members', protect, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Check if user is a member of the group
    const memberCheck = await db.query(
      'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    
    // Get real members
    const realMembers = await db.query(
      `SELECT u.id, u.username, u.full_name, 
              COALESCE(u.avatar_url, '/assets/uploads/user.jpg') as avatar_url, 
              gm.role as group_role,
              COALESCE(u.full_name, u.username) as name,
              'real' as type
       FROM chat_group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [groupId]
    );
    
    let members = realMembers.rows;
    
    // Only include fake members for admins
    if (isAdmin) {
      const fakeMembers = await db.query(
        `SELECT fu.id, 
                REPLACE(fu.display_name, 'bot_', '') as username,
                REPLACE(fu.display_name, 'bot_', '') as name,
                COALESCE(fu.avatar_url, '/assets/uploads/user.jpg') as avatar_url, 
                'fake' as type,
                'fake' as group_role
         FROM chat_fake_users fu
         JOIN chat_group_fake_members gfm ON fu.id = gfm.fake_user_id
         WHERE gfm.group_id = $1`,
        [groupId]
      );
      
      members = [...members, ...fakeMembers.rows];
    }
    
    res.json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

// ADMIN ROUTES - All require admin authentication

// Create a new chat group
router.post('/admin/groups', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, group_type, user_id } = req.body;
    const adminId = req.admin.id;
    
    // Validate input
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    
    // Start a database transaction
    await db.query('BEGIN');
    
    // Create the group
    const groupResult = await db.query(
      `INSERT INTO chat_groups (name, description, group_type, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, description, group_type, created_at`,
      [name, description, group_type || 'standard', adminId]
    );
    
    const groupId = groupResult.rows[0].id;
    
    // If user_id is provided, add them as a member
    if (user_id) {
      await db.query(
        `INSERT INTO chat_group_members (group_id, user_id, role, joined_at, last_read_at)
         VALUES ($1, $2, 'member', NOW(), NOW())`,
        [groupId, user_id]
      );
      
      // Log the action
      await db.query(
        `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
         VALUES ($1, 'create', 'group', $2, NOW(), $3)`,
        [adminId, groupId, JSON.stringify({ user_id, action: 'added_user_to_new_group' })]
      );
    }
    
    // Add fake users to the group (about 20)
    const fakeUsersResult = await db.query(
      'SELECT id FROM chat_fake_users ORDER BY RANDOM() LIMIT 20'
    );
    
    for (const fakeUser of fakeUsersResult.rows) {
      await db.query(
        `INSERT INTO chat_group_fake_members (group_id, fake_user_id, added_at, added_by)
         VALUES ($1, $2, NOW(), $3)`,
        [groupId, fakeUser.id, adminId]
      );
    }
    
    // Commit the transaction
    await db.query('COMMIT');
    
    // Return the created group
    res.status(201).json(groupResult.rows[0]);
  } catch (error) {
    // Rollback the transaction on error
    await db.query('ROLLBACK');
    console.error('Error creating chat group:', error);
    res.status(500).json({ error: 'Failed to create chat group' });
  }
});

// Add a member to a group
router.post('/admin/groups/:id/members', authenticateAdmin, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { user_id, role } = req.body;
    const adminId = req.admin.id;
    
    // Validate input
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user exists
    const userCheck = await db.query('SELECT 1 FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is already a member
    const memberCheck = await db.query(
      'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, user_id]
    );
    
    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this group' });
    }
    
    // Add user to the group
    await db.query(
      `INSERT INTO chat_group_members (group_id, user_id, role, joined_at, last_read_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [groupId, user_id, role || 'member']
    );
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'add_member', 'group', $2, NOW(), $3)`,
      [adminId, groupId, JSON.stringify({ user_id, role })]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding member to group:', error);
    res.status(500).json({ error: 'Failed to add member to group' });
  }
});

// Remove a member from a group
router.delete('/admin/groups/:groupId/members/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const adminId = req.admin.id;
    
    // Remove user from the group
    const result = await db.query(
      'DELETE FROM chat_group_members WHERE group_id = $1 AND user_id = $2 RETURNING 1',
      [groupId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'remove_member', 'group', $2, NOW(), $3)`,
      [adminId, groupId, JSON.stringify({ user_id: userId })]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member from group:', error);
    res.status(500).json({ error: 'Failed to remove member from group' });
  }
});

// Add a fake user to a group
router.post('/admin/groups/:id/fake-members', authenticateAdmin, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { fake_user_id } = req.body;
    const adminId = req.admin.id;
    
    // Validate input
    if (!fake_user_id) {
      return res.status(400).json({ error: 'Fake user ID is required' });
    }
    
    // Check if fake user exists
    const fakeUserCheck = await db.query(
      'SELECT 1 FROM chat_fake_users WHERE id = $1',
      [fake_user_id]
    );
    
    if (fakeUserCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Fake user not found' });
    }
    
    // Check if fake user is already in the group
    const memberCheck = await db.query(
      'SELECT 1 FROM chat_group_fake_members WHERE group_id = $1 AND fake_user_id = $2',
      [groupId, fake_user_id]
    );
    
    if (memberCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Fake user is already in this group' });
    }
    
    // Add fake user to the group
    await db.query(
      `INSERT INTO chat_group_fake_members (group_id, fake_user_id, added_at, added_by)
       VALUES ($1, $2, NOW(), $3)`,
      [groupId, fake_user_id, adminId]
    );
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'add_fake_member', 'group', $2, NOW(), $3)`,
      [adminId, groupId, JSON.stringify({ fake_user_id })]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding fake user to group:', error);
    res.status(500).json({ error: 'Failed to add fake user to group' });
  }
});

// Remove a fake user from a group
router.delete('/admin/groups/:groupId/fake-members/:fakeUserId', authenticateAdmin, async (req, res) => {
  try {
    const { groupId, fakeUserId } = req.params;
    const adminId = req.admin.id;
    
    // Remove fake user from the group
    const result = await db.query(
      'DELETE FROM chat_group_fake_members WHERE group_id = $1 AND fake_user_id = $2 RETURNING 1',
      [groupId, fakeUserId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fake user is not in this group' });
    }
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'remove_fake_member', 'group', $2, NOW(), $3)`,
      [adminId, groupId, JSON.stringify({ fake_user_id: fakeUserId })]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing fake user from group:', error);
    res.status(500).json({ error: 'Failed to remove fake user from group' });
  }
});

// Delete a message
router.delete('/admin/messages/:id', authenticateAdmin, async (req, res) => {
  try {
    const messageId = req.params.id;
    const adminId = req.admin.id;
    
    // Get message details before deletion for logging
    const messageResult = await db.query(
      'SELECT group_id, user_id, fake_user_id FROM chat_messages WHERE id = $1',
      [messageId]
    );
    
    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const messageDetails = messageResult.rows[0];
    
    // Delete the message
    await db.query('DELETE FROM chat_messages WHERE id = $1', [messageId]);
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'delete_message', 'message', $2, NOW(), $3)`,
      [adminId, messageId, JSON.stringify({
        group_id: messageDetails.group_id,
        user_id: messageDetails.user_id,
        fake_user_id: messageDetails.fake_user_id
      })]
    );
    
    // Notify clients about the deleted message
    req.app.get('io').to(`group:${messageDetails.group_id}`).emit('message-deleted', {
      message_id: messageId,
      group_id: messageDetails.group_id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Create a fake user
router.post('/admin/fake-users', authenticateAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const { display_name, role } = req.body;
    const adminId = req.admin.id;
    
    // Validate input
    if (!display_name) {
      return res.status(400).json({ error: 'Display name is required' });
    }
    
    // Handle avatar file if uploaded
    let avatarUrl = null;
    if (req.file) {
      avatarUrl = `/uploads/chat/${req.file.filename}`;
    }
    
    // Create the fake user
    const result = await db.query(
      `INSERT INTO chat_fake_users (display_name, avatar_url, role, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, display_name, avatar_url, role, created_at`,
      [display_name, avatarUrl, role || 'member', adminId]
    );
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'create_fake_user', 'fake_user', $2, NOW(), $3)`,
      [adminId, result.rows[0].id, JSON.stringify({ display_name, role })]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating fake user:', error);
    res.status(500).json({ error: 'Failed to create fake user' });
  }
});

// Get all fake users
router.get('/admin/fake-users', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, display_name, avatar_url, role, created_at, created_by
       FROM chat_fake_users
       ORDER BY display_name ASC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching fake users:', error);
    res.status(500).json({ error: 'Failed to fetch fake users' });
  }
});

// Update a fake user
router.put('/admin/fake-users/:id', authenticateAdmin, upload.single('avatar'), async (req, res) => {
  try {
    const fakeUserId = req.params.id;
    const { display_name, role } = req.body;
    const adminId = req.admin.id;
    
    // Handle avatar file if uploaded
    let avatarUrl = undefined;
    if (req.file) {
      avatarUrl = `/uploads/chat/${req.file.filename}`;
    }
    
    // Build the update query dynamically based on provided fields
    let updateFields = [];
    let queryParams = [];
    let paramCounter = 1;
    
    if (display_name !== undefined) {
      updateFields.push(`display_name = $${paramCounter++}`);
      queryParams.push(display_name);
    }
    
    if (role !== undefined) {
      updateFields.push(`role = $${paramCounter++}`);
      queryParams.push(role);
    }
    
    if (avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramCounter++}`);
      queryParams.push(avatarUrl);
    }
    
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add fakeUserId as the last parameter
    queryParams.push(fakeUserId);
    
    // Execute the update
    const result = await db.query(
      `UPDATE chat_fake_users
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCounter}
       RETURNING id, display_name, avatar_url, role, created_at, updated_at`,
      queryParams
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fake user not found' });
    }
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'update_fake_user', 'fake_user', $2, NOW(), $3)`,
      [adminId, fakeUserId, JSON.stringify(req.body)]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating fake user:', error);
    res.status(500).json({ error: 'Failed to update fake user' });
  }
});

// Delete a fake user
router.delete('/admin/fake-users/:id', authenticateAdmin, async (req, res) => {
  try {
    const fakeUserId = req.params.id;
    const adminId = req.admin.id;
    
    // Start a transaction
    await db.query('BEGIN');
    
    // Remove fake user from all groups first
    await db.query(
      'DELETE FROM chat_group_fake_members WHERE fake_user_id = $1',
      [fakeUserId]
    );
    
    // Delete the fake user
    const result = await db.query(
      'DELETE FROM chat_fake_users WHERE id = $1 RETURNING id',
      [fakeUserId]
    );
    
    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Fake user not found' });
    }
    
    // Log the action
    await db.query(
      `INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, created_at, details)
       VALUES ($1, 'delete_fake_user', 'fake_user', $2, NOW(), $3)`,
      [adminId, fakeUserId, JSON.stringify({})]
    );
    
    // Commit the transaction
    await db.query('COMMIT');
    
    res.json({ success: true });
  } catch (error) {
    // Rollback on error
    await db.query('ROLLBACK');
    console.error('Error deleting fake user:', error);
    res.status(500).json({ error: 'Failed to delete fake user' });
  }
});

// Get available users for direct messaging (from user's groups)
router.get('/users', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all users from groups the current user is a member of
    const result = await db.query(
      `SELECT DISTINCT u.id, u.username, u.email, 
              COALESCE(u.full_name, u.username) as display_name,
              u.avatar_url,
              'user' as type,
              -- Check if there's an existing direct conversation
              (SELECT dm.id FROM direct_messages dm 
               WHERE (dm.user1_id = $1 AND dm.user2_id = u.id) 
                  OR (dm.user1_id = u.id AND dm.user2_id = $1)
               LIMIT 1) as conversation_id,
              -- Get last message in direct conversation
              (SELECT json_build_object(
                  'content', dmsg.content,
                  'created_at', dmsg.created_at,
                  'sender_id', dmsg.sender_id
               )
               FROM direct_messages dm
               JOIN direct_message_texts dmsg ON dm.id = dmsg.conversation_id
               WHERE (dm.user1_id = $1 AND dm.user2_id = u.id) 
                  OR (dm.user1_id = u.id AND dm.user2_id = $1)
               ORDER BY dmsg.created_at DESC
               LIMIT 1
              ) as last_message
       FROM users u
       JOIN chat_group_members gm1 ON u.id = gm1.user_id
       JOIN chat_group_members gm2 ON gm1.group_id = gm2.group_id
       WHERE gm2.user_id = $1 
         AND u.id != $1
         AND u.is_active = true
       ORDER BY u.username`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ error: 'Failed to fetch available users' });
  }
});

// Get all conversations (groups + direct messages) for the "All" tab
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Get all groups with conditional naming based on user role
    const groupsResult = await db.query(
      `SELECT g.id, 
              CASE 
                WHEN $2 = true THEN g.name
                ELSE 'Affiliates Community'
              END as name,
              g.group_type, 
              COALESCE(g.avatar_url, '/assets/uploads/user.jpg') as avatar_url, 
              g.created_at,
              'group' as type,
              COUNT(DISTINCT gm.user_id) as member_count,
              (SELECT COUNT(*) FROM chat_messages cm 
               WHERE cm.group_id = g.id 
               AND cm.created_at > COALESCE((SELECT last_read_at FROM chat_group_members 
                                    WHERE group_id = g.id AND user_id = $1), '1970-01-01')
              ) as unread_count,
              (SELECT json_build_object(
                  'id', cm.id,
                  'content', cm.content,
                  'created_at', cm.created_at,
                  'user_id', cm.user_id,
                  'fake_user_id', cm.fake_user_id
               )
               FROM chat_messages cm
               WHERE cm.group_id = g.id
               ORDER BY cm.created_at DESC
               LIMIT 1
              ) as last_message
       FROM chat_groups g
       JOIN chat_group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       GROUP BY g.id`,
      [userId, isAdmin]
    );
    
    // Get direct message conversations
    const directMessagesResult = await db.query(
      `SELECT dm.id, 
              CASE 
                WHEN dm.user1_id = $1 THEN u2.username 
                ELSE u1.username 
              END as name,
              CASE 
                WHEN dm.user1_id = $1 THEN COALESCE(u2.avatar_url, '/assets/uploads/user.jpg')
                ELSE COALESCE(u1.avatar_url, '/assets/uploads/user.jpg')
              END as avatar_url,
              dm.created_at,
              'direct' as type,
              2 as member_count,
              0 as unread_count, -- TODO: Implement unread count for DMs
              (SELECT json_build_object(
                  'id', dmsg.id,
                  'content', dmsg.content,
                  'created_at', dmsg.created_at,
                  'sender_id', dmsg.sender_id
               )
               FROM direct_message_texts dmsg
               WHERE dmsg.conversation_id = dm.id
               ORDER BY dmsg.created_at DESC
               LIMIT 1
              ) as last_message
       FROM direct_messages dm
       JOIN users u1 ON dm.user1_id = u1.id
       JOIN users u2 ON dm.user2_id = u2.id
       WHERE dm.user1_id = $1 OR dm.user2_id = $1`,
      [userId]
    );
    
    // Combine and sort by last activity
    const allConversations = [
      ...groupsResult.rows,
      ...directMessagesResult.rows
    ].sort((a, b) => {
      const aTime = a.last_message ? new Date(a.last_message.created_at) : new Date(a.created_at);
      const bTime = b.last_message ? new Date(b.last_message.created_at) : new Date(b.created_at);
      return bTime - aTime;
    });
    
    res.json(allConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Start or get a direct conversation with a user
router.post('/conversations/direct', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }
    
    if (targetUserId == userId) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }
    
    // Check if conversation already exists
    let conversationResult = await db.query(
      `SELECT id FROM direct_messages 
       WHERE (user1_id = $1 AND user2_id = $2) 
          OR (user1_id = $2 AND user2_id = $1)`,
      [userId, targetUserId]
    );
    
    let conversationId;
    
    if (conversationResult.rows.length > 0) {
      conversationId = conversationResult.rows[0].id;
    } else {
      // Create new conversation
      const newConversationResult = await db.query(
        'INSERT INTO direct_messages (user1_id, user2_id, created_at) VALUES ($1, $2, NOW()) RETURNING id',
        [Math.min(userId, targetUserId), Math.max(userId, targetUserId)]
      );
      conversationId = newConversationResult.rows[0].id;
    }
    
    // Get conversation details with the other user's info
    const conversationDetails = await db.query(
      `SELECT dm.id, 
              CASE 
                WHEN dm.user1_id = $1 THEN u2.username 
                ELSE u1.username 
              END as name,
              CASE 
                WHEN dm.user1_id = $1 THEN u2.avatar_url 
                ELSE u1.avatar_url 
              END as avatar_url,
              CASE 
                WHEN dm.user1_id = $1 THEN dm.user2_id 
                ELSE dm.user1_id 
              END as other_user_id
       FROM direct_messages dm
       JOIN users u1 ON dm.user1_id = u1.id
       JOIN users u2 ON dm.user2_id = u2.id
       WHERE dm.id = $2`,
      [userId, conversationId]
    );
    
    res.json(conversationDetails.rows[0]);
  } catch (error) {
    console.error('Error creating/getting direct conversation:', error);
    res.status(500).json({ error: 'Failed to create direct conversation' });
  }
});

// Get messages from a direct conversation
router.get('/conversations/direct/:id/messages', protect, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    
    // Verify user is part of this conversation
    const conversationCheck = await db.query(
      'SELECT 1 FROM direct_messages WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not part of this conversation' });
    }
    
    // Get messages
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const messagesResult = await db.query(
      `SELECT dmsg.id, dmsg.content, dmsg.media_url, dmsg.media_type, dmsg.created_at, dmsg.sender_id,
              u.username as sender_username
       FROM direct_message_texts dmsg
       JOIN users u ON dmsg.sender_id = u.id
       WHERE dmsg.conversation_id = $1
       ORDER BY dmsg.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    
    res.json(messagesResult.rows.reverse());
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    res.status(500).json({ error: 'Failed to fetch direct messages' });
  }
});

// Send a direct message
router.post('/conversations/direct/:id/messages', protect, messageLimiter, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    const { content, media_url, media_type } = req.body;
    
    // Check if we have either content or media
    if (!content && !media_url) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }
    
    // Verify user is part of this conversation
    const conversationCheck = await db.query(
      'SELECT user1_id, user2_id FROM direct_messages WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not part of this conversation' });
    }
    
    // Insert the message
    const messageResult = await db.query(
      `INSERT INTO direct_message_texts (conversation_id, sender_id, content, media_url, media_type, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, content, media_url, media_type, created_at, sender_id`,
      [conversationId, userId, content, media_url, media_type]
    );
    
    const message = messageResult.rows[0];
    
    // Add sender username
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length > 0) {
      message.sender_username = userResult.rows[0].username;
    }
    
    // Emit the message via Socket.IO
    req.app.get('io').to(`dm:${conversationId}`).emit('new-direct-message', message);
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending direct message:', error);
    res.status(500).json({ error: 'Failed to send direct message' });
  }
});

// Get unread message count for dashboard notification
router.get('/unread-count', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get unread count from groups
    const groupUnreadResult = await db.query(
      `SELECT COALESCE(SUM(
        (SELECT COUNT(*) FROM chat_messages cm 
         WHERE cm.group_id = g.id 
         AND cm.created_at > COALESCE(gm.last_read_at, '1970-01-01')
         AND cm.user_id != $1  -- Don't count own messages
        )
      ), 0) as unread_count
       FROM chat_groups g
       JOIN chat_group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [userId]
    );
    
    // Get unread count from direct messages
    const directUnreadResult = await db.query(
      `SELECT COALESCE(COUNT(*), 0) as unread_count
       FROM direct_message_texts dmsg
       JOIN direct_messages dm ON dmsg.conversation_id = dm.id
       WHERE (dm.user1_id = $1 OR dm.user2_id = $1)
         AND dmsg.sender_id != $1  -- Don't count own messages
         AND dmsg.is_read = false`,
      [userId]
    );
    
    const totalUnread = parseInt(groupUnreadResult.rows[0].unread_count) + 
                       parseInt(directUnreadResult.rows[0].unread_count);
    
    res.json({ unread_count: totalUnread });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Get group members
router.get('/groups/:groupId/members', protect, async (req, res) => {
    try {
        const { groupId } = req.params;
        const isAdmin = req.user.role === 'admin';
        
        const query = `
            SELECT 
                u.id,
                COALESCE(u.first_name || ' ' || u.last_name, u.username) as name,
                u.email,
                CASE 
                    WHEN cgm.role = 'admin' THEN 'Admin'
                    ELSE 'Member'
                END as role,
                COALESCE(u.profile_image, '/assets/uploads/user.jpg') as avatar_url
            FROM chat_group_members cgm
            JOIN users u ON cgm.user_id = u.id
            WHERE cgm.group_id = $1
            ORDER BY (CASE WHEN cgm.role = 'admin' THEN 0 ELSE 1 END), u.first_name ASC
        `;
        
        const result = await db.query(query, [groupId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ error: 'Failed to fetch group members' });
    }
});

// Create welcome direct message for new users
router.post('/welcome-message', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user already has any direct messages
    const existingConversations = await db.query(
      'SELECT id FROM direct_messages WHERE user1_id = $1 OR user2_id = $1 LIMIT 1',
      [userId]
    );
    
    if (existingConversations.rows.length > 0) {
      return res.status(400).json({ error: 'User already has direct messages' });
    }
    
    // Find an admin user to send the welcome message from
    const adminResult = await db.query(
      'SELECT id, username FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1',
      ['admin']
    );
    
    if (adminResult.rows.length === 0) {
      return res.status(500).json({ error: 'No admin user found' });
    }
    
    const admin = adminResult.rows[0];
    
    // Create the direct conversation
    const conversationResult = await db.query(
      `INSERT INTO direct_messages (user1_id, user2_id, created_at, updated_at) 
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id`,
      [admin.id, userId]
    );
    
    const conversationId = conversationResult.rows[0].id;
    
    // Send the welcome message
    const welcomeText = "Hey, welcome to the platform! These are the main groups we'll be using for our communication. Feel free to reach out if you have any questions.";
    
    const messageResult = await db.query(
      `INSERT INTO direct_message_texts (conversation_id, sender_id, content, created_at) 
       VALUES ($1, $2, $3, NOW())
       RETURNING id, content, created_at`,
      [conversationId, admin.id, welcomeText]
    );
    
    const message = messageResult.rows[0];
    
    // Get user details for the response
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    const otherUser = userResult.rows[0];
    
    // Format response like other conversation endpoints
    const conversation = {
      id: conversationId,
      name: `Admin Support`,
      type: 'direct',
      avatar_url: '/assets/uploads/user.jpg',
      last_message: {
        content: message.content,
        created_at: message.created_at
      },
      unread_count: 1
    };
    
    // Emit the message via Socket.IO to both users
    if (req.app.get('io')) {
      req.app.get('io').to(`dm:${conversationId}`).emit('new-direct-message', {
        ...message,
        conversation_id: conversationId,
        sender_username: admin.username
      });
    }
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating welcome message:', error);
    res.status(500).json({ error: 'Failed to create welcome message' });
  }
});

module.exports = router;

// Direct messaging routes
// Get user's direct message conversations
router.get('/direct-messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const conversations = await db.query(`
      SELECT dm.id, dm.user1_id, dm.user2_id, dm.updated_at,
             CASE 
               WHEN dm.user1_id = $1 THEN u2.username
               ELSE u1.username
             END as other_user_name,
             CASE 
               WHEN dm.user1_id = $1 THEN u2.id
               ELSE u1.id
             END as other_user_id,
             CASE 
               WHEN dm.user1_id = $1 THEN COALESCE(u2.avatar_url, '/assets/uploads/user.jpg')
               ELSE COALESCE(u1.avatar_url, '/assets/uploads/user.jpg')
             END as avatar_url,
             (SELECT content FROM direct_message_texts dmt 
              WHERE dmt.conversation_id = dm.id 
              ORDER BY dmt.created_at DESC LIMIT 1) as last_message,
             (SELECT COUNT(*) FROM direct_message_texts dmt 
              WHERE dmt.conversation_id = dm.id 
              AND dmt.sender_id != $1 AND dmt.is_read = false) as unread_count
      FROM direct_messages dm
      JOIN users u1 ON dm.user1_id = u1.id
      JOIN users u2 ON dm.user2_id = u2.id
      WHERE dm.user1_id = $1 OR dm.user2_id = $1
      ORDER BY dm.updated_at DESC
    `, [userId]);
    
    res.json({ conversations: conversations.rows });
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Start or get existing DM conversation
router.post('/direct-messages', protect, async (req, res) => {
  try {
    const { userId: otherUserId } = req.body;
    const userId = req.user.id;
    
    if (userId === otherUserId) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }
    
    const [user1Id, user2Id] = [userId, otherUserId].sort((a, b) => a - b);
    
    // Check if conversation already exists
    let conversation = await db.query(
      'SELECT * FROM direct_messages WHERE user1_id = $1 AND user2_id = $2',
      [user1Id, user2Id]
    );
    
    if (conversation.rows.length === 0) {
      // Create new conversation
      conversation = await db.query(
        'INSERT INTO direct_messages (user1_id, user2_id) VALUES ($1, $2) RETURNING *',
        [user1Id, user2Id]
      );
    }
    
    res.json({ conversation: conversation.rows[0] });
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages in a DM conversation
router.get('/direct-messages/:conversationId/messages', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    // Verify user is part of this conversation
    const conversationCheck = await db.query(
      'SELECT * FROM direct_messages WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    const messages = await db.query(`
      SELECT dmt.*, u.username as sender_name
      FROM direct_message_texts dmt
      JOIN users u ON dmt.sender_id = u.id
      WHERE dmt.conversation_id = $1
      ORDER BY dmt.created_at DESC
      LIMIT $2 OFFSET $3
    `, [conversationId, limit, offset]);
    
    // Mark messages as read
    await db.query(
      'UPDATE direct_message_texts SET is_read = true WHERE conversation_id = $1 AND sender_id != $2',
      [conversationId, userId]
    );
    
    res.json({ messages: messages.rows.reverse() });
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message in DM conversation
router.post('/direct-messages/:conversationId/messages', protect, messageLimiter, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Verify user is part of this conversation
    const conversationCheck = await db.query(
      'SELECT * FROM direct_messages WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [conversationId, userId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    const message = await db.query(
      'INSERT INTO direct_message_texts (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [conversationId, userId, content.trim()]
    );
    
    // Get sender info
    const senderInfo = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    const responseMessage = {
      ...message.rows[0],
      sender_name: senderInfo.rows[0].username
    };
    
    // Emit via Socket.IO if available
    if (req.app.get('io')) {
      req.app.get('io').to(`dm:${conversationId}`).emit('new_direct_message', responseMessage);
    }
    
    res.json({ message: responseMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get available users for DM (from same groups)
router.get('/dm-users', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const users = await db.query(`
      SELECT DISTINCT u.id, u.username, 
             COALESCE(u.avatar_url, '/assets/uploads/user.jpg') as avatar_url,
             -- Check if there's an existing conversation
             (SELECT dm.id FROM direct_messages dm 
              WHERE (dm.user1_id = $1 AND dm.user2_id = u.id) 
                 OR (dm.user1_id = u.id AND dm.user2_id = $1)
              LIMIT 1) as conversation_id
      FROM users u
      JOIN chat_group_members gm1 ON u.id = gm1.user_id
      JOIN chat_group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm2.user_id = $1 
        AND u.id != $1
        AND u.is_active = true
      ORDER BY u.username
    `, [userId]);
    
    res.json({ users: users.rows });
  } catch (error) {
    console.error('Error fetching DM users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

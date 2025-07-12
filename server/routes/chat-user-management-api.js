/**
 * Admin Chat API Routes - Fake User Management
 * This file contains the server-side routes for managing fake chat users
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateAdmin } = require('../middleware/admin-auth');

// Error handling middleware
const handleErrors = (err, req, res, next) => {
  console.error('Chat API Error:', err);
  res.status(500).json({ error: err.message });
};

// Apply admin authentication middleware to all routes
router.use(authenticateAdmin);

/**
 * Get all fake chat users with optional search filter
 * GET /api/admin/chat/fake-users
 */
router.get('/fake-users', async (req, res, next) => {
  try {
    let query = 'SELECT * FROM chat_fake_users';
    const params = [];

    // Add search condition if provided
    if (req.query.search) {
      query += ' WHERE username ILIKE $1 OR display_name ILIKE $1 OR bio ILIKE $1';
      params.push(`%${req.query.search}%`);
    }

    // Add order by clause
    query += ' ORDER BY display_name ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * Get a specific fake chat user by ID
 * GET /api/admin/chat/fake-users/:id
 */
router.get('/fake-users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM chat_fake_users WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * Create a new fake chat user
 * POST /api/admin/chat/fake-users
 */
router.post('/fake-users', async (req, res, next) => {
  try {
    const { username, display_name, avatar_url, bio, is_active } = req.body;
    
    if (!username || !display_name) {
      return res.status(400).json({ error: 'Username and display name are required' });
    }
    
    // Check if username already exists
    const existingUser = await pool.query('SELECT id FROM chat_fake_users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const query = `
      INSERT INTO chat_fake_users (username, display_name, avatar_url, bio, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      username,
      display_name,
      avatar_url || null,
      bio || null,
      is_active !== undefined ? is_active : true
    ]);
    
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * Update an existing fake chat user
 * PUT /api/admin/chat/fake-users/:id
 */
router.put('/fake-users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, display_name, avatar_url, bio, is_active } = req.body;
    
    if (!username || !display_name) {
      return res.status(400).json({ error: 'Username and display name are required' });
    }
    
    // Check if username already exists for a different user
    const existingUser = await pool.query('SELECT id FROM chat_fake_users WHERE username = $1 AND id != $2', [username, id]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Check if user exists
    const userExists = await pool.query('SELECT id FROM chat_fake_users WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const query = `
      UPDATE chat_fake_users
      SET username = $1, display_name = $2, avatar_url = $3, bio = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      username,
      display_name,
      avatar_url || null,
      bio || null,
      is_active !== undefined ? is_active : true,
      id
    ]);
    
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a fake chat user
 * DELETE /api/admin/chat/fake-users/:id
 */
router.delete('/fake-users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // First, remove user from any groups
      await client.query('DELETE FROM chat_group_members WHERE user_id = $1 AND user_type = $2', [id, 'fake_user']);
      
      // Then, delete the user
      const { rows } = await client.query('DELETE FROM chat_fake_users WHERE id = $1 RETURNING *', [id]);
      
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      
      await client.query('COMMIT');
      res.json({ message: 'User deleted successfully', user: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * Get members of a specific group
 * GET /api/admin/chat/groups/:groupId/members
 */
router.get('/groups/:groupId/members', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // Check if group exists
    const groupExists = await pool.query('SELECT id FROM chat_groups WHERE id = $1', [groupId]);
    if (groupExists.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Get fake user members
    const query = `
      SELECT fu.* 
      FROM chat_group_members cgm
      JOIN chat_fake_users fu ON cgm.user_id = fu.id
      WHERE cgm.group_id = $1 AND cgm.user_type = 'fake_user'
      ORDER BY fu.display_name ASC
    `;
    
    const { rows } = await pool.query(query, [groupId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * Add a member to a group
 * POST /api/admin/chat/groups/:groupId/members
 */
router.post('/groups/:groupId/members', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { fake_user_id, user_type } = req.body;
    
    if (!fake_user_id || !user_type) {
      return res.status(400).json({ error: 'User ID and user type are required' });
    }
    
    if (user_type !== 'fake_user') {
      return res.status(400).json({ error: 'Only fake_user type is supported currently' });
    }
    
    // Check if group exists
    const groupExists = await pool.query('SELECT id FROM chat_groups WHERE id = $1', [groupId]);
    if (groupExists.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Check if user exists
    const userExists = await pool.query('SELECT id FROM chat_fake_users WHERE id = $1', [fake_user_id]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already a member
    const memberExists = await pool.query(
      'SELECT id FROM chat_group_members WHERE group_id = $1 AND user_id = $2 AND user_type = $3',
      [groupId, fake_user_id, user_type]
    );
    if (memberExists.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this group' });
    }
    
    // Add member
    const query = `
      INSERT INTO chat_group_members (group_id, user_id, user_type)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [groupId, fake_user_id, user_type]);
    
    // Get user details
    const userQuery = 'SELECT * FROM chat_fake_users WHERE id = $1';
    const userResult = await pool.query(userQuery, [fake_user_id]);
    
    res.status(201).json({
      member: rows[0],
      user: userResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Remove a member from a group
 * DELETE /api/admin/chat/groups/:groupId/members/:userId
 */
router.delete('/groups/:groupId/members/:userId', async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    
    // Delete the member
    const query = `
      DELETE FROM chat_group_members
      WHERE group_id = $1 AND user_id = $2 AND user_type = 'fake_user'
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [groupId, userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Group member not found' });
    }
    
    res.json({ message: 'Member removed successfully', member: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Apply error handling middleware
router.use(handleErrors);

module.exports = router;

/**
 * Admin Authentication Routes
 * Handles admin login, authentication, and session management
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { authenticateAdmin } = require('../middleware/admin-auth');

// Load user model to authenticate admins
const db = require('../db');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }
    
    // Get user with admin role
    const user = await db.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1 AND role = $2',
      [username, 'admin']
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const admin = user.rows[0];
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role 
      }, 
      process.env.JWT_SECRET || 'affiliate-admin-secret',
      { expiresIn: '12h' }
    );
    
    // Log successful login
    console.log(`Admin ${username} logged in at ${new Date().toISOString()}`);
    
    res.json({ 
      success: true, 
      token,
      username: admin.username
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during login' 
    });
  }
});

// Verify admin token
router.get('/verify-token', authenticateAdmin, (req, res) => {
  res.json({
    authenticated: true,
    username: req.admin.username
  });
});

// Admin logout (JWT tokens can't be invalidated, but we can handle client-side cleanup)
router.post('/logout', authenticateAdmin, (req, res) => {
  // In a more sophisticated system, you could add the token to a blacklist
  res.json({ success: true });
});

module.exports = router;

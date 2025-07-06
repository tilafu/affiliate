/**
 * Admin Authentication Middleware
 * Handles token verification and admin access control
 */

const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Middleware to authenticate admin users using JWT token
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'affiliate-admin-secret');
    
    // Check if user exists and has admin role
    const user = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1 AND role = $2',
      [decoded.id, 'admin']
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const admin = user.rows[0];
    
    // Add admin info to request object
    req.admin = {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

/**
 * Middleware to check if user has super admin privileges
 * Used for highly sensitive operations
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    // Must be called after authenticateAdmin
    if (!req.admin) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check for super admin status in database
    // This could be a separate field or a specific admin id
    const isSuperAdmin = await db.query(
      'SELECT COUNT(*) FROM users WHERE id = $1 AND role = $2 AND username = $3',
      [req.admin.id, 'admin', 'admin'] // Assuming 'admin' user is super admin
    );
    
    if (parseInt(isSuperAdmin.rows[0].count) === 0) {
      return res.status(403).json({ error: 'Super admin privileges required' });
    }
    
    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    res.status(500).json({ error: 'Server error checking admin privileges' });
  }
};

module.exports = {
  authenticateAdmin,
  requireSuperAdmin
};

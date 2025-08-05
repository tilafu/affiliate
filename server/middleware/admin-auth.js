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
    console.log(`[ADMIN AUTH] Processing request: ${req.method} ${req.originalUrl}`);
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[ADMIN AUTH] No authorization header or invalid format');
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: 'Missing or invalid authorization header',
        expected: 'Bearer <token>'
      });
    }
    
    const token = authHeader.split(' ')[1];
    // Debug logging controlled by environment variable
    if (process.env.DEBUG_AUTH === 'true') {
        console.log(`[ADMIN AUTH] Token received, length: ${token.length}`);
    }
    
    // Verify JWT token using the same secret as token creation
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (process.env.DEBUG_AUTH === 'true') {
        console.log(`[ADMIN AUTH] Token verified successfully for userId: ${decoded.userId}`);
    }
    
    // Check if user exists and has admin role
    const user = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1 AND role = $2',
      [decoded.userId, 'admin']  // Use decoded.userId to match JWT payload
    );

    if (user.rows.length === 0) {
      console.log(`[ADMIN AUTH] User not found or not admin: userId=${decoded.userId}`);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User not found or insufficient privileges',
        details: 'Admin role required'
      });
    }

    const admin = user.rows[0];
    console.log(`[ADMIN AUTH] Admin access granted: ${admin.username} (ID: ${admin.id})`);
    
    // Add admin info to request object
    req.admin = {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };
    
    next();
  } catch (error) {
    console.error('[ADMIN AUTH] Authentication error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token', 
        message: 'Token is malformed or signature is invalid',
        details: error.message
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        message: 'Authentication token has expired',
        expiredAt: error.expiredAt
      });
    }
    
    res.status(500).json({ 
      error: 'Server error during authentication',
      message: 'Internal server error while processing authentication'
    });
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

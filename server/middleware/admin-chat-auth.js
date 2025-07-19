/**
 * Admin Chat Authentication Middleware
 * Verifies admin permissions for chat management
 * NOTE: This middleware is deprecated in favor of using the standardized auth middleware
 */

const jwt = require('jsonwebtoken');
const db = require('../db'); // Database connection module

/**
 * Middleware to verify admin has chat management permissions
 * @deprecated Use the standardized { protect, admin } middleware instead
 */
const verifyAdminChatAccess = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authorization header with Bearer token is required',
        details: 'Format: Authorization: Bearer <token>'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'affiliate-admin-secret');
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'INVALID_TOKEN',
          message: 'The provided token is invalid or malformed',
          details: jwtError.message
        });
      }
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'TOKEN_EXPIRED',
          message: 'The provided token has expired',
          details: `Token expired at: ${jwtError.expiredAt}`
        });
      }
      
      throw jwtError; // Re-throw unexpected JWT errors
    }
    
    // Check if user exists and has admin role
    const user = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1 AND role = $2',
      [decoded.userId || decoded.id, 'admin'] // Support both userId and id fields
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ 
        error: 'ADMIN_NOT_FOUND',
        message: 'Admin user not found or does not have admin privileges',
        details: `User ID: ${decoded.userId || decoded.id}`
      });
    }

    // In a more advanced system, you could have specific permissions
    // For now, all admins have chat management permission
    const adminData = user.rows[0];

    // Add admin info to request for use in controller (standardize with auth.js)
    req.user = {
      id: adminData.id,
      username: adminData.username,
      role: adminData.role
    };

    // Log admin access (optional)
    try {
      await logAdminAccess(req.user.id, req.path);
    } catch (logError) {
      console.error('Admin access logging failed:', logError);
      // Continue - don't fail auth for logging errors
    }

    next();
  } catch (error) {
    console.error('Admin chat auth error:', error);
    
    res.status(500).json({ 
      error: 'AUTHENTICATION_ERROR',
      message: 'An internal error occurred during authentication',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Log admin access to chat management
 */
const logAdminAccess = async (adminId, path) => {
  try {
    await db.query(
      'INSERT INTO chat_admin_logs (admin_id, action_type, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [
        adminId, 
        'ACCESS_ENDPOINT', 
        'API', 
        0, 
        JSON.stringify({ path, timestamp: new Date().toISOString() })
      ]
    );
  } catch (error) {
    console.error('Error logging admin access:', error);
    // Non-blocking - continue even if logging fails
  }
};

module.exports = {
  verifyAdminChatAccess
};

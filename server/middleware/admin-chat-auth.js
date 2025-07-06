/**
 * Admin Chat Authentication Middleware
 * Verifies admin permissions for chat management
 */

const jwt = require('jsonwebtoken');
const db = require('../db'); // Database connection module

/**
 * Middleware to verify admin has chat management permissions
 */
const verifyAdminChatAccess = async (req, res, next) => {
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
      return res.status(401).json({ error: 'Admin not found' });
    }

    // In a more advanced system, you could have specific permissions
    // For now, all admins have chat management permission
    const adminData = user.rows[0];

    // Add admin info to request for use in controller
    req.admin = {
      id: adminData.id,
      username: adminData.username,
      role: adminData.role
    };

    // Log admin access (optional)
    await logAdminAccess(req.admin.id, req.path);

    next();
  } catch (error) {
    console.error('Admin chat auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(500).json({ error: 'Authentication error' });
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
        'access_endpoint', 
        'api', 
        0, 
        JSON.stringify({ path, timestamp: new Date() })
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

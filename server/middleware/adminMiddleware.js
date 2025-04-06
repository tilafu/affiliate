const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const adminMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if the user is an admin
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin permissions required' });
    }

    // Add user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

module.exports = adminMiddleware;
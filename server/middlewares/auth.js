const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (including the new role column)
      const userResult = await pool.query(
          'SELECT id, username, email, referral_code, tier, role FROM users WHERE id = $1',
          [decoded.userId]
      );

      if (userResult.rows.length === 0) {
          return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }
      
      req.user = userResult.rows[0]; // Attach user object to the request
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// Middleware to check if the user is an admin based on role
const admin = (req, res, next) => {
  // This middleware should run AFTER protect, so req.user should be populated
  if (req.user && req.user.role === 'admin') {
    next(); // User is admin, proceed to the next middleware/route handler
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' }); // Forbidden
  }
};

module.exports = { protect, admin };

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

      // Get user from the token (excluding password)
      // You might want to select more/less user data depending on needs
      const userResult = await pool.query(
          'SELECT id, username, email, referral_code, tier FROM users WHERE id = $1', 
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

module.exports = { protect };

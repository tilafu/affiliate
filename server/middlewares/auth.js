const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const protect = async (req, res, next) => {
    let token;
    
    console.log(`[AUTH MIDDLEWARE] Request to: ${req.method} ${req.originalUrl}, IP: ${req.ip || req.connection.remoteAddress}`);

    // Check if the request is for an API route
    const isApiRequest = req.originalUrl.startsWith('/api/');

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            console.log(`[AUTH MIDDLEWARE] Token found, length: ${token.length}`);

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log(`[AUTH MIDDLEWARE] Token verified for userId: ${decoded.userId}, username: ${decoded.username}`);

            // Get user from the token
            const userResult = await pool.query(
                'SELECT id, username, email, referral_code, tier, role FROM users WHERE id = $1',
                [decoded.userId]
            );

            if (userResult.rows.length === 0) {
                console.log(`[AUTH MIDDLEWARE] User not found in database for userId: ${decoded.userId}`);
                return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
            }
            
            const user = userResult.rows[0];
            console.log(`[AUTH MIDDLEWARE] User found - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
            
            req.user = user;
            next();
        } catch (error) {
            console.error(`[AUTH MIDDLEWARE] Token verification failed:`, error.message);
            if (error.name === 'JsonWebTokenError') {
                console.log(`[AUTH MIDDLEWARE] Invalid token format`);
            } else if (error.name === 'TokenExpiredError') {
                console.log(`[AUTH MIDDLEWARE] Token expired at: ${error.expiredAt}`);
            }
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    } else {
        console.log(`[AUTH MIDDLEWARE] No authorization header found or invalid format. Headers:`, req.headers.authorization);
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// Middleware to check if the user is an admin
const admin = (req, res, next) => {
    console.log(`[ADMIN MIDDLEWARE] Checking admin access for user: ${req.user?.username} (ID: ${req.user?.id}), Role: ${req.user?.role}`);
    
    if (req.user && req.user.role === 'admin') {
        console.log(`[ADMIN MIDDLEWARE] Admin access granted for user: ${req.user.username}`);
        next();
    } else {
        console.log(`[ADMIN MIDDLEWARE] Admin access denied for user: ${req.user?.username}, Role: ${req.user?.role}`);
        // Always return JSON for API routes
        return res.status(403).json({ success: false, message: 'Not authorized as an admin' });
    }
};

module.exports = { protect, admin };

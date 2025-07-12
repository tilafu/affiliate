require('dotenv').config();
const logger = require('./logger');
const express = require('express');
const cors = require('cors');
const session = require('express-session'); // Added express-session
const pool = require('./config/db');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const http = require('http'); // Added for Socket.io
const socketIo = require('socket.io'); // Added for Socket.io

const app = express();
const PORT = process.env.PORT || 3000;
const { calculateCommission } = require('./utils/commission');

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Set up session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'affiliate-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Socket.io with enhanced chat functionality
const setupSocketServer = require('./socket-chat');
const io = setupSocketServer(server);

// Store io instance on app for routes to access
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true // important for cookies/sessions
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${ip}`);
  
  // Log request body for POST requests (excluding sensitive data)
  if (req.method === 'POST' && req.body) {
    const logBody = { ...req.body };
    if (logBody.password) logBody.password = '[REDACTED]';
    console.log(`[REQUEST BODY]`, logBody);
  }
  
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Client server is running' });
});

// Public products endpoint for carousel (no authentication required)
app.get('/api/products/carousel', async (req, res) => {
  try {
    const highValueQuery = `
      SELECT 
        id,
        name,
        price,
        image_url,
        description
      FROM products 
      WHERE price > 5000 
      AND status = 'active'
      AND is_active = true
      ORDER BY price DESC
      LIMIT 20
    `;

    const result = await pool.query(highValueQuery);
    
    // Calculate commission for each product (assume 10% for simplicity)
    const productsWithCommission = result.rows.map(product => {
      const price = parseFloat(product.price);
      const commission = (price * 0.10).toFixed(2);
      
      return {
        ...product,
        price: price.toFixed(2),
        commission: commission,
        image_url: product.image_url || '/assets/uploads/products/newegg-1.jpg'
      };
    });

    res.json({ 
      success: true, 
      products: productsWithCommission,
      count: productsWithCommission.length 
    });
  } catch (error) {
    logger.error('Error fetching carousel products:', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Server error fetching carousel products' });
  }
});

// Define Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const driveRoutes = require('./routes/drive');
const adminRoutes = require('./routes/admin'); // Import admin routes
const notificationRoutes = require('./routes/notificationRoutes'); // Import notification routes
const adminDriveRoutes = require('./routes/adminDriveRoutes'); // Import admin drive routes
const adminChatRoutes = require('./routes/admin-chat-api-integrated'); // Import integrated admin chat routes
const chatUserManagementRoutes = require('./routes/chat-user-management-api'); // Import chat user management routes
const chatMessageRoutes = require('./routes/chat-message-api'); // Import chat message routes
const chatRoutes = require('./routes/chat'); // Import chat routes
const usersRoutes = require('./routes/users'); // Import users routes

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', usersRoutes); // Mount users routes
app.use('/api/drive', driveRoutes);
app.use('/api/chat', chatRoutes); // Mount chat routes
app.use('/api/admin', adminRoutes); // Mount admin routes
app.use('/api/admin', notificationRoutes); // Mount notification routes under /api/admin
app.use('/api/admin/drive-management', adminDriveRoutes); // Mount admin drive routes
app.use('/api/admin/chat', adminChatRoutes); // Mount admin chat routes - Standardized route pattern
app.use('/api/admin/chat', chatUserManagementRoutes); // Mount chat user management routes
app.use('/api/admin/chat', chatMessageRoutes); // Mount chat message routes

// Start server (using HTTP server instead of Express)
server.listen(PORT, () => {
  logger.info(`Client server running on port ${PORT}`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      logger.error('Database connection error:', err);
    } else {
      logger.info('Client server database connected:', res.rows[0].now);
    }
  });
});

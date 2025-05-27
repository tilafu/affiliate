require('dotenv').config();
const logger = require('./logger'); // Import logger
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');
const { v4: uuidv4 } = require('uuid');


const app = express();
const PORT = process.env.PORT || 3000;
const { calculateCommission } = require('./utils/commission'); // Import commission helper

// Middleware
app.use(cors());

// Global error handler for JSON parsing issues
app.use(express.json({
    verify: (req, res, buf, encoding) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ 
                success: false, 
                message: 'Invalid JSON in request body', 
                error: e.message 
            });
            throw new Error('Invalid JSON: ' + e.message);
        }
    }
}));

// Request logging middleware
app.use((req, res, next) => {
    logger.debug(`Incoming request: ${req.method} ${req.originalUrl}`, { headers: req.headers, body: req.body });
    
    // Log response
    const originalSend = res.send;
    res.send = function (body) {
        logger.debug(`Outgoing response: ${res.statusCode}`, { body: body });
        originalSend.apply(res, arguments);
    };
    next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

// Define Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin'); // Import admin routes
const driveRoutes = require('./routes/drive'); // Import drive routes
const adminDriveRoutes = require('./routes/adminDriveRoutes'); // Import admin drive routes

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes); // This will include the support message routes
app.use('/api/admin', adminRoutes); // Use admin routes
app.use('/api/drive', driveRoutes); // Use drive routes
app.use('/api/admin/drive-management', adminDriveRoutes); // Use admin drive routes

// Routes
// app.use('/api/admin', require('./routes/admin')); // This line is redundant and can be removed if adminRoutes is already used above.

// --- COMMISSION SERVICE TESTING ---
async function testCommissionService() {
  const CommissionService = require('./services/commissionService');

  try {
    // 1. Get test user (admin)
    const userResult = await pool.query('SELECT id, upliner_id FROM users WHERE username = $1', ['admin']);
    const testUser = userResult.rows[0];
if (!testUser) {
  logger.error('Admin user not found for commission testing.');
  return;
    }
    const userTier = userResult.rows[0].tier || 'bronze'; // Get user tier

    // 2. Get test product (Basic Data Drive) - Remove commission_rate
    const productResult = await pool.query('SELECT id, price FROM products WHERE name = $1', ['Basic Data Drive']);
    const testProduct = productResult.rows[0];
if (!testProduct) {
  logger.error('Basic Data Drive product not found for commission testing.');
  return;
}

    // Calculate commission based on tier for testing
    const testCommission = calculateCommission(testProduct.price, userTier);

logger.info('--- Testing Direct Drive Commission ---');
    // Pass calculated commission or let the service calculate it internally if it fetches tier
    // Assuming CommissionService.calculateDirectDriveCommission now fetches tier internally or accepts it
    await CommissionService.calculateDirectDriveCommission(
      testUser.id,
      testProduct.id,
      testProduct.price
      // testCommission // Pass calculated commission if needed by the service
    );

    // Upline commission should also be handled internally by the service based on tiers

logger.info('--- Testing Training Account Commission ---');
    await CommissionService.calculateTrainingCommission(
      testUser.id,
      testProduct.id,
      testProduct.price,
      0.25
    );

logger.info('--- Testing Training Cap Check & Transfer ---');
    await CommissionService.checkAndTransferTrainingCap(testUser.id);
  } catch (error) {
    logger.error('Commission service testing error:', error);
  }
}
// --- END COMMISSION SERVICE TESTING ---

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { 
        message: err.message, 
        stack: err.stack, 
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });
    
    // Send a structured error response
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      logger.error('Database connection error:', err);
    } else {
      logger.info('Database connected:', res.rows[0].now);
    }
  });

  testCommissionService(); // Run the test function after server starts
});

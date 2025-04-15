require('dotenv').config();
const logger = require('./logger'); // Import logger
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes); // This is good
app.use('/api/admin', adminRoutes); // Use admin routes
app.use('/api/drive', driveRoutes); // Use drive routes

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

    // 2. Get test product (Basic Data Drive)
    const productResult = await pool.query('SELECT id, price, commission_rate FROM products WHERE name = $1', ['Basic Data Drive']);
    const testProduct = productResult.rows[0];
if (!testProduct) {
  logger.error('Basic Data Drive product not found for commission testing.');
  return;
}

logger.info('--- Testing Direct Drive Commission ---');
    await CommissionService.calculateDirectDriveCommission(
      testUser.id,
      testProduct.id,
      testProduct.price,
      testProduct.commission_rate
    );

    // Upline commission is handled within calculateDirectDriveCommission

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

require('dotenv').config();
const logger = require('./logger');
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const { calculateCommission } = require('./utils/commission');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Client server is running' });
});

// Define Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const driveRoutes = require('./routes/drive');
const adminRoutes = require('./routes/admin'); // Import admin routes
const notificationRoutes = require('./routes/notificationRoutes'); // Import notification routes
const adminDriveRoutes = require('./routes/adminDriveRoutes'); // Import admin drive routes

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/admin', adminRoutes); // Mount admin routes
app.use('/api/admin', notificationRoutes); // Mount notification routes under /api/admin
app.use('/api/admin/drive-management', adminDriveRoutes); // Mount admin drive routes

// Start server
app.listen(PORT, () => {
  logger.info(`Client server running on port ${PORT}`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      logger.error('Database connection error:', err);
    } else {
      logger.info('Client server database connected:', res.rows[0].now);
    }
  });
});

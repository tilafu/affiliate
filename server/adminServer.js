require('dotenv').config();
const logger = require('./logger');
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');

const app = express();
const ADMIN_PORT = process.env.ADMIN_PORT || 3001; // Different port for admin server

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Admin server is running' });
});

// Define Admin Routes
const adminRoutes = require('./routes/admin');
const adminDriveRoutes = require('./routes/adminDriveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const tierManagementRoutes = require('./routes/tierManagementRoutes');

// Apply admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/drive-management', adminDriveRoutes);
app.use('/api/admin', notificationRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/admin/tier-management', tierManagementRoutes);

// Start server
app.listen(ADMIN_PORT, () => {
  logger.info(`Admin server running on port ${ADMIN_PORT}`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      logger.error('Database connection error:', err);
    } else {
      logger.info('Admin server database connected:', res.rows[0].now);
    }
  });
}); 
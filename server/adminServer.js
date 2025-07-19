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
    
    // Calculate commission for each product
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
    logger.error('Error fetching carousel products:', error);
    res.status(500).json({ success: false, message: 'Server error fetching products' });
  }
});

// Define Admin Routes
const adminRoutes = require('./routes/admin');
const adminDriveRoutes = require('./routes/adminDriveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const tierManagementRoutes = require('./routes/tierManagementRoutes');
const adminChatRoutes = require('./routes/admin-chat-api-integrated');

// Apply admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/drive-management', adminDriveRoutes);
app.use('/api/admin', notificationRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/admin/tier-management', tierManagementRoutes);
app.use('/api/admin/chat', adminChatRoutes);

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
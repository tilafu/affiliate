require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve admin.html from /admin endpoint
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin_views/admin.html'));
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

// Define Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const driveRoutes = require('./routes/drive'); // Add drive routes
const adminRoutes = require('./routes/admin'); // Add admin routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/drive', driveRoutes); // Mount drive routes
app.use('/api/admin', adminRoutes); // Mount admin routes

// --- COMMISSION SERVICE TESTING ---
async function testCommissionService() {
  const CommissionService = require('./services/commissionService');

  try {
    // 1. Get test user (admin)
    const userResult = await pool.query('SELECT id, upliner_id FROM users WHERE username = $1', ['admin']);
    const testUser = userResult.rows[0];
    if (!testUser) {
      console.error('Admin user not found for commission testing.');
      return;
    }

    // 2. Get test product (Basic Data Drive)
    const productResult = await pool.query('SELECT id, price, commission_rate FROM products WHERE name = $1', ['Basic Data Drive']);
    const testProduct = productResult.rows[0];
    if (!testProduct) {
      console.error('Basic Data Drive product not found for commission testing.');
      return;
    }

    console.log('--- Testing Direct Drive Commission ---');
await CommissionService.calculateDirectDriveCommission(
  testUser.id,
  testProduct.id,
  testProduct.price,
  testProduct.commission_rate,
  pool, // Pass the pool object as the client
  1 // Assuming 1 as a placeholder for sourceActionId
);

    // Upline commission is handled within calculateDirectDriveCommission

    console.log('--- Testing Training Account Commission ---');
    await CommissionService.calculateTrainingCommission(
      testUser.id,
      testProduct.id,
      testProduct.price,
      0.25
    );

    console.log('--- Testing Training Cap Check & Transfer ---');
    await CommissionService.checkAndTransferTrainingCap(testUser.id);
  } catch (error) {
    console.error('Commission service testing error:', error);
  }
}
// --- END COMMISSION SERVICE TESTING ---

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // When database updates occur:
  socket.emit('account-update', {
    balance: 1000.00,
    profit: 25.50
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected:', res.rows[0].now);
    }
  });

  testCommissionService(); // Run the test function after server starts
});

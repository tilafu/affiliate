require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db'); // We'll create this next

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Body parser for JSON requests

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});

// Define Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user'); // Import user routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes); // Mount user routes

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Test DB connection on startup
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected:', res.rows[0].now);
    }
  });
});

module.exports = app; // For potential testing

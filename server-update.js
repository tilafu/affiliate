/**
 * Update to server.js to include admin chat routes
 * 
 * This file shows the necessary additions to your existing server.js file
 * to incorporate the admin chat management functionality.
 * 
 * You should merge these changes into your existing server.js file.
 */

// Existing imports...
const express = require('express');
const http = require('http');
const path = require('path');
// Add these new imports:
const socketIO = require('socket.io');
const adminChatRoutes = require('./server/routes/admin-chat-api');
const scheduledChatMessages = require('./server/jobs/scheduled-chat-messages');

// Create app and server
const app = express();
const server = http.createServer(app);

// Add Socket.io server
const io = socketIO(server);

// Middleware setup...
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Existing routes...

// Add admin chat routes
app.use('/api/admin/chat', adminChatRoutes);

// Socket.io setup
require('./server/chat-server')(io);

// Initialize scheduled message processor
scheduledChatMessages.initialize();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

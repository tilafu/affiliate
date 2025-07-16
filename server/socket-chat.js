/**
 * Socket.IO Chat Service
 * Handles real-time communication for the chat feature
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Rate limiting settings
const MESSAGE_RATE_LIMIT = 30; // messages per minute
const TYPING_RATE_LIMIT = 5; // typing notifications per 10 seconds

// Setup Socket.IO server
function setupSocketServer(server) {
  const io = socketIo(server, {
    cors: {
      origin: '*', // In production, restrict this to your domain
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token || token === 'guest') {
        // Allow connection as guest with limited capabilities
        socket.user = { id: 'guest', role: 'guest' };
        return next();
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'affiliate-admin-secret');
      
      // Get user details from database
    const userResult = await db.query(
        'SELECT id, username, role FROM users WHERE id = $1',
        [decoded.id]
    );
      
      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }
      
      socket.user = userResult.rows[0];
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}, role: ${socket.user.role}`);
    
    // Store rate limiting data
    const rateLimit = {
      messages: {
        count: 0,
        resetTime: Date.now() + 60000 // 1 minute
      },
      typing: {
        count: 0,
        resetTime: Date.now() + 10000 // 10 seconds
      }
    };

    // Join user to their groups
    joinUserGroups(socket);

    // Handle chat events
    socket.on('join-group', async (groupId) => {
      if (!groupId) return;
      
      try {
        // Check if user is member of this group
        const isMember = await isGroupMember(socket.user.id, groupId);
        const isAdmin = socket.user.role === 'admin';
        
        if (isMember || isAdmin) {
          socket.join(`group:${groupId}`);
          console.log(`User ${socket.user.id} joined group ${groupId}`);
        } else {
          socket.emit('error', { message: 'Not authorized to join this group' });
        }
      } catch (error) {
        console.error('Error joining group:', error);
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    socket.on('leave-group', (groupId) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
      console.log(`User ${socket.user.id} left group ${groupId}`);
    });

    socket.on('typing', async (data) => {
      // Check rate limit
      if (isRateLimited(socket, 'typing')) {
        return;
      }
      
      const { group_id } = data;
      if (!group_id) return;
      
      // Check if user is member of this group
      try {
        const isMember = await isGroupMember(socket.user.id, group_id);
        const isAdmin = socket.user.role === 'admin';
        
        if (isMember || isAdmin) {
          // Broadcast typing event to group members
          socket.to(`group:${group_id}`).emit('user-typing', {
            user_id: socket.user.id,
            username: socket.user.username,
            group_id: group_id
          });
        }
      } catch (error) {
        console.error('Error handling typing event:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });

    // Rate limiting helper function
    function isRateLimited(socket, type) {
      const now = Date.now();
      const limit = rateLimit[type];
      
      if (now > limit.resetTime) {
        // Reset counter if time window has passed
        limit.count = 1;
        limit.resetTime = now + (type === 'typing' ? 10000 : 60000);
        return false;
      }
      
      limit.count++;
      
      if (limit.count > (type === 'typing' ? TYPING_RATE_LIMIT : MESSAGE_RATE_LIMIT)) {
        socket.emit('error', { 
          message: `Rate limit exceeded for ${type}. Please try again later.`
        });
        return true;
      }
      
      return false;
    }
  });

  // Helper function to join user to their groups
  async function joinUserGroups(socket) {
    // Skip for guest users
    if (socket.user.id === 'guest') return;
    
    try {
      // Get all groups where user is a member
      const userGroups = await db.query(
        'SELECT group_id FROM chat_group_members WHERE user_id = $1',
        [socket.user.id]
      );
      
      // Join each group's room
      userGroups.rows.forEach(group => {
        socket.join(`group:${group.group_id}`);
      });
      
      console.log(`User ${socket.user.id} joined ${userGroups.rows.length} group rooms`);
      
      // Admin users join all groups
      if (socket.user.role === 'admin') {
        const allGroups = await db.query('SELECT id FROM chat_groups');
        allGroups.rows.forEach(group => {
          socket.join(`group:${group.id}`);
        });
        console.log(`Admin ${socket.user.id} joined all ${allGroups.rows.length} groups`);
      }
    } catch (error) {
      console.error('Error joining user groups:', error);
    }
  }

  // Helper function to check if user is member of a group
  async function isGroupMember(userId, groupId) {
    if (userId === 'guest') return false;
    
    try {
      const result = await db.query(
        'SELECT 1 FROM chat_group_members WHERE user_id = $1 AND group_id = $2',
        [userId, groupId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking group membership:', error);
      return false;
    }
  }

  // Function to emit a message to a group from the server (for admin-generated messages)
  function emitMessageToGroup(groupId, message) {
    const roomName = `group:${groupId}`;
    io.to(roomName).emit('new-message', message);
    console.log(`Admin sent message to group ${groupId}`);
  }

  // Attach helper functions to io object for access by other modules
  io.emitMessageToGroup = emitMessageToGroup;

  return io;
}

module.exports = setupSocketServer;

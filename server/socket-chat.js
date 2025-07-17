/**
 * Socket.IO Chat Service
 * Handles real-time communication for the chat feature
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Rate limiting settings
const MESSAGE_RATE_LIMIT = 30; // messages per minute
const TYPING_RATE_LIMIT = 20; // typing notifications per 10 seconds

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
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'affiliate-admin-secret');
        
        // Get user details from database
        // Note: JWT payload uses 'userId', not 'id'
        const userResult = await db.query(
          'SELECT id, username, role FROM users WHERE id = $1',
          [decoded.userId]
        );
        
        if (userResult.rows.length === 0) {
          console.log('User not found in database, allowing as guest');
          socket.user = { id: 'guest', role: 'guest' };
          return next();
        }
        
        socket.user = userResult.rows[0];
        next();
      } catch (jwtError) {
        console.log('JWT verification failed, allowing as guest:', jwtError.message);
        socket.user = { id: 'guest', role: 'guest' };
        return next();
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      // Don't fail the connection, just set as guest
      socket.user = { id: 'guest', role: 'guest' };
      next();
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    try {
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
            console.log(`User ${socket.user.id} not authorized to join group ${groupId}`);
            // Don't emit error - just log it
          }
        } catch (error) {
          console.error('Error joining group:', error);
          // Don't emit error - just log it
        }
      });

    socket.on('leave-group', (groupId) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
      console.log(`User ${socket.user.id} left group ${groupId}`);
    });

    // Handle direct message room events
    socket.on('join-conversation', async (conversationId) => {
      if (!conversationId) return;
      
      try {
        // Check if user is part of this conversation
        const isParticipant = await isConversationParticipant(socket.user.id, conversationId);
        
        if (isParticipant || socket.user.role === 'admin') {
          socket.join(`dm:${conversationId}`);
          console.log(`User ${socket.user.id} joined conversation ${conversationId}`);
        } else {
          console.log(`User ${socket.user.id} not authorized to join conversation ${conversationId}`);
          // Don't emit error - just log it
        }
      } catch (error) {
        console.error('Error joining conversation:', error);
        // Don't emit error - just log it
      }
    });

    socket.on('leave-conversation', (conversationId) => {
      if (!conversationId) return;
      socket.leave(`dm:${conversationId}`);
      console.log(`User ${socket.user.id} left conversation ${conversationId}`);
    });

    socket.on('typing', async (data) => {
      // Check rate limit - but don't block typing completely
      if (isRateLimited(socket, 'typing')) {
        // Just silently ignore excessive typing events
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
        // Don't emit socket errors for typing events
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });

    // Rate limiting helper function
    function isRateLimited(socket, type) {
      try {
        if (!socket || !socket.user) {
          return false; // Allow if socket/user is not available
        }
        
        const now = Date.now();
        const limit = rateLimit[type];
        
        if (!limit) {
          console.warn(`Rate limit type '${type}' not found`);
          return false;
        }
        
        if (now > limit.resetTime) {
          // Reset counter if time window has passed
          limit.count = 1;
          limit.resetTime = now + (type === 'typing' ? 10000 : 60000);
          return false;
        }
        
        limit.count++;
        
        if (limit.count > (type === 'typing' ? TYPING_RATE_LIMIT : MESSAGE_RATE_LIMIT)) {
          // For typing events, just silently ignore - don't send any errors
          if (type === 'typing') {
            console.log(`User ${socket.user.id} hit typing rate limit - silently ignoring`);
            return true;
          } else {
            // For other events, send a warning but don't crash
            console.log(`User ${socket.user.id} hit ${type} rate limit`);
            socket.emit('rate-limit-warning', { 
              type: type,
              message: `Please slow down. Rate limit exceeded for ${type}.`
            });
            return true;
          }
        }
        
        return false;
      } catch (error) {
        console.error('Error in rate limiting:', error);
        return false; // Don't block on rate limiting errors
      }
    }
    } catch (error) {
      console.error('Error in socket connection handler:', error);
      // Don't crash the server, just log the error
    }
  });

  // Helper function to join user to their groups
  async function joinUserGroups(socket) {
    try {
      // Skip for guest users
      if (!socket || !socket.user || socket.user.id === 'guest') return;
      
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
      // Don't crash, just continue
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

  // Helper function to check if user is participant in a direct conversation
  async function isConversationParticipant(userId, conversationId) {
    if (userId === 'guest') return false;
    
    try {
      const result = await db.query(
        'SELECT 1 FROM direct_messages WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
        [conversationId, userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking conversation participation:', error);
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

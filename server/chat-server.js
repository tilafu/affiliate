/**
 * Chat Server
 * Socket.io server for real-time chat functionality
 * Supports both JWT and session-based authentication
 */

const jwt = require('jsonwebtoken');
const db = require('./db'); // Database connection module
const cookie = require('cookie'); // Add dependency: npm install cookie

// Export function that sets up Socket.io server
module.exports = (io) => {
  // Namespace for chat
  const chatIo = io.of('/chat');
  
  // Authentication middleware
  chatIo.use(async (socket, next) => {
    try {
      let user = null;
      
      // First try JWT authentication (for regular users)
      const token = socket.handshake.auth.token;
      if (token) {
        try {
          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'affiliate-admin-secret');
          
          // Check if user exists
          const userResult = await db.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [decoded.id]
          );
          
          if (userResult.rows.length > 0) {
            user = userResult.rows[0];
          }
        } catch (jwtError) {
          console.log('JWT authentication failed:', jwtError.message);
          // Continue to session auth
        }
      }
      
      // If JWT auth failed, try session-based authentication (for admins)
      if (!user && socket.handshake.headers.cookie) {
        try {
          // Parse cookies
          const cookies = cookie.parse(socket.handshake.headers.cookie);
          
          // Extract session ID from cookie (depends on your session setup)
          const sessionId = cookies['connect.sid']; // Adjust based on your session cookie name
          
          if (sessionId) {
            // Here you would validate the session
            // For demonstration, we'll just check if admin is connected by user ID
            // In a real implementation, you need to verify the session from your session store
            
            const adminId = socket.handshake.auth.adminId;
            if (adminId) {
              const adminResult = await db.query(
                'SELECT id, username, role FROM users WHERE id = $1 AND role = $2',
                [adminId, 'admin']
              );
              
              if (adminResult.rows.length > 0) {
                user = adminResult.rows[0];
                user.isAdmin = true; // Mark as admin for special privileges
              }
            }
          }
        } catch (sessionError) {
          console.error('Session authentication failed:', sessionError);
        }
      }
      
      // If no authentication method worked
      if (!user) {
        return next(new Error('Authentication required'));
      }
      
      // Attach user info to socket
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });
  
  // Handle connections
  chatIo.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}, role: ${socket.user.role}`);
    
    // Join user's groups
    joinUserGroups(socket);
    
    // Handle joining a specific group
    socket.on('join-group', (groupId) => {
      handleJoinGroup(socket, groupId);
    });
    
    // Handle sending a message
    socket.on('send-message', (data) => {
      handleSendMessage(socket, data);
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
      handleTyping(socket, data);
    });
    
    // Handle read receipts
    socket.on('mark-read', (data) => {
      handleMarkRead(socket, data);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });
  
  // Verify authentication token
  async function verifyToken(token) {
    try {
      // Replace with your token verification logic
      // This is just a placeholder
      const query = 'SELECT id, username FROM users WHERE auth_token = $1';
      const result = await db.query(query, [token]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return {
        id: result.rows[0].id,
        username: result.rows[0].username,
        type: 'real'
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }
  
  // Join user's groups
  async function joinUserGroups(socket) {
    try {
      const userId = socket.user.id;
      
      // Get user's groups
      const query = `
        SELECT group_id 
        FROM chat_group_members 
        WHERE user_id = $1 AND user_type = 'real'
      `;
      
      const result = await db.query(query, [userId]);
      
      // Join socket rooms for each group
      result.rows.forEach(row => {
        const roomName = `group:${row.group_id}`;
        socket.join(roomName);
        console.log(`User ${userId} joined room ${roomName}`);
      });
    } catch (error) {
      console.error('Error joining user groups:', error);
    }
  }
  
  // Handle join group request
  async function handleJoinGroup(socket, groupId) {
    try {
      const userId = socket.user.id;
      
      // Check if user is a member of the group
      const query = `
        SELECT EXISTS(
          SELECT 1 
          FROM chat_group_members 
          WHERE user_id = $1 AND group_id = $2 AND user_type = 'real'
        )
      `;
      
      const result = await db.query(query, [userId, groupId]);
      const isMember = result.rows[0].exists;
      
      if (isMember) {
        const roomName = `group:${groupId}`;
        socket.join(roomName);
        socket.emit('joined-group', { groupId });
        console.log(`User ${userId} joined group ${groupId}`);
      } else {
        socket.emit('error', { message: 'Not a member of this group' });
      }
    } catch (error) {
      console.error('Error joining group:', error);
      socket.emit('error', { message: 'Failed to join group' });
    }
  }
  
  // Handle send message request
  async function handleSendMessage(socket, data) {
    try {
      const { groupId, content, messageType = 'text' } = data;
      const userId = socket.user.id;
      
      // Validate input
      if (!groupId || !content) {
        return socket.emit('error', { message: 'Group ID and content are required' });
      }
      
      // Check if user is a member of the group
      const memberQuery = `
        SELECT EXISTS(
          SELECT 1 
          FROM chat_group_members 
          WHERE user_id = $1 AND group_id = $2 AND user_type = 'real'
        )
      `;
      
      const memberResult = await db.query(memberQuery, [userId, groupId]);
      const isMember = memberResult.rows[0].exists;
      
      if (!isMember) {
        return socket.emit('error', { message: 'Not a member of this group' });
      }
      
      // Create message in database
      const messageQuery = `
        INSERT INTO chat_messages (
          group_id, 
          user_id, 
          user_type, 
          content, 
          message_type
        )
        VALUES ($1, $2, 'real', $3, $4)
        RETURNING id, created_at
      `;
      
      const messageResult = await db.query(messageQuery, [
        groupId,
        userId,
        content,
        messageType
      ]);
      
      const message = messageResult.rows[0];
      
      // Broadcast message to group
      const roomName = `group:${groupId}`;
      chatIo.to(roomName).emit('new-message', {
        id: message.id,
        groupId,
        userId,
        userType: 'real',
        content,
        messageType,
        createdAt: message.created_at
      });
      
      console.log(`User ${userId} sent message to group ${groupId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }
  
  // Handle typing indicator
  function handleTyping(socket, data) {
    try {
      const { groupId, isTyping } = data;
      const userId = socket.user.id;
      
      // Validate input
      if (!groupId) {
        return;
      }
      
      // Broadcast typing status to group
      const roomName = `group:${groupId}`;
      socket.to(roomName).emit('user-typing', {
        groupId,
        userId,
        isTyping
      });
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  }
  
  // Handle mark as read
  async function handleMarkRead(socket, data) {
    try {
      const { groupId, messageId } = data;
      const userId = socket.user.id;
      
      // Validate input
      if (!groupId || !messageId) {
        return;
      }
      
      // Update read status in database
      // This is a placeholder - implement based on your schema
      
      // Broadcast read receipt to group
      const roomName = `group:${groupId}`;
      socket.to(roomName).emit('message-read', {
        groupId,
        messageId,
        userId
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }
  
  // Function to emit a message to a group from the server (for admin-generated messages)
  function emitMessageToGroup(groupId, message) {
    const roomName = `group:${groupId}`;
    chatIo.to(roomName).emit('new-message', message);
    console.log(`Admin sent message to group ${groupId}`);
  }
  
  // Return functions that can be called from other modules
  return {
    emitMessageToGroup
  };
};

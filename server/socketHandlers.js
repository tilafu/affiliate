/**
 * Socket Handlers for Chat Functionality
 */

const pool = require('./config/db');
const logger = require('./utils/logger');
const jwt = require('jsonwebtoken');

// Helper function for database queries
const executeQuery = async (query, params = []) => {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error(`Database error in socket handler: ${error.message}`);
        throw new Error('Database operation failed');
    }
};

// Authentication middleware for Socket.IO
const authMiddleware = async (socket, next) => {
    try {
        // Get token from socket handshake
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentication required'));
        }
        
        try {
            // Verify JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cdot-pea-jwt-secret');
            
            // Get user from database
            const userQuery = 'SELECT id, username, role FROM users WHERE id = $1';
            const users = await executeQuery(userQuery, [decoded.id]);
            
            if (users.length === 0) {
                return next(new Error('User not found'));
            }
            
            // Attach user to socket
            socket.user = users[0];
            next();
            
        } catch (jwtError) {
            logger.error(`JWT verification error: ${jwtError.message}`);
            return next(new Error('Invalid token'));
        }
        
    } catch (error) {
        logger.error(`Socket authentication error: ${error.message}`);
        return next(new Error('Authentication error'));
    }
};

// Initialize Socket.IO with namespaces and event handlers
const initializeSocketIO = (io) => {
    // Chat namespace
    const chatNamespace = io.of('/chat');
    
    // Apply auth middleware
    chatNamespace.use(authMiddleware);
    
    // Handle connections
    chatNamespace.on('connection', (socket) => {
        logger.info(`User connected to chat: ${socket.user.id} (${socket.user.username})`);
        
        // Join user's groups
        joinUserGroups(socket);
        
        // Handle events
        socket.on('join-group', (groupId) => handleJoinGroup(socket, groupId));
        socket.on('typing', (data) => handleTyping(socket, data));
        socket.on('disconnect', () => handleDisconnect(socket));
        
        // Welcome message
        socket.emit('welcome', { 
            message: 'Connected to chat server',
            userId: socket.user.id
        });
    });
    
    // Return the namespace for external use
    return chatNamespace;
};

// Join all groups the user is a member of
async function joinUserGroups(socket) {
    try {
        const userId = socket.user.id;
        const isAdmin = socket.user.role === 'admin';
        
        let groupQuery;
        let params;
        
        if (isAdmin) {
            // Admins can see all active groups
            groupQuery = 'SELECT id FROM chat_groups WHERE is_active = true';
            params = [];
        } else {
            // Regular users only see groups they are members of
            groupQuery = `
                SELECT g.id 
                FROM chat_groups g
                JOIN chat_group_members m ON g.id = m.group_id
                WHERE m.user_id = $1 AND m.is_active = true AND g.is_active = true
            `;
            params = [userId];
        }
        
        const groups = await executeQuery(groupQuery, params);
        
        // Join each group's room
        groups.forEach(group => {
            const roomName = `group:${group.id}`;
            socket.join(roomName);
            logger.info(`User ${userId} joined room ${roomName}`);
        });
        
    } catch (error) {
        logger.error(`Error joining user groups: ${error.message}`);
    }
}

// Handle user explicitly joining a group
async function handleJoinGroup(socket, groupId) {
    try {
        const userId = socket.user.id;
        const isAdmin = socket.user.role === 'admin';
        
        // Verify access to group
        let hasAccess = false;
        
        if (isAdmin) {
            // Admins have access to all active groups
            const groupQuery = 'SELECT 1 FROM chat_groups WHERE id = $1 AND is_active = true';
            const groups = await executeQuery(groupQuery, [groupId]);
            hasAccess = groups.length > 0;
        } else {
            // Regular users need to be members
            const memberQuery = `
                SELECT 1 FROM chat_group_members 
                WHERE group_id = $1 AND user_id = $2 AND is_active = true
            `;
            const members = await executeQuery(memberQuery, [groupId, userId]);
            hasAccess = members.length > 0;
        }
        
        if (hasAccess) {
            const roomName = `group:${groupId}`;
            socket.join(roomName);
            socket.emit('joined-group', { groupId });
            logger.info(`User ${userId} explicitly joined group ${groupId}`);
        } else {
            socket.emit('error', { message: 'Access denied to this group' });
        }
        
    } catch (error) {
        logger.error(`Error joining group: ${error.message}`);
        socket.emit('error', { message: 'Failed to join group' });
    }
}

// Handle typing indicators
function handleTyping(socket, data) {
    try {
        const { group_id } = data;
        if (!group_id) return;
        
        const roomName = `group:${group_id}`;
        
        // Emit to everyone in the group except the sender
        socket.to(roomName).emit('user-typing', {
            group_id,
            userId: socket.user.id,
            username: socket.user.username
        });
        
    } catch (error) {
        logger.error(`Error handling typing indicator: ${error.message}`);
    }
}

// Handle disconnections
function handleDisconnect(socket) {
    logger.info(`User disconnected from chat: ${socket.user.id} (${socket.user.username})`);
}

module.exports = {
    initializeSocketIO
};

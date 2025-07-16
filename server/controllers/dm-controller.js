/**
 * Direct Message (DM) Controller
 * Handles all DM related operations between users
 */

const pool = require('../config/db');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Get all DM conversations for the current user
const getDMConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Different query for admin vs regular users
        let query;
        let queryParams;
        
        if (isAdmin) {
            // Admins can see all DM conversations
            query = `
                SELECT c.*, 
                    u1.username as user1_username, 
                    u2.username as user2_username,
                    u1.profile_image_url as user1_profile_image,
                    u2.profile_image_url as user2_profile_image,
                    u1.role as user1_role,
                    u2.role as user2_role,
                    (SELECT m.message FROM chat_dm_messages m 
                     WHERE m.conversation_id = c.id 
                     ORDER BY m.created_at DESC LIMIT 1) as last_message,
                    (SELECT COUNT(*) FROM chat_dm_messages m 
                     WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_id != $1) as unread_count
                FROM chat_dm_conversations c
                JOIN users u1 ON c.user_id_1 = u1.id
                JOIN users u2 ON c.user_id_2 = u2.id
                ORDER BY c.last_message_at DESC
            `;
            queryParams = [userId];
        } else {
            // Regular users only see their own conversations
            query = `
                SELECT c.*, 
                    u1.username as user1_username, 
                    u2.username as user2_username,
                    u1.profile_image_url as user1_profile_image,
                    u2.profile_image_url as user2_profile_image,
                    u1.role as user1_role,
                    u2.role as user2_role,
                    (SELECT m.message FROM chat_dm_messages m 
                     WHERE m.conversation_id = c.id 
                     ORDER BY m.created_at DESC LIMIT 1) as last_message,
                    (SELECT COUNT(*) FROM chat_dm_messages m 
                     WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_id != $1) as unread_count
                FROM chat_dm_conversations c
                JOIN users u1 ON c.user_id_1 = u1.id
                JOIN users u2 ON c.user_id_2 = u2.id
                WHERE c.user_id_1 = $1 OR c.user_id_2 = $1
                ORDER BY c.last_message_at DESC
            `;
            queryParams = [userId];
        }
        
        const result = await pool.query(query, queryParams);
        
        // Transform the result to include the other user's details
        const conversations = result.rows.map(conv => {
            const isUser1 = conv.user_id_1 === userId;
            const otherUserId = isUser1 ? conv.user_id_2 : conv.user_id_1;
            const otherUsername = isUser1 ? conv.user2_username : conv.user1_username;
            const otherUserRole = isUser1 ? conv.user2_role : conv.user1_role;
            const otherUserProfileImage = isUser1 ? conv.user2_profile_image : conv.user1_profile_image;
            
            return {
                id: conv.id,
                otherUserId,
                otherUsername,
                otherUserRole,
                otherUserProfileImage,
                lastMessage: conv.last_message,
                lastMessageAt: conv.last_message_at,
                unreadCount: parseInt(conv.unread_count, 10)
            };
        });
        
        res.json({ conversations });
    } catch (error) {
        logger.error(`Error getting DM conversations: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching DM conversations' });
    }
};

// Get messages for a specific conversation
const getDMMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // First check if user has access to this conversation
        const accessQuery = `
            SELECT * FROM chat_dm_conversations
            WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
        `;
        
        const accessResult = await pool.query(accessQuery, [conversationId, userId]);
        
        // Admin bypass or check regular user access
        if (!isAdmin && accessResult.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this conversation' });
        }
        
        // Get messages for the conversation
        const messagesQuery = `
            SELECT m.*, u.username, u.role, u.profile_image_url
            FROM chat_dm_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
        `;
        
        const messagesResult = await pool.query(messagesQuery, [conversationId]);
        
        // Mark messages as read if they were sent to the current user
        const markReadQuery = `
            UPDATE chat_dm_messages
            SET is_read = true
            WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
        `;
        
        await pool.query(markReadQuery, [conversationId, userId]);
        
        res.json({ messages: messagesResult.rows });
    } catch (error) {
        logger.error(`Error getting DM messages: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching DM messages' });
    }
};

// Create a new DM conversation
const createDMConversation = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { recipientId } = req.body;
        const userId = req.user.id;
        
        // Don't allow creating a conversation with yourself
        if (parseInt(recipientId, 10) === userId) {
            return res.status(400).json({ message: 'Cannot start a conversation with yourself' });
        }
        
        // Check if recipient exists
        const userCheckQuery = 'SELECT id FROM users WHERE id = $1';
        const userCheckResult = await pool.query(userCheckQuery, [recipientId]);
        
        if (userCheckResult.rows.length === 0) {
            return res.status(404).json({ message: 'Recipient user not found' });
        }
        
        // Check if conversation already exists
        const conversationCheckQuery = `
            SELECT id FROM chat_dm_conversations
            WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)
        `;
        
        const conversationCheckResult = await pool.query(
            conversationCheckQuery, 
            [userId, recipientId]
        );
        
        if (conversationCheckResult.rows.length > 0) {
            // Return existing conversation
            return res.json({ 
                conversationId: conversationCheckResult.rows[0].id,
                message: 'Conversation already exists'
            });
        }
        
        // Create new conversation with lower ID as user_id_1 for consistency
        const user1 = Math.min(userId, parseInt(recipientId, 10));
        const user2 = Math.max(userId, parseInt(recipientId, 10));
        
        const createConversationQuery = `
            INSERT INTO chat_dm_conversations (user_id_1, user_id_2, created_at, last_message_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING id
        `;
        
        const createResult = await pool.query(
            createConversationQuery,
            [user1, user2]
        );
        
        res.status(201).json({ 
            conversationId: createResult.rows[0].id,
            message: 'Conversation created successfully'
        });
    } catch (error) {
        logger.error(`Error creating DM conversation: ${error.message}`);
        res.status(500).json({ message: 'Server error while creating DM conversation' });
    }
};

// Send a message in a DM conversation
const sendDMMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { conversationId } = req.params;
        const { message, messageType = 'text' } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Validate message type
        const validMessageTypes = ['text', 'image', 'file', 'voicenote'];
        if (!validMessageTypes.includes(messageType)) {
            return res.status(400).json({ message: 'Invalid message type' });
        }
        
        // For non-admin users, check if they are part of the conversation
        if (!isAdmin) {
            const accessQuery = `
                SELECT * FROM chat_dm_conversations
                WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
            `;
            
            const accessResult = await pool.query(accessQuery, [conversationId, userId]);
            
            if (accessResult.rows.length === 0) {
                return res.status(403).json({ message: 'Access denied to this conversation' });
            }
        }
        
        // Handle file uploads if present
        let attachmentUrl = null;
        if (req.files && req.files.attachment) {
            const attachment = req.files.attachment;
            const uploadDir = path.join(__dirname, '../../public/uploads/dm');
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            // Generate unique filename
            const fileName = `${uuidv4()}_${attachment.name}`;
            const filePath = path.join(uploadDir, fileName);
            
            // Move the file
            await attachment.mv(filePath);
            
            // Set the attachment URL
            attachmentUrl = `/uploads/dm/${fileName}`;
        }
        
        // Insert the message
        const insertMessageQuery = `
            INSERT INTO chat_dm_messages (conversation_id, sender_id, message, message_type, attachment_url, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `;
        
        const messageResult = await pool.query(
            insertMessageQuery,
            [conversationId, userId, message, messageType, attachmentUrl]
        );
        
        // Update the conversation's last_message_at timestamp
        const updateConversationQuery = `
            UPDATE chat_dm_conversations
            SET last_message_at = NOW()
            WHERE id = $1
        `;
        
        await pool.query(updateConversationQuery, [conversationId]);
        
        // Get sender details to include in response
        const senderQuery = `
            SELECT username, role, profile_image_url
            FROM users
            WHERE id = $1
        `;
        
        const senderResult = await pool.query(senderQuery, [userId]);
        
        // Combine message with sender details
        const messageWithSender = {
            ...messageResult.rows[0],
            username: senderResult.rows[0].username,
            role: senderResult.rows[0].role,
            profile_image_url: senderResult.rows[0].profile_image_url
        };
        
        res.status(201).json({ 
            message: 'Message sent successfully',
            messageData: messageWithSender
        });
    } catch (error) {
        logger.error(`Error sending DM message: ${error.message}`);
        res.status(500).json({ message: 'Server error while sending DM message' });
    }
};

// Delete a DM conversation
const deleteDMConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // For non-admin users, check if they are part of the conversation
        if (!isAdmin) {
            const accessQuery = `
                SELECT * FROM chat_dm_conversations
                WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
            `;
            
            const accessResult = await pool.query(accessQuery, [conversationId, userId]);
            
            if (accessResult.rows.length === 0) {
                return res.status(403).json({ message: 'Access denied to this conversation' });
            }
        }
        
        // Begin transaction
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Delete all messages in the conversation
            const deleteMessagesQuery = `
                DELETE FROM chat_dm_messages
                WHERE conversation_id = $1
            `;
            
            await client.query(deleteMessagesQuery, [conversationId]);
            
            // Delete the conversation
            const deleteConversationQuery = `
                DELETE FROM chat_dm_conversations
                WHERE id = $1
            `;
            
            await client.query(deleteConversationQuery, [conversationId]);
            
            await client.query('COMMIT');
            
            res.json({ message: 'Conversation deleted successfully' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error(`Error deleting DM conversation: ${error.message}`);
        res.status(500).json({ message: 'Server error while deleting DM conversation' });
    }
};

// Get all messages for a fake user (admin only)
const getFakeUserMessages = async (req, res) => {
    try {
        // Only admins can access this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only endpoint.' });
        }
        
        const { fakeUserId } = req.params;
        
        // Check if the fake user exists
        const userCheckQuery = `
            SELECT id, username, role FROM users
            WHERE id = $1 AND role = 'fake'
        `;
        
        const userCheckResult = await pool.query(userCheckQuery, [fakeUserId]);
        
        if (userCheckResult.rows.length === 0) {
            return res.status(404).json({ message: 'Fake user not found' });
        }
        
        // Get all DM messages for the fake user
        const dmMessagesQuery = `
            SELECT m.*, c.user_id_1, c.user_id_2, 
                   u_sender.username as sender_username,
                   u_recipient.username as recipient_username,
                   'dm' as message_type
            FROM chat_dm_messages m
            JOIN chat_dm_conversations c ON m.conversation_id = c.id
            JOIN users u_sender ON m.sender_id = u_sender.id
            JOIN users u_recipient ON (
                CASE 
                    WHEN c.user_id_1 = m.sender_id THEN c.user_id_2
                    ELSE c.user_id_1
                END
            ) = u_recipient.id
            WHERE c.user_id_1 = $1 OR c.user_id_2 = $1
            ORDER BY m.created_at DESC
        `;
        
        const dmResult = await pool.query(dmMessagesQuery, [fakeUserId]);
        
        // Get all group messages from the fake user
        const groupMessagesQuery = `
            SELECT m.*, g.name as group_name, u.username as sender_username,
                   'group' as message_type
            FROM chat_messages m
            JOIN chat_groups g ON m.group_id = g.id
            JOIN users u ON m.sender_id = u.id
            WHERE m.sender_id = $1
            ORDER BY m.created_at DESC
        `;
        
        const groupResult = await pool.query(groupMessagesQuery, [fakeUserId]);
        
        // Combine and sort all messages by creation date
        const allMessages = [
            ...dmResult.rows,
            ...groupResult.rows
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json({ 
            fakeUser: userCheckResult.rows[0],
            messages: allMessages
        });
    } catch (error) {
        logger.error(`Error getting fake user messages: ${error.message}`);
        res.status(500).json({ message: 'Server error while getting fake user messages' });
    }
};

module.exports = {
    getDMConversations,
    getDMMessages,
    createDMConversation,
    sendDMMessage,
    deleteDMConversation,
    getFakeUserMessages
};

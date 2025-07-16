/**
 * Enhanced Direct Message (DM) Controller
 * Handles all DM related operations with enhanced features
 */

const pool = require('../config/db');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/dm-attachments');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|mp3|mp4|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Get all DM conversations for the current user with enhanced features
const getDMConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Use the enhanced view for better performance
        let query;
        let queryParams;
        
        if (isAdmin) {
            // Admins can see all conversations
            query = `
                SELECT 
                    cs.*,
                    CASE 
                        WHEN cs.user_id_1 = $1 THEN cs.user_id_2
                        ELSE cs.user_id_1
                    END as other_user_id,
                    CASE 
                        WHEN cs.user_id_1 = $1 THEN cs.user2_username
                        ELSE cs.user1_username
                    END as other_username,
                    settings.is_muted,
                    settings.custom_nickname,
                    settings.notifications_enabled
                FROM dm_conversation_summary cs
                LEFT JOIN chat_dm_conversation_settings settings 
                    ON cs.conversation_id = settings.conversation_id 
                    AND settings.user_id = $1
                WHERE cs.conversation_status = 'active'
                ORDER BY cs.last_message_at DESC
            `;
            queryParams = [userId];
        } else {
            // Regular users only see their conversations
            query = `
                SELECT 
                    cs.*,
                    CASE 
                        WHEN cs.user_id_1 = $1 THEN cs.user_id_2
                        ELSE cs.user_id_1
                    END as other_user_id,
                    CASE 
                        WHEN cs.user_id_1 = $1 THEN cs.user2_username
                        ELSE cs.user1_username
                    END as other_username,
                    settings.is_muted,
                    settings.custom_nickname,
                    settings.notifications_enabled
                FROM dm_conversation_summary cs
                LEFT JOIN chat_dm_conversation_settings settings 
                    ON cs.conversation_id = settings.conversation_id 
                    AND settings.user_id = $1
                WHERE (cs.user_id_1 = $1 OR cs.user_id_2 = $1)
                    AND cs.conversation_status = 'active'
                ORDER BY cs.last_message_at DESC
            `;
            queryParams = [userId];
        }
        
        const result = await pool.query(query, queryParams);
        
        const conversations = result.rows.map(conv => ({
            id: conv.conversation_id,
            otherUserId: conv.other_user_id,
            otherUsername: conv.custom_nickname || conv.other_username,
            lastMessage: conv.last_message,
            lastMessageType: conv.last_message_type,
            lastMessageAt: conv.last_message_at,
            unreadCount: parseInt(conv.unread_count, 10),
            isMuted: conv.is_muted || false,
            notificationsEnabled: conv.notifications_enabled !== false
        }));
        
        res.json({ conversations });
    } catch (error) {
        logger.error(`Error getting DM conversations: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching DM conversations' });
    }
};

// Get messages for a specific conversation with enhanced features
const getDMMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const { page = 1, limit = 50 } = req.query;
        
        const offset = (page - 1) * limit;
        
        // Check access to conversation
        const accessQuery = `
            SELECT * FROM chat_dm_conversations
            WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2) AND status = 'active'
        `;
        
        const accessResult = await pool.query(accessQuery, [conversationId, userId]);
        
        if (!isAdmin && accessResult.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this conversation' });
        }
        
        // Get messages with attachments and reactions
        const messagesQuery = `
            SELECT 
                m.*,
                u.username,
                u.role,
                u.profile_image_url,
                COALESCE(
                    json_agg(
                        CASE WHEN a.id IS NOT NULL THEN
                            json_build_object(
                                'id', a.id,
                                'originalFilename', a.original_filename,
                                'filePath', a.file_path,
                                'fileSize', a.file_size,
                                'mimeType', a.mime_type
                            )
                        END
                    ) FILTER (WHERE a.id IS NOT NULL), '[]'::json
                ) as attachments,
                COALESCE(
                    json_agg(
                        CASE WHEN r.id IS NOT NULL THEN
                            json_build_object(
                                'id', r.id,
                                'userId', r.user_id,
                                'reactionType', r.reaction_type,
                                'username', ru.username
                            )
                        END
                    ) FILTER (WHERE r.id IS NOT NULL), '[]'::json
                ) as reactions
            FROM chat_dm_messages m
            JOIN users u ON m.sender_id = u.id
            LEFT JOIN chat_dm_attachments a ON m.id = a.message_id
            LEFT JOIN chat_dm_message_reactions r ON m.id = r.message_id
            LEFT JOIN users ru ON r.user_id = ru.id
            WHERE m.conversation_id = $1 AND m.status != 'deleted'
            GROUP BY m.id, u.username, u.role, u.profile_image_url
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const messagesResult = await pool.query(messagesQuery, [conversationId, limit, offset]);
        
        // Mark messages as read and update notifications
        const markReadQuery = `
            UPDATE chat_dm_notifications
            SET is_read = true
            WHERE conversation_id = $1 AND user_id = $2 AND is_read = false
        `;
        
        await pool.query(markReadQuery, [conversationId, userId]);
        
        res.json({ 
            messages: messagesResult.rows.reverse(), // Reverse to show oldest first
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: messagesResult.rows.length === parseInt(limit)
            }
        });
    } catch (error) {
        logger.error(`Error getting DM messages: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching DM messages' });
    }
};

// Create a new DM conversation with enhanced features
const createDMConversation = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { recipientId } = req.body;
        const userId = req.user.id;
        
        if (parseInt(recipientId) === userId) {
            return res.status(400).json({ message: 'Cannot create conversation with yourself' });
        }
        
        // Check if recipient exists
        const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [recipientId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Recipient not found' });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if conversation already exists (order doesn't matter due to trigger)
            const existingQuery = `
                SELECT id FROM chat_dm_conversations
                WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
                    AND status = 'active'
            `;
            
            const existing = await client.query(existingQuery, [userId, recipientId]);
            
            if (existing.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.json({ 
                    conversationId: existing.rows[0].id,
                    message: 'Conversation already exists'
                });
            }
            
            // Create new conversation (trigger will handle user ordering)
            const conversationResult = await client.query(
                `INSERT INTO chat_dm_conversations (user_id_1, user_id_2, status)
                 VALUES ($1, $2, 'active') RETURNING id`,
                [userId, recipientId]
            );
            
            const conversationId = conversationResult.rows[0].id;
            
            // Add participants (will be handled by the migration script for existing conversations)
            await client.query(
                `INSERT INTO chat_dm_participants (conversation_id, user_id, role)
                 VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
                [conversationId, userId, recipientId]
            );
            
            // Create default settings for both users
            await client.query(
                `INSERT INTO chat_dm_conversation_settings (conversation_id, user_id)
                 VALUES ($1, $2), ($1, $3)`,
                [conversationId, userId, recipientId]
            );
            
            await client.query('COMMIT');
            
            res.status(201).json({ 
                conversationId,
                message: 'Conversation created successfully'
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error(`Error creating DM conversation: ${error.message}`);
        res.status(500).json({ message: 'Server error while creating DM conversation' });
    }
};

// Send a message with enhanced features (attachments, different types)
const sendDMMessage = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { conversationId } = req.params;
        const { message, messageType = 'text' } = req.body;
        const userId = req.user.id;
        const file = req.file;
        
        // Validate message content based on type
        if (messageType === 'text' && !message) {
            return res.status(400).json({ message: 'Text message content is required' });
        }
        
        if (['image', 'file', 'voicenote'].includes(messageType) && !file) {
            return res.status(400).json({ message: 'File attachment is required for this message type' });
        }
        
        // Check conversation access
        const accessQuery = `
            SELECT * FROM chat_dm_conversations
            WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2) AND status = 'active'
        `;
        
        const accessResult = await pool.query(accessQuery, [conversationId, userId]);
        
        if (accessResult.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this conversation' });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Insert message
            const messageResult = await client.query(
                `INSERT INTO chat_dm_messages 
                 (conversation_id, sender_id, message, message_type, status)
                 VALUES ($1, $2, $3, $4, 'sent') RETURNING id`,
                [conversationId, userId, message || '', messageType]
            );
            
            const messageId = messageResult.rows[0].id;
            
            // Handle file attachment if present
            if (file) {
                await client.query(
                    `INSERT INTO chat_dm_attachments 
                     (message_id, original_filename, stored_filename, file_path, file_size, mime_type)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        messageId,
                        file.originalname,
                        file.filename,
                        file.path,
                        file.size,
                        file.mimetype
                    ]
                );
            }
            
            await client.query('COMMIT');
            
            // Get the complete message with attachments for response
            const newMessageQuery = `
                SELECT 
                    m.*,
                    u.username,
                    COALESCE(
                        json_agg(
                            CASE WHEN a.id IS NOT NULL THEN
                                json_build_object(
                                    'id', a.id,
                                    'originalFilename', a.original_filename,
                                    'filePath', a.file_path,
                                    'fileSize', a.file_size,
                                    'mimeType', a.mime_type
                                )
                            END
                        ) FILTER (WHERE a.id IS NOT NULL), '[]'::json
                    ) as attachments
                FROM chat_dm_messages m
                JOIN users u ON m.sender_id = u.id
                LEFT JOIN chat_dm_attachments a ON m.id = a.message_id
                WHERE m.id = $1
                GROUP BY m.id, u.username
            `;
            
            const newMessage = await pool.query(newMessageQuery, [messageId]);
            
            res.status(201).json({ 
                message: 'Message sent successfully',
                data: newMessage.rows[0]
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error(`Error sending DM message: ${error.message}`);
        res.status(500).json({ message: 'Server error while sending DM message' });
    }
};

// Add reaction to a message
const addMessageReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reactionType } = req.body;
        const userId = req.user.id;
        
        if (!reactionType) {
            return res.status(400).json({ message: 'Reaction type is required' });
        }
        
        // Check if user has access to this message
        const accessQuery = `
            SELECT m.* FROM chat_dm_messages m
            JOIN chat_dm_conversations c ON m.conversation_id = c.id
            WHERE m.id = $1 AND (c.user_id_1 = $2 OR c.user_id_2 = $2)
        `;
        
        const accessResult = await pool.query(accessQuery, [messageId, userId]);
        
        if (accessResult.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this message' });
        }
        
        // Add or update reaction
        const reactionResult = await pool.query(
            `INSERT INTO chat_dm_message_reactions (message_id, user_id, reaction_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (message_id, user_id, reaction_type) 
             DO UPDATE SET created_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [messageId, userId, reactionType]
        );
        
        res.json({ 
            message: 'Reaction added successfully',
            reactionId: reactionResult.rows[0].id
        });
        
    } catch (error) {
        logger.error(`Error adding message reaction: ${error.message}`);
        res.status(500).json({ message: 'Server error while adding reaction' });
    }
};

// Remove reaction from a message
const removeMessageReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reactionType } = req.body;
        const userId = req.user.id;
        
        const result = await pool.query(
            `DELETE FROM chat_dm_message_reactions
             WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3`,
            [messageId, userId, reactionType]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Reaction not found' });
        }
        
        res.json({ message: 'Reaction removed successfully' });
        
    } catch (error) {
        logger.error(`Error removing message reaction: ${error.message}`);
        res.status(500).json({ message: 'Server error while removing reaction' });
    }
};

// Update conversation settings
const updateConversationSettings = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { notificationsEnabled, isMuted, mutedUntil, customNickname } = req.body;
        const userId = req.user.id;
        
        // Check conversation access
        const accessQuery = `
            SELECT * FROM chat_dm_conversations
            WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
        `;
        
        const accessResult = await pool.query(accessQuery, [conversationId, userId]);
        
        if (accessResult.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this conversation' });
        }
        
        // Update settings
        const updateQuery = `
            UPDATE chat_dm_conversation_settings
            SET 
                notifications_enabled = COALESCE($3, notifications_enabled),
                is_muted = COALESCE($4, is_muted),
                muted_until = COALESCE($5, muted_until),
                custom_nickname = COALESCE($6, custom_nickname),
                updated_at = CURRENT_TIMESTAMP
            WHERE conversation_id = $1 AND user_id = $2
        `;
        
        await pool.query(updateQuery, [
            conversationId, 
            userId, 
            notificationsEnabled,
            isMuted,
            mutedUntil,
            customNickname
        ]);
        
        res.json({ message: 'Settings updated successfully' });
        
    } catch (error) {
        logger.error(`Error updating conversation settings: ${error.message}`);
        res.status(500).json({ message: 'Server error while updating settings' });
    }
};

// Delete/Archive conversation
const deleteDMConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Check access
        const accessQuery = `
            SELECT * FROM chat_dm_conversations
            WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
        `;
        
        const accessResult = await pool.query(accessQuery, [conversationId, userId]);
        
        if (!isAdmin && accessResult.rows.length === 0) {
            return res.status(403).json({ message: 'Access denied to this conversation' });
        }
        
        // Archive conversation instead of hard delete
        await pool.query(
            `UPDATE chat_dm_conversations 
             SET status = 'archived' 
             WHERE id = $1`,
            [conversationId]
        );
        
        res.json({ message: 'Conversation archived successfully' });
        
    } catch (error) {
        logger.error(`Error deleting DM conversation: ${error.message}`);
        res.status(500).json({ message: 'Server error while deleting conversation' });
    }
};

// Get fake user messages (admin only)
const getFakeUserMessages = async (req, res) => {
    try {
        const { fakeUserId } = req.params;
        const isAdmin = req.user.role === 'admin';
        
        if (!isAdmin) {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        const query = `
            SELECT m.*, c.user_id_1, c.user_id_2, u.username as sender_username
            FROM chat_dm_messages m
            JOIN chat_dm_conversations c ON m.conversation_id = c.id
            JOIN users u ON m.sender_id = u.id
            WHERE c.user_id_1 = $1 OR c.user_id_2 = $1
            ORDER BY m.created_at DESC
        `;
        
        const result = await pool.query(query, [fakeUserId]);
        
        res.json({ messages: result.rows });
        
    } catch (error) {
        logger.error(`Error getting fake user messages: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching fake user messages' });
    }
};

// Get unread notifications count
const getUnreadNotificationsCount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const query = `
            SELECT COUNT(*) as unread_count
            FROM chat_dm_notifications
            WHERE user_id = $1 AND is_read = false
        `;
        
        const result = await pool.query(query, [userId]);
        
        res.json({ unreadCount: parseInt(result.rows[0].unread_count, 10) });
        
    } catch (error) {
        logger.error(`Error getting unread notifications count: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching notifications count' });
    }
};

module.exports = {
    upload,
    getDMConversations,
    getDMMessages,
    createDMConversation,
    sendDMMessage,
    addMessageReaction,
    removeMessageReaction,
    updateConversationSettings,
    deleteDMConversation,
    getFakeUserMessages,
    getUnreadNotificationsCount
};

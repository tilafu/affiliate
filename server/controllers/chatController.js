const pool = require('../config/db');
const logger = require('../utils/logger');

// Helper function to execute database queries
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
        logger.error(`Database error: ${error.message}`);
        throw new Error('Database operation failed');
    }
};

// Helper function to log admin actions
const logAdminAction = async (adminId, actionType, entityType, entityId, details = {}) => {
    try {
        const query = `
            INSERT INTO chat_admin_logs 
            (admin_id, action_type, entity_type, entity_id, details, created_at) 
            VALUES ($1, $2, $3, $4, $5, NOW())
        `;
        await executeQuery(query, [adminId, actionType, entityType, entityId, JSON.stringify(details)]);
    } catch (error) {
        logger.error(`Failed to log admin action: ${error.message}`);
        // Don't throw here to avoid disrupting the main flow
    }
};

// Group Controllers
exports.getUserGroups = async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        let query;
        let params;
        
        if (isAdmin) {
            // Admins can see all active groups
            query = `
                SELECT g.* 
                FROM chat_groups g
                WHERE g.is_active = true
                ORDER BY g.updated_at DESC
            `;
            params = [];
        } else {
            // Regular users only see groups they are members of
            query = `
                SELECT g.* 
                FROM chat_groups g
                JOIN chat_group_members m ON g.id = m.group_id
                WHERE m.user_id = $1 
                AND m.is_active = true
                AND g.is_active = true
                ORDER BY g.updated_at DESC
            `;
            params = [userId];
        }
        
        const groups = await executeQuery(query, params);
        
        // Get the last message for each group
        for (const group of groups) {
            const messageQuery = `
                SELECT m.id, m.content, m.created_at, 
                       COALESCE(u.username, fu.username) as sender_name,
                       CASE WHEN m.user_id IS NOT NULL THEN false ELSE true END as is_fake_user
                FROM chat_messages m
                LEFT JOIN users u ON m.user_id = u.id
                LEFT JOIN chat_fake_users fu ON m.fake_user_id = fu.id
                WHERE m.group_id = $1
                ORDER BY m.created_at DESC
                LIMIT 1
            `;
            const messages = await executeQuery(messageQuery, [group.id]);
            group.last_message = messages.length > 0 ? messages[0] : null;
            
            // Get unread message count
            if (!isAdmin) {
                const unreadQuery = `
                    SELECT COUNT(*) as count
                    FROM chat_messages m
                    LEFT JOIN chat_group_members gm ON m.group_id = gm.group_id AND gm.user_id = $1
                    WHERE m.group_id = $2
                    AND (m.created_at > gm.last_read_at OR gm.last_read_at IS NULL)
                `;
                const unreadResult = await executeQuery(unreadQuery, [userId, group.id]);
                group.unread_count = unreadResult[0].count;
            }
        }
        
        res.json(groups);
    } catch (error) {
        logger.error(`Error in getUserGroups: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve groups' });
    }
};

exports.getGroupDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Check if user has access to this group
        if (!isAdmin) {
            const accessCheck = await executeQuery(
                'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
                [id, userId]
            );
            
            if (accessCheck.length === 0) {
                return res.status(403).json({ error: 'Access denied to this group' });
            }
        }
        
        // Get group details
        const query = 'SELECT * FROM chat_groups WHERE id = $1 AND is_active = true';
        const groups = await executeQuery(query, [id]);
        
        if (groups.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const group = groups[0];
        
        // Get member count
        const countQuery = 'SELECT COUNT(*) as member_count FROM chat_group_members WHERE group_id = $1 AND is_active = true';
        const countResult = await executeQuery(countQuery, [id]);
        group.member_count = countResult[0].member_count;
        
        // Update last read time if user is not admin
        if (!isAdmin) {
            await executeQuery(
                'UPDATE chat_group_members SET last_read_at = NOW() WHERE group_id = $1 AND user_id = $2',
                [id, userId]
            );
        }
        
        res.json(group);
    } catch (error) {
        logger.error(`Error in getGroupDetails: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve group details' });
    }
};

exports.createGroup = async (req, res) => {
    try {
        const { name, description, group_type, max_members } = req.body;
        const adminId = req.user.id;
        
        // Validate input
        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        // Create group
        const query = `
            INSERT INTO chat_groups 
            (name, description, group_type, max_members, is_active, created_by, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
            RETURNING *
        `;
        
        const result = await executeQuery(
            query, 
            [name, description, group_type, max_members, adminId]
        );
        
        const group = result[0];
        
        // Log admin action
        await logAdminAction(adminId, 'CREATE', 'GROUP', group.id, { name });
        
        res.status(201).json(group);
    } catch (error) {
        logger.error(`Error in createGroup: ${error.message}`);
        res.status(500).json({ error: 'Failed to create group' });
    }
};

exports.updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, group_type, max_members, is_active } = req.body;
        const adminId = req.user.id;
        
        // Validate input
        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        // Check if group exists
        const checkQuery = 'SELECT * FROM chat_groups WHERE id = $1';
        const groups = await executeQuery(checkQuery, [id]);
        
        if (groups.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Update group
        const query = `
            UPDATE chat_groups 
            SET name = $1, 
                description = $2, 
                group_type = $3, 
                max_members = $4, 
                is_active = $5, 
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `;
        
        const result = await executeQuery(
            query, 
            [name, description, group_type, max_members, is_active, id]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'UPDATE', 'GROUP', id, { 
            name, description, group_type, max_members, is_active 
        });
        
        res.json(result[0]);
    } catch (error) {
        logger.error(`Error in updateGroup: ${error.message}`);
        res.status(500).json({ error: 'Failed to update group' });
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        // Check if group exists
        const checkQuery = 'SELECT * FROM chat_groups WHERE id = $1';
        const groups = await executeQuery(checkQuery, [id]);
        
        if (groups.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Soft delete by setting is_active to false
        const query = `
            UPDATE chat_groups 
            SET is_active = false, 
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        
        await executeQuery(query, [id]);
        
        // Also deactivate all members
        await executeQuery(
            'UPDATE chat_group_members SET is_active = false WHERE group_id = $1',
            [id]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'DELETE', 'GROUP', id);
        
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        logger.error(`Error in deleteGroup: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete group' });
    }
};

// Group Members Controllers
exports.getGroupMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Check if user has access to this group
        if (!isAdmin) {
            const accessCheck = await executeQuery(
                'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
                [id, userId]
            );
            
            if (accessCheck.length === 0) {
                return res.status(403).json({ error: 'Access denied to this group' });
            }
        }
        
        // Get group members (real users)
        const userMembersQuery = `
            SELECT gm.id, gm.user_id, gm.join_date, gm.is_active, gm.last_read_at,
                   u.username, 'user' as member_type
            FROM chat_group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = $1 AND gm.user_id IS NOT NULL AND gm.is_active = true
        `;
        
        const userMembers = await executeQuery(userMembersQuery, [id]);
        
        // Get fake user members (admin avatars)
        const fakeUserMembersQuery = `
            SELECT gm.id, gm.fake_user_id, gm.join_date, gm.is_active, gm.last_read_at,
                   fu.username, fu.display_name, fu.avatar_url, 'fake_user' as member_type
            FROM chat_group_members gm
            JOIN chat_fake_users fu ON gm.fake_user_id = fu.id
            WHERE gm.group_id = $1 AND gm.fake_user_id IS NOT NULL AND gm.is_active = true
        `;
        
        const fakeUserMembers = await executeQuery(fakeUserMembersQuery, [id]);
        
        // Combine both types of members
        const members = [...userMembers, ...fakeUserMembers];
        
        res.json(members);
    } catch (error) {
        logger.error(`Error in getGroupMembers: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve group members' });
    }
};

exports.addGroupMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, fake_user_id } = req.body;
        const adminId = req.user.id;
        
        // Validate input
        if (!user_id && !fake_user_id) {
            return res.status(400).json({ error: 'Either user_id or fake_user_id must be provided' });
        }
        
        if (user_id && fake_user_id) {
            return res.status(400).json({ error: 'Only one of user_id or fake_user_id should be provided' });
        }
        
        // Check if group exists
        const groupCheck = await executeQuery(
            'SELECT * FROM chat_groups WHERE id = $1 AND is_active = true',
            [id]
        );
        
        if (groupCheck.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if user/fake_user exists
        if (user_id) {
            const userCheck = await executeQuery('SELECT * FROM users WHERE id = $1', [user_id]);
            if (userCheck.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
        } else {
            const fakeUserCheck = await executeQuery(
                'SELECT * FROM chat_fake_users WHERE id = $1 AND is_active = true',
                [fake_user_id]
            );
            if (fakeUserCheck.length === 0) {
                return res.status(404).json({ error: 'Fake user not found' });
            }
        }
        
        // Check if member already exists
        const memberCheck = user_id 
            ? await executeQuery(
                'SELECT * FROM chat_group_members WHERE group_id = $1 AND user_id = $2',
                [id, user_id]
              )
            : await executeQuery(
                'SELECT * FROM chat_group_members WHERE group_id = $1 AND fake_user_id = $2',
                [id, fake_user_id]
              );
        
        if (memberCheck.length > 0) {
            // If member exists but is inactive, reactivate
            if (!memberCheck[0].is_active) {
                const updateQuery = `
                    UPDATE chat_group_members 
                    SET is_active = true, join_date = NOW()
                    WHERE id = $1
                    RETURNING *
                `;
                
                const result = await executeQuery(updateQuery, [memberCheck[0].id]);
                
                // Log admin action
                await logAdminAction(adminId, 'REACTIVATE', 'GROUP_MEMBER', result[0].id, { 
                    group_id: id, user_id, fake_user_id 
                });
                
                return res.json(result[0]);
            }
            
            return res.status(409).json({ error: 'Member already exists in this group' });
        }
        
        // Add new member
        const query = `
            INSERT INTO chat_group_members 
            (group_id, user_id, fake_user_id, join_date, is_active) 
            VALUES ($1, $2, $3, NOW(), true)
            RETURNING *
        `;
        
        const result = await executeQuery(query, [id, user_id, fake_user_id]);
        
        // Log admin action
        await logAdminAction(adminId, 'ADD', 'GROUP_MEMBER', result[0].id, { 
            group_id: id, user_id, fake_user_id 
        });
        
        res.status(201).json(result[0]);
    } catch (error) {
        logger.error(`Error in addGroupMember: ${error.message}`);
        res.status(500).json({ error: 'Failed to add group member' });
    }
};

exports.removeGroupMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const adminId = req.user.id;
        
        // Check if member exists
        const memberCheck = await executeQuery(
            'SELECT * FROM chat_group_members WHERE id = $1 AND group_id = $2',
            [memberId, id]
        );
        
        if (memberCheck.length === 0) {
            return res.status(404).json({ error: 'Member not found in this group' });
        }
        
        // Soft delete by setting is_active to false
        const query = `
            UPDATE chat_group_members 
            SET is_active = false
            WHERE id = $1
            RETURNING *
        `;
        
        const result = await executeQuery(query, [memberId]);
        
        // Log admin action
        await logAdminAction(adminId, 'REMOVE', 'GROUP_MEMBER', memberId, { 
            group_id: id,
            user_id: memberCheck[0].user_id,
            fake_user_id: memberCheck[0].fake_user_id
        });
        
        res.json({ message: 'Member removed from group successfully' });
    } catch (error) {
        logger.error(`Error in removeGroupMember: ${error.message}`);
        res.status(500).json({ error: 'Failed to remove group member' });
    }
};

// Messages Controllers
exports.getGroupMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Check if user has access to this group
        if (!isAdmin) {
            const accessCheck = await executeQuery(
                'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
                [id, userId]
            );
            
            if (accessCheck.length === 0) {
                return res.status(403).json({ error: 'Access denied to this group' });
            }
        }
        
        // Get messages
        const query = `
            SELECT m.*, 
                   u.username as user_username,
                   fu.username as fake_user_username,
                   fu.display_name as fake_user_display_name,
                   fu.avatar_url as fake_user_avatar
            FROM chat_messages m
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN chat_fake_users fu ON m.fake_user_id = fu.id
            WHERE m.group_id = $1
            ORDER BY m.created_at DESC
            LIMIT 50
        `;
        
        const messages = await executeQuery(query, [id]);
        
        // Update last read time for user
        if (!isAdmin) {
            await executeQuery(
                `UPDATE chat_group_members 
                 SET last_read_at = NOW(),
                     last_read_message_id = (
                        SELECT id FROM chat_messages 
                        WHERE group_id = $1 
                        ORDER BY created_at DESC LIMIT 1
                     )
                 WHERE group_id = $1 AND user_id = $2`,
                [id, userId]
            );
        }
        
        res.json(messages.reverse()); // Return in chronological order
    } catch (error) {
        logger.error(`Error in getGroupMessages: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, media_url, media_type, fake_user_id, parent_message_id } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Validate input
        if (!content && !media_url) {
            return res.status(400).json({ error: 'Message must have content or media' });
        }
        
        // Check if user has access to this group
        if (!isAdmin && !fake_user_id) {
            const accessCheck = await executeQuery(
                'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND user_id = $2 AND is_active = true',
                [id, userId]
            );
            
            if (accessCheck.length === 0) {
                return res.status(403).json({ error: 'Access denied to this group' });
            }
        }
        
        // If fake_user_id is provided, check if admin has access to this fake user
        if (fake_user_id) {
            if (!isAdmin) {
                return res.status(403).json({ error: 'Only admins can send messages as fake users' });
            }
            
            const fakeUserCheck = await executeQuery(
                'SELECT * FROM chat_fake_users WHERE id = $1 AND created_by = $2 AND is_active = true',
                [fake_user_id, userId]
            );
            
            if (fakeUserCheck.length === 0) {
                return res.status(403).json({ error: 'You do not have access to this fake user' });
            }
            
            // Check if fake user is a member of this group
            const memberCheck = await executeQuery(
                'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND fake_user_id = $2 AND is_active = true',
                [id, fake_user_id]
            );
            
            if (memberCheck.length === 0) {
                return res.status(403).json({ error: 'This fake user is not a member of the group' });
            }
        }
        
        // If parent_message_id is provided, check if it exists
        if (parent_message_id) {
            const parentCheck = await executeQuery(
                'SELECT 1 FROM chat_messages WHERE id = $1 AND group_id = $2',
                [parent_message_id, id]
            );
            
            if (parentCheck.length === 0) {
                return res.status(404).json({ error: 'Parent message not found' });
            }
        }
        
        // Create message
        const query = `
            INSERT INTO chat_messages 
            (group_id, user_id, fake_user_id, content, media_url, media_type, 
             is_pinned, is_automated, sent_by_admin, admin_id, parent_message_id, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, false, false, $7, $8, $9, NOW(), NOW())
            RETURNING *
        `;
        
        const messageUserId = fake_user_id ? null : userId;
        const sentByAdmin = isAdmin && !fake_user_id;
        const adminIdValue = isAdmin ? userId : null;
        
        const result = await executeQuery(
            query, 
            [id, messageUserId, fake_user_id, content, media_url, media_type, 
             sentByAdmin, adminIdValue, parent_message_id]
        );
        
        // Update group's updated_at
        await executeQuery(
            'UPDATE chat_groups SET updated_at = NOW() WHERE id = $1',
            [id]
        );
        
        // Add user info to response
        if (fake_user_id) {
            const fakeUserQuery = 'SELECT username, display_name, avatar_url FROM chat_fake_users WHERE id = $1';
            const fakeUsers = await executeQuery(fakeUserQuery, [fake_user_id]);
            
            if (fakeUsers.length > 0) {
                result[0].fake_user_username = fakeUsers[0].username;
                result[0].fake_user_display_name = fakeUsers[0].display_name;
                result[0].fake_user_avatar = fakeUsers[0].avatar_url;
            }
        } else {
            const userQuery = 'SELECT username FROM users WHERE id = $1';
            const users = await executeQuery(userQuery, [userId]);
            
            if (users.length > 0) {
                result[0].user_username = users[0].username;
            }
        }
        
        res.status(201).json(result[0]);
    } catch (error) {
        logger.error(`Error in sendMessage: ${error.message}`);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

exports.updateMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Validate input
        if (!content) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        
        // Get message details
        const messageQuery = 'SELECT * FROM chat_messages WHERE id = $1';
        const messages = await executeQuery(messageQuery, [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        const message = messages[0];
        
        // Check if user has permission to edit this message
        if (!isAdmin && message.user_id !== userId) {
            return res.status(403).json({ error: 'You can only edit your own messages' });
        }
        
        // Update message
        const query = `
            UPDATE chat_messages 
            SET content = $1, 
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await executeQuery(query, [content, id]);
        
        // If admin edited another user's message, log it
        if (isAdmin && message.user_id !== userId) {
            await logAdminAction(userId, 'EDIT', 'MESSAGE', id, { 
                original_content: message.content,
                new_content: content
            });
        }
        
        res.json(result[0]);
    } catch (error) {
        logger.error(`Error in updateMessage: ${error.message}`);
        res.status(500).json({ error: 'Failed to update message' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        // Get message details
        const messageQuery = 'SELECT * FROM chat_messages WHERE id = $1';
        const messages = await executeQuery(messageQuery, [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        const message = messages[0];
        
        // Check if user has permission to delete this message
        if (!isAdmin && message.user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }
        
        // Delete message (actual delete, not soft delete)
        const query = 'DELETE FROM chat_messages WHERE id = $1';
        await executeQuery(query, [id]);
        
        // If admin deleted another user's message, log it
        if (isAdmin && message.user_id !== userId) {
            await logAdminAction(userId, 'DELETE', 'MESSAGE', id, { 
                content: message.content,
                user_id: message.user_id,
                fake_user_id: message.fake_user_id
            });
        }
        
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        logger.error(`Error in deleteMessage: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

exports.markMessageAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get message details
        const messageQuery = 'SELECT * FROM chat_messages WHERE id = $1';
        const messages = await executeQuery(messageQuery, [id]);
        
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        const message = messages[0];
        
        // Update last read message for this user in this group
        const query = `
            UPDATE chat_group_members 
            SET last_read_message_id = $1,
                last_read_at = NOW()
            WHERE group_id = $2 AND user_id = $3
            RETURNING *
        `;
        
        const result = await executeQuery(query, [id, message.group_id, userId]);
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'User is not a member of this group' });
        }
        
        res.json({ message: 'Message marked as read' });
    } catch (error) {
        logger.error(`Error in markMessageAsRead: ${error.message}`);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
};

// Fake Users (Admin Avatars) Controllers
exports.getFakeUsers = async (req, res) => {
    try {
        const adminId = req.user.id;
        
        // Get fake users created by this admin
        const query = `
            SELECT * FROM chat_fake_users 
            WHERE created_by = $1 AND is_active = true
            ORDER BY username
        `;
        
        const fakeUsers = await executeQuery(query, [adminId]);
        
        res.json(fakeUsers);
    } catch (error) {
        logger.error(`Error in getFakeUsers: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve fake users' });
    }
};

exports.createFakeUser = async (req, res) => {
    try {
        const { username, display_name, avatar_url, bio } = req.body;
        const adminId = req.user.id;
        
        // Validate input
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        // Check if username is already taken
        const usernameCheck = await executeQuery(
            'SELECT * FROM chat_fake_users WHERE username = $1 AND is_active = true',
            [username]
        );
        
        if (usernameCheck.length > 0) {
            return res.status(409).json({ error: 'Username is already taken' });
        }
        
        // Create fake user
        const query = `
            INSERT INTO chat_fake_users 
            (username, display_name, avatar_url, bio, is_active, created_by, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
            RETURNING *
        `;
        
        const result = await executeQuery(
            query, 
            [username, display_name, avatar_url, bio, adminId]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'CREATE', 'FAKE_USER', result[0].id, { 
            username, display_name 
        });
        
        res.status(201).json(result[0]);
    } catch (error) {
        logger.error(`Error in createFakeUser: ${error.message}`);
        res.status(500).json({ error: 'Failed to create fake user' });
    }
};

exports.updateFakeUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, display_name, avatar_url, bio, is_active } = req.body;
        const adminId = req.user.id;
        
        // Validate input
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        // Check if fake user exists and belongs to this admin
        const fakeUserCheck = await executeQuery(
            'SELECT * FROM chat_fake_users WHERE id = $1 AND created_by = $2',
            [id, adminId]
        );
        
        if (fakeUserCheck.length === 0) {
            return res.status(404).json({ error: 'Fake user not found or you do not have permission' });
        }
        
        // If username is changed, check if it's available
        if (username !== fakeUserCheck[0].username) {
            const usernameCheck = await executeQuery(
                'SELECT * FROM chat_fake_users WHERE username = $1 AND id != $2 AND is_active = true',
                [username, id]
            );
            
            if (usernameCheck.length > 0) {
                return res.status(409).json({ error: 'Username is already taken' });
            }
        }
        
        // Update fake user
        const query = `
            UPDATE chat_fake_users 
            SET username = $1, 
                display_name = $2, 
                avatar_url = $3, 
                bio = $4, 
                is_active = $5, 
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `;
        
        const result = await executeQuery(
            query, 
            [username, display_name, avatar_url, bio, is_active, id]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'UPDATE', 'FAKE_USER', id, { 
            username, display_name, is_active 
        });
        
        res.json(result[0]);
    } catch (error) {
        logger.error(`Error in updateFakeUser: ${error.message}`);
        res.status(500).json({ error: 'Failed to update fake user' });
    }
};

exports.deleteFakeUser = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        // Check if fake user exists and belongs to this admin
        const fakeUserCheck = await executeQuery(
            'SELECT * FROM chat_fake_users WHERE id = $1 AND created_by = $2',
            [id, adminId]
        );
        
        if (fakeUserCheck.length === 0) {
            return res.status(404).json({ error: 'Fake user not found or you do not have permission' });
        }
        
        // Soft delete by setting is_active to false
        const query = `
            UPDATE chat_fake_users 
            SET is_active = false, 
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;
        
        await executeQuery(query, [id]);
        
        // Also remove from all groups
        await executeQuery(
            'UPDATE chat_group_members SET is_active = false WHERE fake_user_id = $1',
            [id]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'DELETE', 'FAKE_USER', id, { 
            username: fakeUserCheck[0].username 
        });
        
        res.json({ message: 'Fake user deleted successfully' });
    } catch (error) {
        logger.error(`Error in deleteFakeUser: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete fake user' });
    }
};

// Scheduled Messages Controllers
exports.getScheduledMessages = async (req, res) => {
    try {
        const adminId = req.user.id;
        
        // Get scheduled messages created by this admin
        const query = `
            SELECT sm.*, 
                   g.name as group_name,
                   fu.username as fake_user_username,
                   fu.display_name as fake_user_display_name
            FROM chat_scheduled_messages sm
            JOIN chat_groups g ON sm.group_id = g.id
            JOIN chat_fake_users fu ON sm.fake_user_id = fu.id
            WHERE sm.scheduled_by = $1 AND sm.is_sent = false
            ORDER BY sm.scheduled_time ASC
        `;
        
        const scheduledMessages = await executeQuery(query, [adminId]);
        
        res.json(scheduledMessages);
    } catch (error) {
        logger.error(`Error in getScheduledMessages: ${error.message}`);
        res.status(500).json({ error: 'Failed to retrieve scheduled messages' });
    }
};

exports.createScheduledMessage = async (req, res) => {
    try {
        const { 
            group_id, fake_user_id, content, media_url, media_type, 
            scheduled_time, is_recurring, recurrence_pattern 
        } = req.body;
        const adminId = req.user.id;
        
        // Validate input
        if (!group_id || !fake_user_id || !content || !scheduled_time) {
            return res.status(400).json({ 
                error: 'Group ID, fake user ID, content, and scheduled time are required' 
            });
        }
        
        // Check if group exists
        const groupCheck = await executeQuery(
            'SELECT * FROM chat_groups WHERE id = $1 AND is_active = true',
            [group_id]
        );
        
        if (groupCheck.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if fake user exists and belongs to this admin
        const fakeUserCheck = await executeQuery(
            'SELECT * FROM chat_fake_users WHERE id = $1 AND created_by = $2 AND is_active = true',
            [fake_user_id, adminId]
        );
        
        if (fakeUserCheck.length === 0) {
            return res.status(404).json({ error: 'Fake user not found or you do not have permission' });
        }
        
        // Check if fake user is a member of this group
        const memberCheck = await executeQuery(
            'SELECT 1 FROM chat_group_members WHERE group_id = $1 AND fake_user_id = $2 AND is_active = true',
            [group_id, fake_user_id]
        );
        
        if (memberCheck.length === 0) {
            return res.status(403).json({ error: 'This fake user is not a member of the group' });
        }
        
        // Create scheduled message
        const query = `
            INSERT INTO chat_scheduled_messages 
            (group_id, fake_user_id, content, media_url, media_type, 
             scheduled_time, is_recurring, recurrence_pattern, scheduled_by, is_sent, created_at, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, NOW(), NOW())
            RETURNING *
        `;
        
        const result = await executeQuery(
            query, 
            [group_id, fake_user_id, content, media_url, media_type, 
             scheduled_time, is_recurring, recurrence_pattern, adminId]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'CREATE', 'SCHEDULED_MESSAGE', result[0].id, { 
            group_id, fake_user_id, scheduled_time 
        });
        
        res.status(201).json(result[0]);
    } catch (error) {
        logger.error(`Error in createScheduledMessage: ${error.message}`);
        res.status(500).json({ error: 'Failed to create scheduled message' });
    }
};

exports.updateScheduledMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            content, media_url, media_type, scheduled_time, 
            is_recurring, recurrence_pattern 
        } = req.body;
        const adminId = req.user.id;
        
        // Check if scheduled message exists and belongs to this admin
        const messageCheck = await executeQuery(
            'SELECT * FROM chat_scheduled_messages WHERE id = $1 AND scheduled_by = $2 AND is_sent = false',
            [id, adminId]
        );
        
        if (messageCheck.length === 0) {
            return res.status(404).json({ 
                error: 'Scheduled message not found, already sent, or you do not have permission' 
            });
        }
        
        // Update scheduled message
        const query = `
            UPDATE chat_scheduled_messages 
            SET content = $1, 
                media_url = $2, 
                media_type = $3, 
                scheduled_time = $4, 
                is_recurring = $5, 
                recurrence_pattern = $6, 
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `;
        
        const result = await executeQuery(
            query, 
            [content, media_url, media_type, scheduled_time, 
             is_recurring, recurrence_pattern, id]
        );
        
        // Log admin action
        await logAdminAction(adminId, 'UPDATE', 'SCHEDULED_MESSAGE', id, { 
            content, scheduled_time 
        });
        
        res.json(result[0]);
    } catch (error) {
        logger.error(`Error in updateScheduledMessage: ${error.message}`);
        res.status(500).json({ error: 'Failed to update scheduled message' });
    }
};

exports.deleteScheduledMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        
        // Check if scheduled message exists and belongs to this admin
        const messageCheck = await executeQuery(
            'SELECT * FROM chat_scheduled_messages WHERE id = $1 AND scheduled_by = $2 AND is_sent = false',
            [id, adminId]
        );
        
        if (messageCheck.length === 0) {
            return res.status(404).json({ 
                error: 'Scheduled message not found, already sent, or you do not have permission' 
            });
        }
        
        // Delete scheduled message
        const query = 'DELETE FROM chat_scheduled_messages WHERE id = $1';
        await executeQuery(query, [id]);
        
        // Log admin action
        await logAdminAction(adminId, 'DELETE', 'SCHEDULED_MESSAGE', id);
        
        res.json({ message: 'Scheduled message deleted successfully' });
    } catch (error) {
        logger.error(`Error in deleteScheduledMessage: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete scheduled message' });
    }
};

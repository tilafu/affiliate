/**
 * Enhanced Admin Chat API
 * Provides admin interface endpoints for managing enhanced chat features
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'affiliate_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'affiliate_db',
  password: process.env.DB_PASSWORD || 'affiliate123',
  port: process.env.DB_PORT || 5432,
});

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid admin token' });
  }
};

// =============================================
// ADMIN STATISTICS AND OVERVIEW
// =============================================

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Get comprehensive stats
    const [
      fakeUserDMsResult,
      supportConversationsResult,
      activeUsersResult,
      notificationsSentResult,
      recentMessagesResult
    ] = await Promise.all([
      // Fake User DMs count
      client.query(`
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN last_message_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_today
        FROM chat_dm_conversations 
        WHERE conversation_type = 'fake_user'
      `),
      
      // Support conversations count
      client.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN status = 'open' THEN 1 END) as open_requests
        FROM chat_dm_conversations 
        WHERE conversation_type = 'support'
      `),
      
      // Active users (users with activity in last 24 hours)
      client.query(`
        SELECT COUNT(DISTINCT user_id) as active_users
        FROM (
          SELECT sender_id as user_id FROM chat_dm_messages WHERE created_at > NOW() - INTERVAL '24 hours'
          UNION
          SELECT user_id FROM chat_messages WHERE created_at > NOW() - INTERVAL '24 hours'
        ) u
      `),
      
      // Notifications sent today
      client.query(`
        SELECT COUNT(*) as notifications_sent
        FROM chat_messages 
        WHERE is_automated = true 
        AND sent_by_admin = true 
        AND created_at > NOW() - INTERVAL '24 hours'
      `),
      
      // Recent messages for overview
      client.query(`
        SELECT 
          dm.id,
          dm.content,
          dm.created_at,
          u1.username as from_name,
          COALESCE(u2.username, fu.display_name, fu.username, 'Support Team') as to_name,
          CASE 
            WHEN c.conversation_type = 'fake_user' THEN 'fake_dm'
            WHEN c.conversation_type = 'support' THEN 'support'
            ELSE 'direct'
          END as type
        FROM chat_dm_messages dm
        JOIN chat_dm_conversations c ON dm.conversation_id = c.id
        JOIN users u1 ON dm.sender_id = u1.id
        LEFT JOIN users u2 ON (c.user_id_2 = u2.id AND c.user2_type = 'real_user')
        LEFT JOIN chat_fake_users fu ON (c.fake_user_id = fu.id AND c.user2_type = 'fake_user')
        ORDER BY dm.created_at DESC
        LIMIT 10
      `)
    ]);
    
    client.release();
    
    const stats = {
      fakeUserDMs: parseInt(fakeUserDMsResult.rows[0].total),
      newFakeUserDMs: parseInt(fakeUserDMsResult.rows[0].new_today),
      supportConversations: parseInt(supportConversationsResult.rows[0].total),
      openSupportRequests: parseInt(supportConversationsResult.rows[0].open_requests),
      activeUsers: parseInt(activeUsersResult.rows[0].active_users),
      notificationsSent: parseInt(notificationsSentResult.rows[0].notifications_sent),
      recentMessages: recentMessagesResult.rows
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// =============================================
// FAKE USER DMS MANAGEMENT
// =============================================

router.get('/fake-user-dms', requireAdmin, async (req, res) => {
  try {
    const { search, fake_user_id, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.created_at,
        c.last_message_at,
        c.status,
        u.username as user_name,
        u.email as user_email,
        fu.display_name as fake_user_name,
        fu.username as fake_user_username,
        COUNT(dm.id) as message_count,
        dm_last.content as last_message
      FROM chat_dm_conversations c
      JOIN users u ON c.user_id_1 = u.id
      JOIN chat_fake_users fu ON c.fake_user_id = fu.id
      LEFT JOIN chat_dm_messages dm ON c.id = dm.conversation_id
      LEFT JOIN LATERAL (
        SELECT content FROM chat_dm_messages 
        WHERE conversation_id = c.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) dm_last ON true
      WHERE c.conversation_type = 'fake_user'
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (u.username ILIKE $${paramCount} OR fu.display_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (fake_user_id) {
      paramCount++;
      query += ` AND c.fake_user_id = $${paramCount}`;
      params.push(fake_user_id);
    }
    
    if (status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
    }
    
    query += `
      GROUP BY c.id, u.username, u.email, fu.display_name, fu.username, dm_last.content
      ORDER BY c.last_message_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(limit, offset);
    
    const client = await pool.connect();
    const result = await client.query(query, params);
    client.release();
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching fake user DMs:', error);
    res.status(500).json({ error: 'Failed to fetch fake user DMs' });
  }
});

// =============================================
// SUPPORT CONVERSATIONS MANAGEMENT
// =============================================

router.get('/support-conversations', requireAdmin, async (req, res) => {
  try {
    const { search, status, priority, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.created_at,
        c.last_message_at,
        c.status,
        u.username as user_name,
        u.email as user_email,
        COUNT(dm.id) as message_count,
        dm_last.content as last_message,
        dm_first.content as subject,
        'medium' as priority
      FROM chat_dm_conversations c
      JOIN users u ON c.user_id_1 = u.id
      LEFT JOIN chat_dm_messages dm ON c.id = dm.conversation_id
      LEFT JOIN LATERAL (
        SELECT content FROM chat_dm_messages 
        WHERE conversation_id = c.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) dm_last ON true
      LEFT JOIN LATERAL (
        SELECT content FROM chat_dm_messages 
        WHERE conversation_id = c.id 
        ORDER BY created_at ASC 
        LIMIT 1
      ) dm_first ON true
      WHERE c.conversation_type = 'support'
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      query += ` AND (u.username ILIKE $${paramCount} OR dm_first.content ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (status) {
      paramCount++;
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
    }
    
    query += `
      GROUP BY c.id, u.username, u.email, dm_last.content, dm_first.content
      ORDER BY c.last_message_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(limit, offset);
    
    const client = await pool.connect();
    const result = await client.query(query, params);
    client.release();
    
    // Add status and priority based on message patterns
    const conversations = result.rows.map(conv => ({
      ...conv,
      status: conv.status || 'open',
      priority: this.determinePriority(conv.subject, conv.last_message),
      last_response_at: conv.last_message_at
    }));
    
    res.json(conversations);
    
  } catch (error) {
    console.error('Error fetching support conversations:', error);
    res.status(500).json({ error: 'Failed to fetch support conversations' });
  }
});

// =============================================
// CONVERSATION DETAILS
// =============================================

router.get('/conversation/:conversationId', requireAdmin, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const client = await pool.connect();
    
    // Get conversation details
    const conversationResult = await client.query(`
      SELECT 
        c.*,
        u1.username as user1_name,
        COALESCE(u2.username, fu.display_name, 'Support Team') as user2_name,
        fu.display_name as fake_user_name
      FROM chat_dm_conversations c
      JOIN users u1 ON c.user_id_1 = u1.id
      LEFT JOIN users u2 ON c.user_id_2 = u2.id
      LEFT JOIN chat_fake_users fu ON c.fake_user_id = fu.id
      WHERE c.id = $1
    `, [conversationId]);
    
    if (conversationResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get messages
    const messagesResult = await client.query(`
      SELECT 
        dm.*,
        u.username as sender_name,
        CASE 
          WHEN dm.sender_id = c.user_id_1 THEN 'user'
          WHEN dm.sender_id = c.user_id_2 THEN 'user'
          ELSE 'admin'
        END as sender_type
      FROM chat_dm_messages dm
      JOIN chat_dm_conversations c ON dm.conversation_id = c.id
      JOIN users u ON dm.sender_id = u.id
      WHERE dm.conversation_id = $1
      ORDER BY dm.created_at ASC
    `, [conversationId]);
    
    client.release();
    
    const conversation = {
      ...conversationResult.rows[0],
      messages: messagesResult.rows
    };
    
    res.json(conversation);
    
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

// =============================================
// SEND ADMIN MESSAGE TO CONVERSATION
// =============================================

router.post('/conversation/:conversationId/message', requireAdmin, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, message_type = 'text' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert admin message
      const messageResult = await client.query(`
        INSERT INTO chat_dm_messages (conversation_id, sender_id, message, message_type, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [conversationId, req.admin.userId, content, message_type]);
      
      // Update conversation last message time
      await client.query(`
        UPDATE chat_dm_conversations 
        SET last_message_at = NOW()
        WHERE id = $1
      `, [conversationId]);
      
      await client.query('COMMIT');
      
      const message = messageResult.rows[0];
      
      // Emit real-time update
      req.app.get('io')?.emit('admin_message', {
        conversation_id: conversationId,
        message: {
          ...message,
          sender_name: 'Admin',
          sender_type: 'admin'
        }
      });
      
      res.json({ success: true, message });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// =============================================
// GROUP NOTIFICATIONS MANAGEMENT
// =============================================

router.post('/send-notification', requireAdmin, async (req, res) => {
  try {
    const { groups, type, message, style } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Notification message is required' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get target groups
      let groupQuery = `
        SELECT DISTINCT group_id 
        FROM chat_groups 
        WHERE is_personal_group = true
      `;
      
      if (groups && !groups.includes('all')) {
        const groupIds = groups.filter(g => g !== 'all').map(g => parseInt(g)).filter(Boolean);
        if (groupIds.length > 0) {
          groupQuery += ` AND group_id = ANY($1)`;
        }
      }
      
      const groupsResult = await client.query(groupQuery, 
        groups && !groups.includes('all') ? [groups.filter(g => g !== 'all')] : []
      );
      
      const notifications = [];
      
      // Send notification to each group
      for (const group of groupsResult.rows) {
        const notificationResult = await client.query(`
          INSERT INTO chat_messages (
            group_id, content, is_automated, sent_by_admin, admin_id, 
            created_at, is_pinned
          )
          VALUES ($1, $2, true, true, $3, NOW(), false)
          RETURNING *
        `, [group.group_id, message, req.admin.userId]);
        
        notifications.push(notificationResult.rows[0]);
      }
      
      await client.query('COMMIT');
      
      // Emit real-time notifications
      notifications.forEach(notification => {
        req.app.get('io')?.to(`group_${notification.group_id}`).emit('admin_notification', {
          message: {
            ...notification,
            is_notification: true,
            is_admin_notification: true,
            notification_style: style || {}
          },
          style: style || {}
        });
      });
      
      res.json({ 
        success: true, 
        notifications_sent: notifications.length,
        notifications 
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error sending group notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// =============================================
// NOTIFICATION HISTORY
// =============================================

router.get('/notification-history', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        cm.*,
        cg.name as group_name,
        u.username as sent_by_username,
        COUNT(cgm.user_id) as recipient_count
      FROM chat_messages cm
      JOIN chat_groups cg ON cm.group_id = cg.id
      LEFT JOIN users u ON cm.admin_id = u.id
      LEFT JOIN chat_group_members cgm ON cg.id = cgm.group_id
      WHERE cm.is_automated = true 
      AND cm.sent_by_admin = true
      GROUP BY cm.id, cg.name, u.username
      ORDER BY cm.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    client.release();
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// =============================================
// UTILITY METHODS
// =============================================

function determinePriority(subject, lastMessage) {
  const urgentKeywords = ['urgent', 'emergency', 'critical', 'asap', 'immediately'];
  const highKeywords = ['important', 'problem', 'issue', 'error', 'help'];
  
  const text = `${subject || ''} ${lastMessage || ''}`.toLowerCase();
  
  if (urgentKeywords.some(keyword => text.includes(keyword))) {
    return 'urgent';
  }
  
  if (highKeywords.some(keyword => text.includes(keyword))) {
    return 'high';
  }
  
  return 'medium';
}

module.exports = router;

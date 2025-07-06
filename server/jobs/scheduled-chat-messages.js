/**
 * Scheduled Chat Messages Job Handler
 * Processes scheduled messages and sends them at the appropriate time
 */

const Queue = require('bull');
const db = require('../models/db'); // Assuming you have a database connection module
const socketManager = require('../chat-server'); // Import your Socket.io manager

// Create Redis connection for Bull queue
const redisConfig = {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
  }
};

// Create message queue
const messageQueue = new Queue('scheduled-chat-messages', redisConfig);

/**
 * Initialize the scheduled message processor
 */
const initialize = () => {
  // Set up message processor
  messageQueue.process(async (job) => {
    try {
      const { messageId } = job.data;
      
      // Get the scheduled message
      const message = await getScheduledMessage(messageId);
      
      if (!message) {
        console.log(`Scheduled message ${messageId} not found or already processed`);
        return { success: false, reason: 'Message not found' };
      }
      
      // Send the message
      await sendMessage(message);
      
      // If it's a recurring message, schedule the next occurrence
      if (message.is_recurring && message.recurring_pattern) {
        await scheduleNextOccurrence(message);
      }
      
      return { success: true, messageId };
    } catch (error) {
      console.error('Error processing scheduled message:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Handle completed jobs
  messageQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result:`, result);
  });
  
  // Handle failed jobs
  messageQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed with error:`, error);
  });
  
  // Schedule initial messages from database
  scheduleExistingMessages();
  
  // Set up periodic check for new scheduled messages
  setInterval(scheduleExistingMessages, 5 * 60 * 1000); // Check every 5 minutes
  
  console.log('Scheduled message processor initialized');
};

/**
 * Get scheduled message from database
 */
const getScheduledMessage = async (messageId) => {
  const query = `
    SELECT 
      id, 
      group_id, 
      user_id, 
      user_type, 
      content, 
      message_type, 
      is_admin_generated, 
      admin_id,
      scheduled_at,
      is_recurring,
      recurring_pattern
    FROM 
      chat_messages
    WHERE 
      id = $1 
      AND scheduled_at IS NOT NULL 
      AND created_at IS NULL
  `;
  
  const result = await db.query(query, [messageId]);
  return result.rows[0] || null;
};

/**
 * Send a scheduled message and update its status
 */
const sendMessage = async (message) => {
  // Update message status to mark it as sent
  const updateQuery = `
    UPDATE chat_messages
    SET 
      created_at = NOW(),
      scheduled_at = NULL
    WHERE 
      id = $1
    RETURNING id, created_at
  `;
  
  const updateResult = await db.query(updateQuery, [message.id]);
  const updatedMessage = updateResult.rows[0];
  
  if (!updatedMessage) {
    throw new Error('Failed to update message status');
  }
  
  // Get fake user details for the message
  const userQuery = `
    SELECT id, username, display_name, avatar_url
    FROM chat_fake_users
    WHERE id = $1
  `;
  
  const userResult = await db.query(userQuery, [message.user_id]);
  const user = userResult.rows[0];
  
  if (!user) {
    throw new Error('Fake user not found');
  }
  
  // Broadcast message via Socket.io
  socketManager.emitMessageToGroup(message.group_id, {
    id: message.id,
    groupId: message.group_id,
    userId: message.user_id,
    userType: message.user_type,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    },
    content: message.content,
    messageType: message.message_type,
    createdAt: updatedMessage.created_at
  });
  
  // Log the sent message
  await logScheduledMessageSent(message);
  
  return updatedMessage;
};

/**
 * Log that a scheduled message was sent
 */
const logScheduledMessageSent = async (message) => {
  try {
    const query = `
      INSERT INTO chat_admin_logs (
        admin_id, 
        action_type, 
        group_id, 
        fake_user_id, 
        message_id, 
        action_details
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await db.query(query, [
      message.admin_id,
      'SCHEDULED_MESSAGE_SENT',
      message.group_id,
      message.user_id,
      message.id,
      JSON.stringify({ 
        messageType: message.message_type,
        isRecurring: message.is_recurring,
        wasScheduledFor: message.scheduled_at
      })
    ]);
  } catch (error) {
    console.error('Error logging scheduled message sent:', error);
    // Non-blocking - continue even if logging fails
  }
};

/**
 * Schedule the next occurrence of a recurring message
 */
const scheduleNextOccurrence = async (message) => {
  try {
    const pattern = JSON.parse(message.recurring_pattern);
    const nextDate = calculateNextOccurrence(pattern, new Date());
    
    if (!nextDate) {
      console.log(`No next occurrence for message ${message.id}`);
      return null;
    }
    
    // Create a new message with the next scheduled time
    const query = `
      INSERT INTO chat_messages (
        group_id, 
        user_id, 
        user_type, 
        content, 
        message_type, 
        is_admin_generated, 
        admin_id,
        scheduled_at,
        is_recurring,
        recurring_pattern
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      message.group_id,
      message.user_id,
      message.user_type,
      message.content,
      message.message_type,
      message.is_admin_generated,
      message.admin_id,
      nextDate,
      message.is_recurring,
      message.recurring_pattern
    ]);
    
    const newMessageId = result.rows[0].id;
    
    // Add the next occurrence to the queue
    await scheduleMessage(newMessageId, nextDate);
    
    return newMessageId;
  } catch (error) {
    console.error('Error scheduling next occurrence:', error);
    return null;
  }
};

/**
 * Calculate the next occurrence based on a recurring pattern
 */
const calculateNextOccurrence = (pattern, fromDate) => {
  // Simple implementation - can be expanded for more complex patterns
  const { frequency, interval = 1, endDate } = pattern;
  
  if (endDate && new Date(endDate) < fromDate) {
    return null; // Pattern has ended
  }
  
  const nextDate = new Date(fromDate);
  
  switch (frequency) {
    case 'minutely':
      nextDate.setMinutes(nextDate.getMinutes() + interval);
      break;
    case 'hourly':
      nextDate.setHours(nextDate.getHours() + interval);
      break;
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (interval * 7));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    default:
      return null; // Unknown frequency
  }
  
  return nextDate;
};

/**
 * Schedule all existing messages from the database
 */
const scheduleExistingMessages = async () => {
  try {
    // Get all scheduled messages that need to be queued
    const query = `
      SELECT id, scheduled_at
      FROM chat_messages
      WHERE 
        scheduled_at IS NOT NULL 
        AND scheduled_at > NOW() 
        AND created_at IS NULL
    `;
    
    const result = await db.query(query);
    const messages = result.rows;
    
    console.log(`Found ${messages.length} scheduled messages to queue`);
    
    // Add each message to the queue
    for (const message of messages) {
      await scheduleMessage(message.id, new Date(message.scheduled_at));
    }
  } catch (error) {
    console.error('Error scheduling existing messages:', error);
  }
};

/**
 * Add a message to the queue
 */
const scheduleMessage = async (messageId, scheduledAt) => {
  try {
    // Calculate delay in milliseconds
    const now = new Date();
    const delay = Math.max(0, scheduledAt.getTime() - now.getTime());
    
    // Check if this message is already in the queue
    const existingJobs = await messageQueue.getJobs(['delayed', 'waiting']);
    const isAlreadyQueued = existingJobs.some(job => 
      job.data.messageId === messageId
    );
    
    if (isAlreadyQueued) {
      console.log(`Message ${messageId} is already queued`);
      return;
    }
    
    // Add to queue with appropriate delay
    await messageQueue.add(
      { messageId },
      { 
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: 1000
      }
    );
    
    console.log(`Scheduled message ${messageId} to be sent at ${scheduledAt}`);
  } catch (error) {
    console.error(`Error scheduling message ${messageId}:`, error);
  }
};

/**
 * Manually add a message to the queue (for API use)
 */
const queueMessage = async (messageId) => {
  try {
    // Get the message details
    const message = await getScheduledMessage(messageId);
    
    if (!message) {
      throw new Error('Scheduled message not found');
    }
    
    // Schedule the message
    await scheduleMessage(messageId, new Date(message.scheduled_at));
    
    return true;
  } catch (error) {
    console.error(`Error queuing message ${messageId}:`, error);
    throw error;
  }
};

/**
 * Cancel a scheduled message from the queue
 */
const cancelQueuedMessage = async (messageId) => {
  try {
    const jobs = await messageQueue.getJobs(['delayed', 'waiting']);
    
    for (const job of jobs) {
      if (job.data.messageId === messageId) {
        await job.remove();
        console.log(`Removed job for message ${messageId} from queue`);
        return true;
      }
    }
    
    console.log(`No job found for message ${messageId}`);
    return false;
  } catch (error) {
    console.error(`Error cancelling queued message ${messageId}:`, error);
    throw error;
  }
};

module.exports = {
  initialize,
  queueMessage,
  cancelQueuedMessage
};

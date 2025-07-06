/**
 * Admin Chat Integration with Existing Admin System
 * This module integrates the chat management with the existing admin authentication
 */

const express = require('express');
const router = express.Router();
const adminChatController = require('../controllers/admin-chat-controller');
const db = require('../db');

// Middleware to check if user is authenticated as admin
// This middleware works with the existing admin session
const checkAdminAuth = async (req, res, next) => {
  try {
    // Get admin ID from session (from the main admin authentication)
    // This assumes the admin user ID is stored in req.user.id by the protect+admin middleware
    const adminId = req.user?.id;
    
    if (!adminId) {
      console.error('Admin auth check failed: No admin ID in session');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify admin exists and has proper role
    const admin = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1 AND role = $2',
      [adminId, 'admin']
    );

    if (admin.rows.length === 0) {
      console.error(`Admin auth check failed: User ${adminId} not found or not admin`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Add admin info to request for controllers to use
    req.admin = admin.rows[0];
    
    console.log(`Admin authenticated: ${req.admin.username} (ID: ${req.admin.id})`);
    
    // Continue to the route handler
    next();
  } catch (error) {
    console.error('Admin auth check error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Apply admin authentication to all routes
router.use(checkAdminAuth);

// === CHAT GROUPS ===
router.get('/groups', adminChatController.getAllGroups);
router.get('/groups/:id', adminChatController.getGroupById);
router.post('/groups', adminChatController.createGroup);
router.put('/groups/:id', adminChatController.updateGroup);
router.delete('/groups/:id', adminChatController.deleteGroup);

// === FAKE USERS ===
router.get('/fake-users', adminChatController.getAllFakeUsers);
router.get('/fake-users/:id', adminChatController.getFakeUserById);
router.post('/fake-users', adminChatController.createFakeUser);
router.put('/fake-users/:id', adminChatController.updateFakeUser);
router.delete('/fake-users/:id', adminChatController.deleteFakeUser);
router.post('/fake-users/generate', adminChatController.generateFakeUsers);

// === GROUP MEMBERS ===
router.get('/groups/:id/members', adminChatController.getGroupMembers);
router.post('/groups/:id/members', adminChatController.addGroupMember);
router.delete('/groups/:id/members/:memberId', adminChatController.removeGroupMember);

// === CHAT MESSAGES ===
router.get('/groups/:id/messages', adminChatController.getGroupMessages);
router.post('/groups/:id/messages', adminChatController.sendMessage);
router.delete('/messages/:id', adminChatController.deleteMessage);

// === SCHEDULED MESSAGES ===
router.get('/scheduled-messages', adminChatController.getAllScheduledMessages);
router.get('/groups/:id/scheduled-messages', adminChatController.getGroupScheduledMessages);
router.post('/scheduled-messages', adminChatController.scheduleMessage);
router.put('/scheduled-messages/:id', adminChatController.updateScheduledMessage);
router.delete('/scheduled-messages/:id', adminChatController.deleteScheduledMessage);

// === ADMIN LOGS ===
router.get('/logs', adminChatController.getAdminLogs);

module.exports = router;

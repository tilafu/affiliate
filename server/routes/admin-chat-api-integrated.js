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
router.get('/groups/:id', adminChatController.getGroupDetails);
router.post('/groups', adminChatController.postAsFakeUser); // Create group
router.put('/groups/:id', adminChatController.updateTemplate); // Update group
router.delete('/groups/:id', adminChatController.deleteTemplate); // Delete group

// === FAKE USERS ===
router.get('/fake-users', adminChatController.getAllFakeUsers);
router.get('/fake-users/:id', adminChatController.getFakeUserDetails);
router.post('/fake-users', adminChatController.postAsFakeUser); // Create fake user
router.put('/fake-users/:id', adminChatController.updateTemplate); // Update fake user
router.delete('/fake-users/:id', adminChatController.deleteTemplate); // Delete fake user
router.post('/fake-users/generate', function(req, res) {
    // Mock implementation until real one is created
    res.json({success: true, message: "Fake user generation would happen here"});
});

// === GROUP MEMBERS ===
router.get('/groups/:id/members', adminChatController.getGroupUsers);
router.post('/groups/:id/members', adminChatController.postAsFakeUser); // Add member
router.delete('/groups/:id/members/:memberId', adminChatController.deleteTemplate); // Remove member

// === CHAT MESSAGES ===
router.get('/groups/:id/messages', adminChatController.previewConversation);
router.post('/groups/:id/messages', adminChatController.postAsFakeUser);
router.delete('/messages/:id', adminChatController.deleteTemplate);

// === SCHEDULED MESSAGES ===
router.get('/scheduled-messages', adminChatController.getScheduledMessages);
router.get('/groups/:id/scheduled-messages', adminChatController.getScheduledMessages);
router.post('/scheduled-messages', adminChatController.scheduleMessage);
router.put('/scheduled-messages/:id', adminChatController.updateTemplate);
router.delete('/scheduled-messages/:id', adminChatController.cancelScheduledMessage);

// === ADMIN LOGS ===
router.get('/logs', adminChatController.getAdminLogs);

module.exports = router;

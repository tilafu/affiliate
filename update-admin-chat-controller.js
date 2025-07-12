/**
 * Script to update all instances of req.admin to req.user in admin-chat-controller.js
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'controllers', 'admin-chat-controller.js');

// Read the file content
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of req.admin with req.user
content = content.replace(/req\.admin/g, 'req.user');

// Write the updated content back to the file
fs.writeFileSync(filePath, content);

console.log('All instances of req.admin have been replaced with req.user in admin-chat-controller.js');

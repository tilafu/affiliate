// Debug log for drive operations
// Used to help identify issues with data drive functionality

const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '../logs');
const driveLogFile = path.join(logDirectory, 'drive.log');

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

function logDriveOperation(operation, userId, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        operation,
        userId,
        ...data
    };
    
    try {
        fs.appendFileSync(driveLogFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
        console.error(`Error writing to drive log: ${error.message}`);
    }
}

module.exports = {
    logDriveOperation
};

# Server-Side Parameter Monitoring Integration Guide

This guide explains how to integrate the parameter monitoring utility with your existing Express.js server to enhance error detection and recovery for the data drive functionality.

## 1. Add Parameter Monitoring Middleware

Open your main Express app file (usually `server.js` or `app.js`) and add the parameter monitoring middleware:

```javascript
// Import the middleware
const { parameterMonitoringMiddleware } = require('./utils/parameter-monitoring');

// Apply middleware to API routes (should be before your route handlers)
app.use('/api/drive', parameterMonitoringMiddleware);
```

## 2. Enhance the Drive Controllers

Open your drive controller file (likely in the `controllers` directory) and modify the saveorder function:

```javascript
// Import utilities
const { sanitizeSaveOrderParams, fixParameterNaming, logError } = require('../utils/parameter-monitoring');

// In your saveorder controller function
exports.saveOrder = async (req, res) => {
    try {
        // Fix parameter naming inconsistencies
        const fixedParams = fixParameterNaming(req.body);
        
        // Sanitize parameters
        const sanitizedParams = sanitizeSaveOrderParams(fixedParams);
        
        // Replace req.body with sanitized version
        req.body = sanitizedParams;
        
        // Log the parameters we'll use (for debugging)
        console.log('Save order sanitized parameters:', sanitizedParams);
        
        // Continue with your existing controller logic
        // ...existing code...
        
    } catch (error) {
        // Enhanced error logging
        logError('saveorder', req.body, [error.message], req.userId, req.body.drive_session_id);
        
        // Return a more detailed error response
        return res.status(500).json({
            code: 1,
            success: false,
            info: `Server error: ${error.message}`,
            error_details: process.env.NODE_ENV === 'production' ? null : error.stack
        });
    }
};
```

## 3. Add Parameter Verification to Other Drive Endpoints

Similarly, enhance the `getorder` and `start` controllers with parameter verification:

```javascript
// In your getOrder controller function
exports.getOrder = async (req, res) => {
    try {
        // Ensure drive_session_id is a string
        if (req.body.drive_session_id !== undefined) {
            req.body.drive_session_id = String(req.body.drive_session_id || '');
        }
        
        // Continue with existing logic
        // ...existing code...
        
    } catch (error) {
        // Enhanced error logging
        logError('getorder', req.body, [error.message], req.userId, req.body.drive_session_id);
        
        // Return a more detailed error response
        return res.status(500).json({
            code: 1,
            success: false,
            info: `Server error: ${error.message}`,
            error_details: process.env.NODE_ENV === 'production' ? null : error.stack
        });
    }
};
```

## 4. Monitoring and Analysis

After implementing the parameter monitoring, you can analyze the logs to identify patterns in errors:

1. Check the `logs/drive-parameters.log` file to see all parameters being sent to the endpoints.
2. Look for validation failures in `logs/drive-errors.log`.
3. Use these logs to identify common error patterns and further improve client-side validation.

## 5. Configuring the Monitor

You can adjust the behavior of the parameter monitoring by editing the `config` object in `utils/parameter-monitoring.js`:

- Set `strictValidation: false` to log errors but not block requests with validation issues
- Modify the `schemas` object to update parameter validation rules
- Adjust `maxLogSize` to control log rotation size

## 6. Test Plan

After integrating the parameter monitoring, follow these steps to test the implementation:

1. Start the server with monitoring enabled
2. Test the data drive flow with valid parameters
3. Test with intentionally invalid parameters (missing session ID, etc.)
4. Check the logs to verify errors are being properly captured
5. Verify that the client-side error handling correctly responds to server validation errors

By implementing this server-side parameter monitoring, you'll have better visibility into the parameter issues causing 500 errors and be able to handle them more gracefully.

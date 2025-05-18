
/**
 * Parameter monitoring utility for data drive functionality
 * This utility adds enhanced logging and validation for critical data drive endpoints
 */

const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    // Log file paths
    parameterLogFile: path.join(__dirname, '..', 'logs', 'drive-parameters.log'),
    errorLogFile: path.join(__dirname, '..', 'logs', 'drive-errors.log'),
    
    // Validation options
    strictValidation: true, // Set to false to log but not block requests with validation issues
    maxLogSize: 10 * 1024 * 1024, // 10 MB max log size
    
    // Parameter schemas
    schemas: {
        saveorder: {
            required: ['drive_session_id', 'product_id', 'drive_order_id'],
            optional: ['quantity_purchased', 'purchase_price', 'product_number'],
            types: {
                drive_session_id: 'string',
                product_id: 'string',
                drive_order_id: 'string',
                quantity_purchased: 'number',
                purchase_price: 'number',
                product_number: 'string'
            }
        },
        getorder: {
            required: ['drive_session_id'],
            optional: [],
            types: {
                drive_session_id: 'string'
            }
        },
        start: {
            required: [],
            optional: [],
            types: {}
        }
    }
};

// Ensure log directory exists
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Helper to rotate logs if they get too large
function rotateLogIfNeeded(logPath) {
    try {
        if (fs.existsSync(logPath)) {
            const stats = fs.statSync(logPath);
            if (stats.size > config.maxLogSize) {
                const backupPath = `${logPath}.${new Date().toISOString().replace(/:/g, '-')}`;
                fs.renameSync(logPath, backupPath);
                console.log(`Rotated log file: ${logPath} -> ${backupPath}`);
            }
        }
    } catch (err) {
        console.error(`Failed to rotate log file: ${logPath}`, err);
    }
}

// Log parameter data for monitoring
function logParameters(endpoint, params, userId, sessionId) {
    rotateLogIfNeeded(config.parameterLogFile);
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        endpoint,
        userId,
        sessionId,
        params
    };
    
    fs.appendFileSync(config.parameterLogFile, JSON.stringify(logEntry) + '\n');
}

// Log validation errors
function logError(endpoint, params, errors, userId, sessionId) {
    rotateLogIfNeeded(config.errorLogFile);
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        endpoint,
        userId,
        sessionId,
        params,
        errors
    };
    
    fs.appendFileSync(config.errorLogFile, JSON.stringify(logEntry) + '\n');
}

// Validate parameters against schema
function validateParameters(endpoint, params) {
    const schema = config.schemas[endpoint];
    if (!schema) return { valid: true, errors: [] }; // No schema defined for endpoint
    
    const errors = [];
    
    // Check required parameters
    if (schema.required) {
        for (const param of schema.required) {
            if (params[param] === undefined || params[param] === null) {
                errors.push(`Missing required parameter: ${param}`);
            }
        }
    }
    
    // Check parameter types
    if (schema.types) {
        for (const [param, expectedType] of Object.entries(schema.types)) {
            if (params[param] !== undefined && params[param] !== null) {
                const actualType = typeof params[param];
                if (actualType !== expectedType) {
                    // Special case for numbers that might come as strings
                    if (expectedType === 'number' && actualType === 'string' && !isNaN(params[param])) {
                        // This is acceptable, as we can convert it
                    } else {
                        errors.push(`Parameter ${param} should be type ${expectedType}, got ${actualType}`);
                    }
                }
            }
        }
    }
    
    // Check for invalid parameter values
    if (params.drive_session_id === 'undefined' || params.drive_session_id === 'null') {
        errors.push(`Parameter drive_session_id has invalid string value: "${params.drive_session_id}"`);
    }
    
    if (params.drive_order_id === 'undefined' || params.drive_order_id === 'null') {
        errors.push(`Parameter drive_order_id has invalid string value: "${params.drive_order_id}"`);
    }
    
    if (params.product_id === 'undefined' || params.product_id === 'null') {
        errors.push(`Parameter product_id has invalid string value: "${params.product_id}"`);
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Middleware to monitor and validate data drive parameters
 */
function parameterMonitoringMiddleware(req, res, next) {
    // Extract endpoint from URL
    const url = req.originalUrl || req.url;
    const endpoint = url.split('/').pop(); // Gets the last part of the URL
    
    // Only monitor specific drive endpoints
    if (url.includes('/api/drive/') && config.schemas[endpoint]) {
        const userId = req.userId || (req.user && req.user.id) || 'unknown';
        const sessionId = req.body.drive_session_id || 'unknown';
        
        // Log all parameters for monitoring
        logParameters(endpoint, req.body, userId, sessionId);
        
        // Validate parameters
        const validation = validateParameters(endpoint, req.body);
        
        // If validation fails, log errors and optionally block the request
        if (!validation.valid) {
            logError(endpoint, req.body, validation.errors, userId, sessionId);
            
            if (config.strictValidation) {
                return res.status(400).json({
                    code: 1,
                    success: false,
                    info: `Parameter validation failed: ${validation.errors.join(', ')}`,
                    errors: validation.errors
                });
            }
        }
    }
    
    next();
}

// Function to sanitize parameters for the saveorder endpoint
function sanitizeSaveOrderParams(params) {
    const sanitized = { ...params };
    
    // Ensure IDs are strings
    if (sanitized.drive_session_id !== undefined) {
        sanitized.drive_session_id = String(sanitized.drive_session_id || '');
    }
    
    if (sanitized.drive_order_id !== undefined) {
        sanitized.drive_order_id = String(sanitized.drive_order_id || '');
    }
    
    if (sanitized.product_id !== undefined) {
        sanitized.product_id = String(sanitized.product_id || '');
    }
    
    // Ensure numeric values are numbers
    if (sanitized.quantity_purchased !== undefined) {
        sanitized.quantity_purchased = Number(sanitized.quantity_purchased);
    }
    
    if (sanitized.purchase_price !== undefined) {
        sanitized.purchase_price = Number(sanitized.purchase_price);
    }
    
    return sanitized;
}

// Function to check if we need to fix parameters based on common patterns
function fixParameterNaming(params) {
    const fixed = { ...params };
    
    // Map order_id to drive_order_id if needed
    if (!fixed.drive_order_id && fixed.order_id) {
        fixed.drive_order_id = fixed.order_id;
        delete fixed.order_id;
    }
    
    return fixed;
}

module.exports = {
    parameterMonitoringMiddleware,
    sanitizeSaveOrderParams,
    fixParameterNaming,
    validateParameters,
    logError
};

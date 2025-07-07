/**
 * Logger utility for consistent logging across the application
 */

const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        
        // File transport for errors
        new winston.transports.File({
            filename: path.join(__dirname, '../../server.log'),
            level: 'info'
        }),
        
        // Separate file for errors
        new winston.transports.File({
            filename: path.join(__dirname, '../../exceptions.log'),
            level: 'error'
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../exceptions.log')
        })
    ]
});

// Add request logging method
logger.logRequest = (req) => {
    const { method, originalUrl, ip } = req;
    logger.info(`${method} ${originalUrl}`, { ip: ip || req.connection.remoteAddress });
};

module.exports = logger;

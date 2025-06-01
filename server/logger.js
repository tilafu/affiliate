const { createLogger, format, transports } = require('winston');

const logger = createLogger({
<<<<<<< HEAD
  level: 'info', // Default level
=======
  level: 'debug', // Changed main level to 'debug'
>>>>>>> main
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
<<<<<<< HEAD
    new transports.File({ filename: 'server.log', level: 'info' }), // Keep file log level at info or higher
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      ),
      level: 'debug' // Set console log level to debug
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: 'exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.File({ filename: 'rejections.log' })
=======
    new transports.File({ filename: 'server.log', level: 'debug' }),
    new transports.Console({ format: format.simple() })
>>>>>>> main
  ]
});

module.exports = logger;

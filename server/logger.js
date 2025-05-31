const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'debug', // Changed main level to 'debug'
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'server.log', level: 'debug' }),
    new transports.Console({ format: format.simple() })
  ]
});

module.exports = logger;

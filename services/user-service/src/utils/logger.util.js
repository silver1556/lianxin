const winston = require('winston');
const bunyan = require('bunyan');
const path = require('path');

// Configuration
const config = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
  enableFile: process.env.LOG_ENABLE_FILE === 'true',
  enableAudit: process.env.LOG_ENABLE_AUDIT !== 'false',
  logDir: process.env.LOG_DIR || './logs',
  serviceName: process.env.SERVICE_NAME || 'user-service',
  environment: process.env.NODE_ENV || 'development'
};

// Create logs directory if it doesn't exist
const fs = require('fs');
if (config.enableFile && !fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

/**
 * Winston Logger Configuration
 */
const createWinstonLogger = () => {
  const formats = [];
  
  // Add timestamp
  formats.push(winston.format.timestamp());
  
  // Add error stack trace
  formats.push(winston.format.errors({ stack: true }));
  
  // Add custom format for structured logging
  formats.push(winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logObj = {
      timestamp,
      level,
      service: config.serviceName,
      environment: config.environment,
      message,
      ...meta
    };
    
    return JSON.stringify(logObj);
  }));
  
  const transports = [];
  
  // Console transport
  if (config.enableConsole) {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }));
  }
  
  // File transports
  if (config.enableFile) {
    // Combined logs
    transports.push(new winston.transports.File({
      filename: path.join(config.logDir, 'combined.log'),
      format: winston.format.combine(...formats)
    }));
    
    // Error logs
    transports.push(new winston.transports.File({
      filename: path.join(config.logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(...formats)
    }));
    
    // Audit logs
    if (config.enableAudit) {
      transports.push(new winston.transports.File({
        filename: path.join(config.logDir, 'audit.log'),
        format: winston.format.combine(...formats)
      }));
    }
  }
  
  return winston.createLogger({
    level: config.level,
    transports,
    exitOnError: false
  });
};

/**
 * Bunyan Logger Configuration
 */
const createBunyanLogger = () => {
  const streams = [];
  
  // Console stream
  if (config.enableConsole) {
    streams.push({
      level: config.level,
      stream: process.stdout
    });
  }
  
  // File streams
  if (config.enableFile) {
    streams.push({
      level: 'info',
      path: path.join(config.logDir, 'combined.log')
    });
    
    streams.push({
      level: 'error',
      path: path.join(config.logDir, 'error.log')
    });
    
    if (config.enableAudit) {
      streams.push({
        level: 'info',
        path: path.join(config.logDir, 'audit.log')
      });
    }
  }
  
  return bunyan.createLogger({
    name: config.serviceName,
    streams,
    serializers: bunyan.stdSerializers
  });
};

// Create logger instance
const logger = createWinstonLogger();

/**
 * Logger utility class
 */
class Logger {
  constructor() {
    this.winston = logger;
    this.bunyan = createBunyanLogger();
  }
  
  /**
   * Log info message
   */
  info(message, meta = {}) {
    this.winston.info(message, this.formatMeta(meta));
  }
  
  /**
   * Log error message
   */
  error(message, meta = {}) {
    this.winston.error(message, this.formatMeta(meta));
  }
  
  /**
   * Log warning message
   */
  warn(message, meta = {}) {
    this.winston.warn(message, this.formatMeta(meta));
  }
  
  /**
   * Log debug message
   */
  debug(message, meta = {}) {
    this.winston.debug(message, this.formatMeta(meta));
  }
  
  /**
   * Log verbose message
   */
  verbose(message, meta = {}) {
    this.winston.verbose(message, this.formatMeta(meta));
  }
  
  /**
   * Log silly message
   */
  silly(message, meta = {}) {
    this.winston.silly(message, this.formatMeta(meta));
  }
  
  /**
   * Log audit message
   */
  audit(message, meta = {}) {
    const auditMeta = {
      ...this.formatMeta(meta),
      audit: true,
      timestamp: new Date().toISOString()
    };
    
    this.winston.info(message, auditMeta);
  }
  
  /**
   * Log security event
   */
  security(message, meta = {}) {
    const securityMeta = {
      ...this.formatMeta(meta),
      security: true,
      level: 'security',
      timestamp: new Date().toISOString()
    };
    
    this.winston.warn(message, securityMeta);
  }
  
  /**
   * Log performance metrics
   */
  performance(message, meta = {}) {
    const performanceMeta = {
      ...this.formatMeta(meta),
      performance: true,
      timestamp: new Date().toISOString()
    };
    
    this.winston.info(message, performanceMeta);
  }
  
  /**
   * Log business event
   */
  business(message, meta = {}) {
    const businessMeta = {
      ...this.formatMeta(meta),
      business: true,
      timestamp: new Date().toISOString()
    };
    
    this.winston.info(message, businessMeta);
  }
  
  /**
   * Log API request
   */
  apiRequest(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId: req.requestId,
      userId: req.user ? req.user.id : null,
      timestamp: new Date().toISOString()
    };
    
    this.winston.info('API Request', this.formatMeta(meta));
  }
  
  /**
   * Log database query
   */
  dbQuery(query, duration, params = null) {
    const meta = {
      query: query,
      duration: duration,
      params: params,
      timestamp: new Date().toISOString()
    };
    
    this.winston.debug('Database Query', this.formatMeta(meta));
  }
  
  /**
   * Log cache operation
   */
  cache(operation, key, hit = null, duration = null) {
    const meta = {
      operation,
      key,
      hit,
      duration,
      timestamp: new Date().toISOString()
    };
    
    this.winston.debug('Cache Operation', this.formatMeta(meta));
  }
  
  /**
   * Format metadata for logging
   */
  formatMeta(meta) {
    const formatted = {
      ...meta,
      service: config.serviceName,
      environment: config.environment
    };
    
    // Add trace information if available
    if (meta.traceId) {
      formatted.traceId = meta.traceId;
    }
    
    if (meta.spanId) {
      formatted.spanId = meta.spanId;
    }
    
    return formatted;
  }
  
  /**
   * Create child logger with additional context
   */
  child(context) {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...context };
    
    // Override format method to include context
    const originalFormat = this.formatMeta.bind(this);
    childLogger.formatMeta = (meta) => originalFormat({ ...childLogger.context, ...meta });
    
    return childLogger;
  }
  
  /**
   * Set log level
   */
  setLevel(level) {
    this.winston.level = level;
    this.bunyan.level(level);
  }
  
  /**
   * Get current log level
   */
  getLevel() {
    return this.winston.level;
  }
  
  /**
   * Add transport
   */
  addTransport(transport) {
    this.winston.add(transport);
  }
  
  /**
   * Remove transport
   */
  removeTransport(transport) {
    this.winston.remove(transport);
  }
  
  /**
   * Clear all transports
   */
  clearTransports() {
    this.winston.clear();
  }
  
  /**
   * Close logger
   */
  close() {
    this.winston.close();
  }
}

// Export logger instance
module.exports = new Logger();
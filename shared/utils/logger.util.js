const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Configuration
const config = {
  level: process.env.LOG_LEVEL || "info",
  enableConsole: process.env.LOG_ENABLE_CONSOLE !== "false",
  enableFile: process.env.LOG_ENABLE_FILE !== "false",
  logDir: process.env.LOG_DIR || "./logs",
  serviceName: process.env.SERVICE_NAME || "application",
  environment: process.env.NODE_ENV || "development",
  maxFiles: process.env.LOG_MAX_FILES || "14d", // can be number of files or time based log retention
  maxSize: process.env.LOG_MAX_SIZE || "20m", // Maximum size of each file before rotating
};

// Create logs directory if it doesn't exist
if (config.enableFile && !fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

/**
 * Custom format for structured JSON logging
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      service: config.serviceName,
      environment: config.environment,
      message,
      ...(stack && { stack }),
      ...meta,
    };
    return JSON.stringify(logEntry);
  })
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let output = `${timestamp} ${level}: ${message}`;

    // Add metadata if present
    const metaKeys = Object.keys(meta).filter(
      (key) =>
        !["timestamp", "level", "message", "service", "environment"].includes(
          key
        )
    );

    if (metaKeys.length > 0) {
      const metaString = JSON.stringify(
        metaKeys.reduce((obj, key) => ({ ...obj, [key]: meta[key] }), {}),
        null,
        2
      );
      output += `\n${metaString}`;
    }

    if (stack) {
      output += `\n${stack}`;
    }

    return output;
  })
);

/**
 * Create transports array
 */
const createTransports = () => {
  const transports = [];

  // Console transport
  if (config.enableConsole) {
    transports.push(
      new winston.transports.Console({
        format:
          config.environment === "production" ? jsonFormat : consoleFormat,
        handleExceptions: true,
        handleRejections: true,
      })
    );
  }

  // File transports
  if (config.enableFile) {
    // Combined logs
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, "app.log"),
        format: jsonFormat,
        maxsize: config.maxSize,
        maxFiles: config.maxFiles,
        handleExceptions: true,
        handleRejections: true,
      })
    );

    // Error logs
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, "error.log"),
        level: "error",
        format: jsonFormat,
        maxsize: config.maxSize,
        maxFiles: config.maxFiles,
        handleExceptions: true,
        handleRejections: true,
      })
    );

    // Audit logs
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, "audit.log"),
        format: jsonFormat,
        maxsize: config.maxSize,
        maxFiles: config.maxFiles,
      })
    );
  }

  return transports;
};

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.level,
  format: jsonFormat,
  defaultMeta: {
    service: config.serviceName,
    environment: config.environment,
  },
  transports: createTransports(),
  exitOnError: false,
  rejectionHandlers: config.enableFile
    ? [
        new winston.transports.File({
          filename: path.join(config.logDir, "rejections.log"),
          format: jsonFormat,
        }),
      ]
    : [],
  exceptionHandlers: config.enableFile
    ? [
        new winston.transports.File({
          filename: path.join(config.logDir, "exceptions.log"),
          format: jsonFormat,
        }),
      ]
    : [],
});

/**
 * Logger Class
 */
class Logger {
  constructor() {
    this.winston = logger;
    this.context = {};
  }

  /**
   * Core logging methods
   */
  error(message, meta = {}) {
    this.winston.error(message, this.formatMeta(meta));
  }

  warn(message, meta = {}) {
    this.winston.warn(message, this.formatMeta(meta));
  }

  info(message, meta = {}) {
    this.winston.info(message, this.formatMeta(meta));
  }

  http(message, meta = {}) {
    this.winston.http(message, this.formatMeta(meta));
  }

  verbose(message, meta = {}) {
    this.winston.verbose(message, this.formatMeta(meta));
  }

  debug(message, meta = {}) {
    this.winston.debug(message, this.formatMeta(meta));
  }

  silly(message, meta = {}) {
    this.winston.silly(message, this.formatMeta(meta));
  }

  /**
   * Specialized logging methods
   */
  audit(action, meta = {}) {
    const auditMeta = {
      ...this.formatMeta(meta),
      category: "audit",
      action,
      auditTimestamp: new Date().toISOString(),
    };

    // Log to both regular and audit file
    this.winston.info(`AUDIT: ${action}`, auditMeta);
  }

  security(event, meta = {}) {
    const securityMeta = {
      ...this.formatMeta(meta),
      category: "security",
      event,
      severity: meta.severity || "medium",
      securityTimestamp: new Date().toISOString(),
    };

    this.winston.warn(`SECURITY: ${event}`, securityMeta);
  }

  performance(operation, duration, meta = {}) {
    const perfMeta = {
      ...this.formatMeta(meta),
      category: "performance",
      operation,
      duration,
      unit: "ms",
    };

    this.winston.info(
      `PERFORMANCE: ${operation} completed in ${duration}ms`,
      perfMeta
    );
  }

  business(event, meta = {}) {
    const businessMeta = {
      ...this.formatMeta(meta),
      category: "business",
      event,
      businessTimestamp: new Date().toISOString(),
    };

    this.winston.info(`BUSINESS: ${event}`, businessMeta);
  }

  /**
   * HTTP Request logging
   */
  request(req, res, responseTime) {
    const requestMeta = {
      category: "http",
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress,
      requestId: req.id || req.requestId,
      userId: req.user?.id,
      contentLength: res.get("content-length"),
    };

    const level = res.statusCode >= 400 ? "warn" : "info";
    this.winston[level](
      `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`,
      requestMeta
    );
  }

  /**
   * Database operation logging
   */
  database(operation, duration, meta = {}) {
    const dbMeta = {
      ...this.formatMeta(meta),
      category: "database",
      operation,
      duration,
      query: meta.query ? this.sanitizeQuery(meta.query) : undefined,
    };

    this.winston.debug(`DB: ${operation} - ${duration}ms`, dbMeta);
  }

  /**
   * Cache operation logging
   */
  cache(operation, key, hit = null, duration = null) {
    const cacheMeta = {
      category: "cache",
      operation,
      key: this.sanitizeKey(key),
      hit,
      duration,
    };

    this.winston.debug(
      `CACHE: ${operation} ${key} ${hit ? "HIT" : "MISS"}`,
      cacheMeta
    );
  }

  /**
   * Error with context
   */
  errorWithContext(error, context = {}) {
    const errorMeta = {
      ...this.formatMeta(context),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
    };

    this.winston.error(error.message, errorMeta);
  }

  /**
   * Create child logger with persistent context
   */
  child(context) {
    const childLogger = Object.create(this);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  /**
   * Timer utility for performance logging
   */
  timer(label) {
    const start = process.hrtime.bigint();

    return {
      end: (meta = {}) => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        this.performance(label, Math.round(duration * 100) / 100, meta);
        return duration;
      },
    };
  }

  /**
   * Batch logging for high-volume scenarios
   */
  batch(entries) {
    entries.forEach(({ level, message, meta }) => {
      this.winston[level](message, this.formatMeta(meta || {}));
    });
  }

  /**
   * Utility methods
   */
  formatMeta(meta) {
    return {
      ...this.context,
      ...meta,
      pid: process.pid,
      hostname: require("os").hostname(),
      timestamp: new Date().toISOString(),
    };
  }

  sanitizeQuery(query) {
    // Remove potential sensitive data from queries
    return typeof query === "string"
      ? query.replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='***'")
      : query;
  }

  sanitizeKey(key) {
    // Sanitize cache keys to remove potential sensitive data
    return typeof key === "string"
      ? key.replace(/token|password|secret/gi, "***")
      : key;
  }

  /**
   * Logger management
   */
  setLevel(level) {
    this.winston.level = level;
  }

  getLevel() {
    return this.winston.level;
  }

  close() {
    return this.winston.close();
  }

  /**
   * Health check for logger
   */
  healthCheck() {
    try {
      this.info("Logger health check");
      return {
        status: "healthy",
        level: this.getLevel(),
        transports: this.winston.transports.length,
      };
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }
}

// Create and export singleton instance
const enterpriseLogger = new Logger();

// Add graceful shutdown handling
process.on("exit", () => {
  enterpriseLogger.close();
});

process.on("SIGINT", () => {
  enterpriseLogger.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  enterpriseLogger.close();
  process.exit(0);
});

module.exports = enterpriseLogger;

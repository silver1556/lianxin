const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Internal imports
const securityConfig = require('./config/security.config');
const databaseConfig = require('./config/database.config');
const redisConfig = require('./config/redis.config');
const logger = require('./utils/logger.util');
const { AppError } = require('./errors/AppError');

// Middleware imports
const authMiddleware = require('./middleware/auth.middleware');
const validationMiddleware = require('./middleware/validation.middleware');
const rateLimitMiddleware = require('./middleware/rate-limit.middleware');
const encryptionMiddleware = require('./middleware/encryption.middleware');
const auditMiddleware = require('./middleware/audit.middleware');

// Controller imports
const authController = require('./controllers/auth.controller');
const profileController = require('./controllers/profile.controller');
const settingsController = require('./controllers/settings.controller');
const sessionController = require('./controllers/session.controller');
const adminController = require('./controllers/admin/admin.controller');
const complianceController = require('./controllers/admin/compliance.controller');

// Shared imports
const apiResponse = require('../../../shared/utils/api.response');
const mysqlPool = require('../../../shared/libraries/database/mysql.pool');
const redisClient = require('../../../shared/libraries/cache/redis.client');

class UserServiceApp {
  constructor() {
    this.app = express();
    this.port = securityConfig.app.port;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: securityConfig.cors.origin,
      credentials: true,
      optionsSuccessStatus: 200,
      methods: securityConfig.cors.methods,
      allowedHeaders: securityConfig.cors.allowedHeaders
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: `${securityConfig.app.maxFileSize}b` }));
    this.app.use(express.urlencoded({ extended: true, limit: `${securityConfig.app.maxFileSize}b` }));

    // Compression middleware
    this.app.use(compression());

    // Global rate limiting
    if (securityConfig.rateLimit.enabled) {
      this.app.use(rateLimitMiddleware.globalRateLimit);
    }

    // Request logging middleware
    this.app.use((req, res, next) => {
      req.requestId = require('uuid').v4();
      req.startTime = Date.now();

      logger.info('Incoming request', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      next();
    });

    // Audit middleware for all routes
    this.app.use(auditMiddleware.logActivity);
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json(apiResponse.success({
        service: 'user-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: securityConfig.app.serviceVersion
      }, 'Service is healthy'));
    });

    // API version prefix
    const apiV1 = express.Router();

    // Authentication routes
    apiV1.use('/auth', authController);

    // User profile routes (protected)
    apiV1.use('/user', authMiddleware.authenticate, profileController);

    // Settings and session routes (protected)
    apiV1.use('/user', authMiddleware.authenticate, settingsController);
    apiV1.use('/user', authMiddleware.authenticate, sessionController);

    // Admin routes (admin only)
    apiV1.use('/admin', authMiddleware.authenticate, authMiddleware.requireAdmin, adminController);
    apiV1.use('/admin', authMiddleware.authenticate, authMiddleware.requireAdmin, complianceController);

    // Mount API routes
    this.app.use('/api/v1', apiV1);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json(apiResponse.error(
        'NOT_FOUND',
        `Route ${req.method} ${req.originalUrl} not found`,
        req.requestId
      ));
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((err, req, res, next) => {
      const requestId = req.requestId || 'unknown';

      // Log error details
      logger.error('Application error', {
        requestId,
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Handle different error types
      if (err instanceof AppError) {
        return res.status(err.statusCode).json(apiResponse.error(
          err.errorCode,
          err.message,
          requestId,
          err.details
        ));
      }

      // Validation errors
      if (err.name === 'ValidationError') {
        return res.status(400).json(apiResponse.error(
          'VALIDATION_ERROR',
          'Validation failed',
          requestId,
          err.details
        ));
      }

      // JWT errors
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(apiResponse.error(
          'INVALID_TOKEN',
          'Invalid authentication token',
          requestId
        ));
      }

      if (err.name === 'TokenExpiredError') {
        return res.status(401).json(apiResponse.error(
          'TOKEN_EXPIRED',
          'Authentication token has expired',
          requestId
        ));
      }

      // Database errors
      if (err.name === 'SequelizeValidationError') {
        return res.status(400).json(apiResponse.error(
          'DATABASE_VALIDATION_ERROR',
          'Database validation failed',
          requestId,
          err.errors
        ));
      }

      // Rate limit errors
      if (err.status === 429) {
        return res.status(429).json(apiResponse.error(
          'RATE_LIMIT_EXCEEDED',
          'Too many requests',
          requestId
        ));
      }

      // Default server error
      res.status(500).json(apiResponse.error(
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
        requestId
      ));
    });
  }

  async start() {
    try {
      // Initialize database connection
      await mysqlPool.testConnection();
      logger.info('Database connection established');

      // Initialize Redis connection
      await redisClient.connect();
      logger.info('Redis connection established');

      // Start background jobs
      require('./jobs/otp-cleanup.job');
      require('./jobs/account-deletion.job');

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`User service started on port ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        });
      });

    } catch (error) {
      logger.error('Failed to start user service', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down user service...');

    try {
      // Close database connections
      await mysqlPool.close();

      // Close Redis connection
      await redisClient.quit();

      logger.info('User service shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }
}

// Initialize app
const userServiceApp = new UserServiceApp();

// Graceful shutdown handling
process.on('SIGTERM', () => userServiceApp.shutdown());
process.on('SIGINT', () => userServiceApp.shutdown());

// Start the service
if (require.main === module) {
  userServiceApp.start();
}

module.exports = userServiceApp;
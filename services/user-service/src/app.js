const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

// Internal imports
const securityConfig = require("./config/security.config");
const logger = require("./utils/logger.util");

// Middleware imports
const authMiddleware = require("./middleware/auth.middleware");
const rateLimitMiddleware = require("./middleware/rate-limit.middleware");
const auditMiddleware = require("./middleware/audit.middleware");

// Controller imports
const authController = require("./controllers/auth.controller");
const profileController = require("./controllers/profile.controller");
const settingsController = require("./controllers/settings.controller");
const sessionController = require("./controllers/session.controller");
const adminController = require("./controllers/admin/admin.controller");
const complianceController = require("./controllers/admin/compliance.controller");

// Shared imports
const apiResponse = require("../shared/utils/api.response");
const redisClient = require("../shared/libraries/cache/redis.client");
const redisConfig = require("../shared/libraries/cache/redis.config");

// Database imports
const { sequelize, testConnection, closeConnection } = require("./models");

class UserServiceApp {
  constructor() {
    this.app = express();
    this.port = securityConfig.app.port;
    this.setupBasicMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupBasicMiddleware() {
    // Security middleware
    this.app.use(
      helmet({
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
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: securityConfig.cors.origin,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: securityConfig.cors.methods,
        allowedHeaders: securityConfig.cors.allowedHeaders,
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: `${securityConfig.app.maxFileSize}b` }));
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: `${securityConfig.app.maxFileSize}b`,
      })
    );
    // Compression middleware
    this.app.use(compression());

    // Request logging middleware
    this.app.use((req, res, next) => {
      req.requestId = require("uuid").v4();
      req.startTime = Date.now();

      logger.info("Incoming request", {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      next();
    });
    // Audit middleware for all routes
    this.app.use(auditMiddleware.logActivity);
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.status(200).json(
        apiResponse.success(
          {
            service: "user-service",
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: securityConfig.app.serviceVersion,
          },
          "Service is healthy"
        )
      );
    });

    // Database health check endpoint
    this.app.get("/health/db", async (req, res) => {
      try {
        const isConnected = await testConnection();
        const status = isConnected ? "healthy" : "unhealthy";

        res.status(isConnected ? 200 : 503).json(
          apiResponse.success(
            {
              status,
              timestamp: new Date().toISOString(),
              dialect: sequelize.getDialect(),
              database: sequelize.config.database,
            },
            `Database is ${status}`
          )
        );
      } catch (error) {
        logger.error("Database health check failed", { error: error.message });
        res
          .status(503)
          .json(
            apiResponse.error(
              "DATABASE_UNHEALTHY",
              "Database connection failed",
              req.requestId,
              { error: error.message }
            )
          );
      }
    });

    // API version prefix
    const apiV1 = express.Router();

    // Authentication routes
    apiV1.use("/auth", authController);

    // User profile routes (protected)
    apiV1.use("/user", profileController);

    // Settings and session routes (protected)
    apiV1.use("/user", settingsController);
    apiV1.use("/user", sessionController);

    // Admin routes (admin only)
    apiV1.use(
      "/admin",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      adminController
    );
    apiV1.use(
      "/admin",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      complianceController
    );

    // Mount API routes
    this.app.use("/api/v1", apiV1);

    // Setup Redis monitoring endpoints
    this.setupRedisMonitoring();

    // 404 handler
    this.app.use("*", (req, res) => {
      res
        .status(404)
        .json(
          apiResponse.error(
            "NOT_FOUND",
            `Route ${req.method} ${req.originalUrl} not found`,
            req.requestId
          )
        );
    });
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    const errorHandler = require("./middleware/error-handling.middleware");
    this.app.use(errorHandler);
  }

  /**
   * Setup Redis monitoring and health checks
   */
  setupRedisMonitoring() {
    // Add Redis metrics endpoint
    this.app.get(
      "/metrics/redis",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      (req, res) => {
        try {
          const metrics = redisClient.getMetrics();
          res
            .status(200)
            .json(
              apiResponse.success(
                metrics,
                "Redis metrics retrieved successfully"
              )
            );
        } catch (error) {
          logger.error("Failed to get Redis metrics", { error: error.message });
          res
            .status(500)
            .json(
              apiResponse.error(
                "METRICS_ERROR",
                "Failed to retrieve Redis metrics",
                req.requestId
              )
            );
        }
      }
    );

    // Redis health check endpoint
    this.app.get("/health/redis", async (req, res) => {
      try {
        const isReady = redisClient.isReady();
        const pingResult = await redisClient.ping();
        const metrics = redisClient.getMetrics();

        const healthStatus = {
          status: isReady ? "healthy" : "unhealthy",
          connected: isReady,
          ping: pingResult,
          hitRate: metrics.hitRate,
          totalRequests: metrics.totalRequests,
          errors: metrics.errors,
          timestamp: new Date().toISOString(),
        };

        const statusCode = isReady ? 200 : 503;
        res
          .status(statusCode)
          .json(
            apiResponse.success(healthStatus, `Redis is ${healthStatus.status}`)
          );
      } catch (error) {
        logger.error("Redis health check failed", { error: error.message });
        res
          .status(503)
          .json(
            apiResponse.error(
              "REDIS_UNHEALTHY",
              "Redis health check failed",
              req.requestId,
              { error: error.message }
            )
          );
      }
    });

    // Redis configuration info endpoint (admin only)
    this.app.get(
      "/admin/redis/config",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      (req, res) => {
        try {
          // Return non-sensitive configuration information
          const configInfo = {
            host: redisConfig.host,
            port: redisConfig.port,
            database: redisConfig.db,
            cluster: {
              enabled: redisConfig.cluster.enabled,
              nodes: redisConfig.cluster.enabled
                ? redisConfig.cluster.nodes.length
                : 0,
            },
            cache: {
              keyPrefix: redisConfig.cache.keyPrefix,
              compression: redisConfig.cache.compression.enabled,
              encryption: redisConfig.cache.serialization.enableEncryption,
            },
            monitoring: redisConfig.monitoring.enabled,
            healthCheck: redisConfig.health.enabled,
          };

          res
            .status(200)
            .json(
              apiResponse.success(configInfo, "Redis configuration retrieved")
            );
        } catch (error) {
          logger.error("Failed to get Redis config", { error: error.message });
          res
            .status(500)
            .json(
              apiResponse.error(
                "CONFIG_ERROR",
                "Failed to retrieve Redis configuration",
                req.requestId
              )
            );
        }
      }
    );

    // Redis cache clear endpoint (admin only)
    this.app.post(
      "/admin/redis/clear",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      async (req, res) => {
        try {
          const { pattern } = req.body;

          if (pattern === "all") {
            await redisClient.flushdb();
            logger.warn("Redis database flushed by admin", {
              adminId: req.user.userId,
              timestamp: new Date().toISOString(),
            });
          } else if (pattern) {
            // For specific patterns, we would need to implement key scanning
            // This is a basic implementation - in production, consider using Redis SCAN
            throw new Error("Pattern-based cache clearing not implemented");
          } else {
            throw new Error("Invalid clear pattern");
          }

          res
            .status(200)
            .json(
              apiResponse.success(
                { cleared: true, pattern },
                "Redis cache cleared successfully"
              )
            );
        } catch (error) {
          logger.error("Failed to clear Redis cache", {
            error: error.message,
            adminId: req.user?.userId,
          });
          res
            .status(500)
            .json(
              apiResponse.error(
                "CACHE_CLEAR_ERROR",
                "Failed to clear Redis cache",
                req.requestId,
                { error: error.message }
              )
            );
        }
      }
    );
  }

  async start() {
    try {
      // Test database connection
      const isConnectedDb = await testConnection();
      if (!isConnectedDb) {
        throw new Error("Database connection failed");
      }
      logger.info("Database connection established successfully");

      // Sync database in development
      if (process.env.NODE_ENV === "development") {
        await sequelize.sync({ alter: true });
        logger.info("Database models synchronized");
      }

      // Initialize Redis connection with proper error handling
      logger.info("Connecting to Redis...");
      await redisClient.connect();

      // Wait for Redis to be fully ready
      let retries = 0;
      const maxRetries = 30; // 30 seconds timeout

      while (!redisClient.isReady() && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries++;

        if (retries % 5 === 0) {
          logger.info(
            `Waiting for Redis to be ready... (${retries}/${maxRetries})`
          );
        }
      }

      if (!redisClient.isReady()) {
        throw new Error("Redis failed to reach ready state within timeout");
      }

      logger.info("Redis connection established", {
        host: redisConfig.host,
        port: redisConfig.port,
        cluster: redisConfig.cluster.enabled,
        monitoring: redisConfig.monitoring.enabled,
        healthCheck: redisConfig.health.enabled,
      });

      // Initialize Redis store for rate limiting after Redis is connected
      try {
        await rateLimitMiddleware.initializeRedisStore();
        logger.info("Redis store initialized for rate limiting");
      } catch (error) {
        logger.warn(
          "Failed to initialize Redis store for rate limiting, continuing with memory store",
          {
            error: error.message,
          }
        );
      }

      // Setup rate limiting middleware now that Redis is ready
      this.setupRateLimitingMiddleware();

      // Test Redis functionality with error handling
      try {
        await redisClient.set(
          "startup_test",
          {
            timestamp: new Date().toISOString(),
            service: "user-service",
          },
          60
        );

        const testData = await redisClient.get("startup_test");
        if (testData) {
          logger.info("Redis functionality test passed");
          await redisClient.del("startup_test");
        } else {
          logger.warn(
            "Redis test data was null, but connection appears working"
          );
        }
      } catch (error) {
        logger.error("Redis functionality test failed", {
          error: error.message,
        });
        // Don't fail startup for Redis test failure, just log it
      }

      // Start background jobs
      require("./jobs/otp-cleanup.job");
      require("./jobs/account-deletion.job");
      require("./jobs/sessions-cleanup.job");

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`User service started on port ${this.port}`, {
          port: this.port,
          environment: process.env.NODE_ENV || "development",
          nodeVersion: process.version,
          database: {
            dialect: sequelize.getDialect(),
            connected: isConnectedDb,
          },
          redis: {
            connected: redisClient.isReady(),
            metrics: redisClient.getMetrics(),
          },
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      logger.error("Failed to start user service", {
        error: error.message,
        stack: error.stack,
      });

      // Attempt graceful cleanup
      try {
        await this.shutdown();
      } catch (shutdownError) {
        logger.error("Error during emergency shutdown", {
          error: shutdownError.message,
        });
      }

      process.exit(1);
    }
  }

  setupRateLimitingMiddleware() {
    // Global rate limiting (only after Redis is ready)
    if (securityConfig.rateLimit.enabled) {
      try {
        this.app.use(rateLimitMiddleware.globalRateLimit);
        logger.info("Rate limiting middleware initialized");
      } catch (error) {
        logger.warn("Failed to setup rate limiting middleware", {
          error: error.message,
        });
      }
    }
  }

  async shutdown() {
    logger.info("Shutting down user service...");

    try {
      // Stop health checks first
      if (redisClient.stopHealthCheck) {
        redisClient.stopHealthCheck();
      }

      // Close database connections
      await closeConnection();
      logger.info("Database connection closed successfully");

      // Close Redis connection with proper cleanup
      if (redisClient.isReady()) {
        await redisClient.quit();
        logger.info("Redis connection closed successfully");
      } else {
        logger.info("Redis connection was already closed");
      }

      logger.info("User service shut down successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }
}

// Initialize app
const userServiceApp = new UserServiceApp();

// Graceful shutdown handling
process.on("SIGTERM", () => userServiceApp.shutdown());
process.on("SIGINT", () => userServiceApp.shutdown());

// Start the service
if (require.main === module) {
  userServiceApp.start();
}

module.exports = userServiceApp;

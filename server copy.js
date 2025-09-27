const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const securityConfig = require("./shared/config/security.config");
const logger = require("./shared/utils/logger.util");
const apiResponse = require("./shared/utils/api.response");

const redisClient = require("./shared/libraries/cache/redis.client");
const redisConfig = require("./shared/libraries/cache/redis.config");

// Middleware imports
const auditMiddleware = require("./services/user-service/src/middlewares/audit.middleware");
const rateLimitMiddleware = require("./shared/middlewares/rate-limit.middleware");
const authMiddleware = require("./services/user-service/src/middlewares/auth.middleware");

// Services modules imports
const userServiceModule = require("./services/user-service/src/app");
const locationServiceModule = require("./services/location-service/src/app");
const mediaServiceModule = require("./services/media-service/src/app");
const placeServiceModule = require("./services/place-service/src/app");

class App {
  constructor() {
    this.app = express();
    this.port = securityConfig.app.port;
    this.app.set("trust proxy", 1);

    // Track service initialization status
    this.serviceStatus = {
      user: { initialized: false, ready: false },
      location: { initialized: false, ready: false },
      place: { initialized: false, ready: false },
      media: { initialized: false, ready: false },
    };

    this.setupBasicMiddleware();
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
      const uuid = require("uuid").v4();
      req.requestId = uuid;
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

  /**
   * Initialize all microservice modules
   * Each service manages its own dependencies internally
   */
  async initializeServices() {
    logger.info("Initializing services...");

    try {
      // 1. Initialize User Service
      logger.info("Initializing User Service...");
      const userServiceInitResult = await userServiceModule.initialize();

      this.serviceStatus.user = {
        initialized: true,
        ready: userServiceModule.isReady(),
        capabilities: userServiceInitResult.capabilities,
        services: userServiceInitResult.services,
      };

      logger.info("User Service initialized successfully", {
        capabilities: userServiceInitResult.capabilities,
        internalServices: Object.keys(userServiceInitResult.services).filter(
          (s) => userServiceInitResult.services[s]
        ),
      });

      // 2. Initialize Location Service
      logger.info("Initializing Location Service...");
      const locationServiceInitResult =
        await locationServiceModule.initialize();

      this.serviceStatus.location = {
        initialized: true,
        ready: userServiceModule.isReady(),
      };

      logger.info("Location Service initialized successfully");

      // 3. Initialize Place Service
      logger.info("Initializing Place Service...");
      const placeServiceInitResult = await placeServiceModule.initialize();

      this.serviceStatus.user = {
        initialized: true,
        ready: placeServiceModule.isReady(),
        services: placeServiceInitResult.services,
      };

      logger.info("Place Service initialized successfully", {
        internalServices: Object.keys(userServiceInitResult.services).filter(
          (s) => placeServiceInitResult.services[s]
        ),
      });

      // 4. Initialize Media Service
      logger.info("Initializing Media Service...");
      const mediaServiceInitResult = await mediaServiceModule.initialize();

      this.serviceStatus.media = {
        initialized: true,
        ready: mediaServiceModule.isReady(),
        capabilities: mediaServiceInitResult.capabilities,
        services: mediaServiceInitResult.services,
      };

      logger.info("Media Service initialized successfully", {
        capabilities: mediaServiceInitResult.capabilities,
        internalServices: Object.keys(mediaServiceInitResult.services).filter(
          (s) => mediaServiceInitResult.services[s]
        ),
      });

      // Other services can be initialized here with their own patterns (mock here)
      this.serviceStatus.location.initialized = true;
      this.serviceStatus.location.ready = true;

      this.serviceStatus.place.initialized = true;
      this.serviceStatus.place.ready = true;

      logger.info("All services initialized successfully", {
        services: this.serviceStatus,
      });
    } catch (error) {
      logger.error("Service initialization failed", {
        error: error.message,
        stack: error.stack,
        serviceStatus: this.serviceStatus,
      });
      throw error;
    }
  }

  /**
   * Function to Check the health of all service and common dependencies
   */
  async checkDependencyHealth() {
    const results = {
      redis: { status: "unknown", details: null },
      services: {}, // per-service health
      overall: "unhealthy",
    };

    try {
      // Check Redis health
      const isRedisReady = redisClient.isReady();
      const pingResult = await redisClient.ping();
      const metrics = redisClient.getMetrics();

      results.redis = {
        status: isRedisReady ? "healthy" : "unhealthy",
        details: {
          connected: isRedisReady,
          ping: pingResult,
          hitRate: metrics.hitRate,
          totalRequests: metrics.totalRequests,
          errors: metrics.errors,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      results.redis = {
        status: "unhealthy",
        details: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Check individual service health
    try {
      results.services.user = await userServiceModule.getHealthStatus();
      results.services.location = await locationServiceModule.getHealthStatus();
      results.services.place = await placeServiceModule.getHealthStatus();
      results.services.media = await mediaServiceModule.getHealthStatus();
    } catch (error) {
      logger.error("Service health check failed", { error: error.message });
    }

    const coreHealthy = results.redis.status === "healthy";

    const servicesHealthy = Object.values(results.services).every(
      (service) => service.status === "healthy" || service.status === undefined
    );

    // Overall health
    results.overall = coreHealthy && servicesHealthy ? "healthy" : "unhealthy";

    return results;
  }

  /**
   * Setup rate limiting middleware AFTER Redis is ready
   */
  async setupRateLimitingMiddleware() {
    try {
      // Initialize Redis store for rate limiting
      await rateLimitMiddleware.initializeRedisStore();

      // Apply global rate limiting if enabled
      if (securityConfig.rateLimit.enabled) {
        // Insert rate limiting middleware before existing routes
        this.app.use(rateLimitMiddleware.globalRateLimit());
        logger.info(
          "Global rate limiting middleware initialized with Redis store"
        );
      }
    } catch (error) {
      logger.warn(
        "Failed to initialize Redis store for rate limiting, using memory store",
        {
          error: error.message,
        }
      );

      // Still apply rate limiting with memory store as fallback
      if (securityConfig.rateLimit.enabled) {
        this.app.use(rateLimitMiddleware.globalRateLimit());
        logger.warn(
          "Rate limiting middleware initialized with memory store fallback"
        );
      }
    }
  }

  /**
   * Setup all application routes AFTER services and middlewares are initialized
   */
  setupRoutes() {
    // ===== HEALTH CHECK ENDPOINTS =====

    // Comprehensive health check endpoint
    this.app.get("/health", async (req, res) => {
      try {
        const healthResults = await this.checkDependencyHealth();

        const response = {
          status: healthResults.overall,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          dependencies: {
            database: healthResults.databases,
            redis: healthResults.redis,
          },
          services: this.serviceStatus,
          serviceHealth: healthResults.services,
        };

        const statusCode = healthResults.overall === "healthy" ? 200 : 503;
        const message = `Server is ${healthResults.overall}`;

        res
          .status(statusCode)
          .json(
            statusCode === 200
              ? apiResponse.success(response, message)
              : apiResponse.error(
                  "HEALTH_CHECK_FAILED",
                  message,
                  req.requestId,
                  response
                )
          );
      } catch (error) {
        logger.error("Health check failed", { error: error.message });
        res
          .status(503)
          .json(
            apiResponse.error(
              "HEALTH_CHECK_FAILED",
              "Health check encountered an error",
              req.requestId,
              { error: error.message, result: response }
            )
          );
      }
    });

    // Redis health check only
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

    // Readiness probe (for Kubernetes/Docker)
    this.app.get("/ready", async (req, res) => {
      try {
        const healthResults = await this.checkDependencyHealth();
        const allServicesReady = Object.values(this.serviceStatus).every(
          (service) => service.ready
        );

        if (healthResults.overall === "healthy" && allServicesReady) {
          res.status(200).json(
            apiResponse.success(
              {
                ready: true,
                timestamp: new Date().toISOString(),
                services: this.serviceStatus,
              },
              "Service is ready"
            )
          );
        } else {
          res.status(503).json(
            apiResponse.error(
              "SERVICE_NOT_READY",
              "Service dependencies are not healthy",
              req.requestId,
              {
                dependencies: healthResults,
                services: this.serviceStatus,
              }
            )
          );
        }
      } catch (error) {
        res
          .status(503)
          .json(
            apiResponse.error(
              "READINESS_CHECK_FAILED",
              "Readiness check failed",
              req.requestId,
              { error: error.message }
            )
          );
      }
    });

    // Liveness probe (for Kubernetes/Docker)
    this.app.get("/live", (req, res) => {
      res.status(200).json(
        apiResponse.success(
          {
            alive: true,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          },
          "Service is alive"
        )
      );
    });

    // Mount API routes
    this.app.use("/api/v1", userServiceModule);
    this.app.use("/api/v1", locationServiceModule);
    this.app.use("/api/v1", placeServiceModule);
    this.app.use("/api/v1", mediaServiceModule);

    // ===== MONITORING ENDPOINTS =====
    this.setupMonitoringEndpoints();

    // ===== REDIS MANAGEMENT ENDPOINTS =====
    this.setupRedisManagementEndpoints();

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
   * Setup monitoring endpoints
   */
  setupMonitoringEndpoints() {
    // Redis metrics endpoint
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

    // Service status endpoint
    this.app.get(
      "/metrics/services",
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      async (req, res) => {
        try {
          const serviceMetrics = {
            status: this.serviceStatus,
            media: mediaServiceModule.getStatus(),
          };

          res
            .status(200)
            .json(
              apiResponse.success(
                serviceMetrics,
                "Service metrics retrieved successfully"
              )
            );
        } catch (error) {
          logger.error("Failed to get service metrics", {
            error: error.message,
          });
          res
            .status(500)
            .json(
              apiResponse.error(
                "SERVICE_METRICS_ERROR",
                "Failed to retrieve service metrics",
                req.requestId
              )
            );
        }
      }
    );
  }

  /**
   * Setup Redis management endpoints
   */
  setupRedisManagementEndpoints() {
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

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    const errorHandler = require("./services/user-service/src/middlewares/error-handling.middleware");
    this.app.use(errorHandler);
  }

  /**
   * Start the application with proper dependency checks
   */
  async start() {
    try {
      logger.info("Starting app...");

      // ===== INITIALIZE REDIS CONNECTION =====
      logger.info("Connecting to Redis...");
      await redisClient.connect();

      // Verify Redis connection with retries
      const maxRetries = 10;
      let retries = 0;

      while (!redisClient.isReady() && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries++;

        if (retries % 5 === 0) {
          logger.info(
            `Waiting for Redis connection... (${retries}/${maxRetries})`
          );
        }
      }

      if (!redisClient.isReady()) {
        throw new Error(
          "Redis failed to reach ready state within timeout - cannot start service"
        );
      }

      logger.info("Redis connection established successfully", {
        host: redisConfig.host,
        port: redisConfig.port,
        cluster: redisConfig.cluster.enabled,
        monitoring: redisConfig.monitoring.enabled,
        healthCheck: redisConfig.health.enabled,
      });

      // ===== TEST REDIS FUNCTIONALITY =====
      logger.info("Testing Redis functionality...");
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
          await redisClient.del("startup_test");
          logger.info("Redis functionality test passed");
        } else {
          throw new Error("Redis test data retrieval failed");
        }
      } catch (error) {
        throw new Error(`Redis functionality test failed: ${error.message}`);
      }

      // ===== INITIALIZE ALL SERVICES =====
      logger.info("Initializing services...");
      await this.initializeServices();

      // ===== COMPREHENSIVE HEALTH CHECK =====
      logger.info("Performing comprehensive health check...");
      const healthResults = await this.checkDependencyHealth();
      if (healthResults.overall !== "healthy") {
        logger.error("Dependencies health check failed", healthResults);
        throw new Error("Dependencies are not healthy - cannot start server");
      }

      logger.info("All dependencies are healthy", {
        database: healthResults.databases.overall,
        redis: healthResults.redis.status,
        services: Object.keys(this.serviceStatus).filter(
          (s) => this.serviceStatus[s].ready
        ),
      });

      // ===== INITIALIZE RATE LIMITING =====
      logger.info("Initializing rate limiting...");
      await this.setupRateLimitingMiddleware();

      // ===== SETUP ROUTES AFTER RATE LIMITING IS READY =====
      logger.info("Setting up application routes...");
      this.setupRoutes();
      logger.info("Application routes configured");

      // ===== START BACKGROUND JOBS =====
      logger.info("Starting background jobs...");
      require("./jobs/otp-cleanup.job");
      require("./jobs/account-deletion.job");
      require("./jobs/sessions-cleanup.job");
      logger.info("Background jobs started");

      // ===== START HTTP SERVER =====
      this.app.listen(this.port, "0.0.0.0", () => {
        logger.info(`Server running on port ${this.port}`, {
          environment: process.env.NODE_ENV || "development",
          nodeVersion: process.version,
          dependencies: {
            redis: healthResults.redis.status,
          },
          services: this.serviceStatus,
          rateLimiting: {
            enabled: securityConfig.rateLimit.enabled,
            store: "redis",
          },
          metrics: redisClient.getMetrics(),
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      logger.error("Failed to start server", {
        error: error.message,
        stack: error.stack,
        serviceStatus: this.serviceStatus,
      });
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown of the application
   */
  async shutdown() {
    logger.info("Shutting down server...");

    try {
      // Stop health checks first
      if (redisClient.stopHealthCheck) {
        redisClient.stopHealthCheck();
      }

      // Shutdown services in reverse order of initialization
      if (this.serviceStatus.media.initialized) {
        await mediaServiceModule.shutdown();
        logger.info("Media service shutdown completed");
      }
      if (this.serviceStatus.place.initialized) {
        await placeServiceModule.shutdown();
        logger.info("Place service shutdown completed");
      }
      if (this.serviceStatus.location.initialized) {
        await locationServiceModule.shutdown();
        logger.info("Location service shutdown completed");
      }
      if (this.serviceStatus.user.initialized) {
        await userServiceModule.shutdown();
        logger.info("User service shutdown completed");
      }

      // Close Redis connection with proper cleanup
      if (redisClient.isReady && redisClient.isReady()) {
        await redisClient.quit();
        logger.info("Redis connection closed successfully");
      } else {
        logger.info("Redis connection was already closed");
      }

      logger.info("Server shut down successfully");
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

// ===== APPLICATION INITIALIZATION =====
const AppServer = new App();

// ===== GRACEFUL SHUTDOWN HANDLING =====
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM signal");
  AppServer.shutdown();
});
process.on("SIGINT", () => {
  logger.info("Received SIGINT signal");
  AppServer.shutdown();
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
  AppServer.shutdown();
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    error: error.message,
    stack: error.stack,
  });
  AppServer.shutdown();
});

// ===== START THE SERVICE =====
if (require.main === module) {
  AppServer.start();
}

module.exports = AppServer;

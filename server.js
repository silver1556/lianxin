const express = require("express");
const uuid = require("uuid").v4();

const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const securityConfig = require("./shared/config/security.config");
const logger = require("./shared/utils/logger.util");
const ApiResponse = require("./shared/utils/api.response");

const redisClient = require("./shared/libraries/cache/redis.client");
const redisConfig = require("./shared/libraries/cache/redis.config");

// Middleware imports
const auditMiddleware = require("./services/user-service/src/middlewares/audit.middleware");
const rateLimitMiddleware = require("./shared/middlewares/rate-limit.middleware");
const authMiddleware = require("./services/user-service/src/middlewares/auth.middleware");
const errorHandler = require("./shared/middlewares/error-handler.middleware");

// Services modules imports
const userServiceModule = require("./services/user-service/src/app");
const locationServiceModule = require("./services/location-service/src/app");
const mediaServiceModule = require("./services/media-service/src/app");
const placeServiceModule = require("./services/place-service/src/app");

// Swagger imports
const swaggerUi = require("swagger-ui-express");

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
  }

  setupBasicMiddleware() {
    // Request id middleware
    this.app.use((req, res, next) => {
      req.requestId = req.headers["x-request-id"] || uuid;
      next();
    });

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

      await locationServiceModule.initialize();

      this.serviceStatus.location = {
        initialized: true,
        ready: locationServiceModule.isReady(),
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
    // ===== SWAGGER DOCUMENTATION SETUP =====
    this.setupSwaggerDocumentation();

    // ===== HEALTH CHECK ENDPOINTS =====

    // Comprehensive health check endpoint
    this.app.get("/health", async (req, res) => {
      try {
        const healthResults = await this.checkDependencyHealth();

        const responseData = {
          status: healthResults.overall,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          dependencies: {
            redis: healthResults.redis,
          },
          services: this.serviceStatus,
          serviceHealth: healthResults.services,
        };

        const statusCode = healthResults.overall === "healthy" ? 200 : 503;
        const message = `Server is ${healthResults.overall}`;

        const response =
          healthResults.overall === "healthy"
            ? ApiResponse.success(message, responseData)
            : ApiResponse.error(
                message,
                "HEALTH_CHECK_FAILED",
                statusCode,
                responseData
              );

        response.send(res);
      } catch (error) {
        logger.error("Health check failed", { error: error.message });
        ApiResponse.error(
          "Health check encountered an error",
          "HEALTH_CHECK_FAILED",
          503,
          { error: error.message }
        ).send(res);
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
        const message = `Redis is ${healthStatus.status}`;

        ApiResponse.success(message, healthStatus)
          .setStatusCode(statusCode)
          .send(res);
      } catch (error) {
        logger.error("Redis health check failed", { error: error.message });
        ApiResponse.error("Redis health check failed", "REDIS_UNHEALTHY", 503, {
          error: error.message,
        }).send(res);
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
          ApiResponse.success("Service is ready", {
            ready: true,
            timestamp: new Date().toISOString(),
            services: this.serviceStatus,
          }).send(res);
        } else {
          ApiResponse.error(
            "Service dependencies are not healthy",
            "SERVICE_NOT_READY",
            503,
            {
              dependencies: healthResults,
              services: this.serviceStatus,
            }
          ).send(res);
        }
      } catch (error) {
        ApiResponse.error(
          "Readiness check failed",
          "READINESS_CHECK_FAILED",
          503,
          { error: error.message }
        ).send(res);
      }
    });

    // Liveness probe (for Kubernetes/Docker)
    this.app.get("/live", (req, res) => {
      ApiResponse.success("Service is alive", {
        alive: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }).send(res);
    });

    // Mount API routes
    this.app.use("/api/v1", userServiceModule.getRouter());
    this.app.use("/api/v1", locationServiceModule.getRouter());
    this.app.use("/api/v1", placeServiceModule.getRouter());
    this.app.use("/api/v1", mediaServiceModule.getRouter());

    // ===== MONITORING ENDPOINTS =====
    this.setupMonitoringEndpoints();

    // ===== REDIS MANAGEMENT ENDPOINTS =====
    this.setupRedisManagementEndpoints();
  }

  /**
   * Setup Swagger documentation for all services
   */
  setupSwaggerDocumentation() {
    try {
      // Load service-specific API documentation
      const userServiceDocs = require("./services/user-service/src/swagger/swagger");
      const locationServiceDocs = require("./services/location-service/src/swagger/swagger");
      const placeServiceDocs = require("./services/place-service/src/swagger/swagger");
      const mediaServiceDocs = require("./services/media-service/src/swagger/swagger");

      // Utility: prefix paths to avoid collisions
      const prefixPaths = (paths, prefix) => {
        const result = {};
        for (const [key, value] of Object.entries(paths || {})) {
          result[`${prefix}${key}`] = value;
        }
        return result;
      };

      // Utility: prefix schemas to avoid collisions
      const prefixSchemas = (schemas, prefix) => {
        const result = {};
        for (const [key, value] of Object.entries(schemas || {})) {
          result[`${prefix}_${key}`] = value;
        }
        return result;
      };

      // Main API documentation (combined)
      const combinedSpec = {
        openapi: "3.0.0",
        info: {
          title: "Lianxin API",
          version: "1.0.0",
          description:
            "Comprehensive API documentation for all platform services",
          contact: {
            name: "Lianxin API Support",
            email: "support@lianxin.com",
          },
        },
        servers: [
          {
            url: "/api/v1",
            description: "Main API Server",
          },
        ],
        tags: [
          {
            name: "Authentication",
            description: "User authentication endpoints",
          },
          { name: "User", description: "User management endpoints" },
          { name: "Location", description: "Location service endpoints" },
          { name: "Media", description: "Media service endpoints" },
          { name: "Place", description: "Place service endpoints" },
          { name: "Admin", description: "Administrative endpoints" },
        ],
        paths: {
          ...prefixPaths(userServiceDocs.paths, "/user"),
          ...prefixPaths(locationServiceDocs.paths, "/location"),
          ...prefixPaths(placeServiceDocs.paths, "/place"),
          ...prefixPaths(mediaServiceDocs.paths, "/media"),
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
          schemas: {
            ...prefixSchemas(userServiceDocs.components?.schemas, "User"),
            ...prefixSchemas(
              locationServiceDocs.components?.schemas,
              "Location"
            ),
            ...prefixSchemas(placeServiceDocs.components?.schemas, "Place"),
            ...prefixSchemas(mediaServiceDocs.components?.schemas, "Media"),
          },
        },
      };

      // --- Serve combined documentation ---
      this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(combinedSpec));

      // --- Serve per-service documentation ---
      this.app.use(
        "/api-docs/user",
        swaggerUi.serve,
        swaggerUi.setup(userServiceDocs)
      );
      this.app.use(
        "/api-docs/location",
        swaggerUi.serve,
        swaggerUi.setup(locationServiceDocs)
      );
      this.app.use(
        "/api-docs/place",
        swaggerUi.serve,
        swaggerUi.setup(placeServiceDocs)
      );
      this.app.use(
        "/api-docs/media",
        swaggerUi.serve,
        swaggerUi.setup(mediaServiceDocs)
      );

      // --- Optional documentation index page ---
      this.app.get("/docs", (req, res) => {
        res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lianxin API Documentation</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            .service-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 10px 0; background: #f9f9f9; }
            a { display: inline-block; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
            a:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>Lianxin API Documentation</h1>
          <div class="service-card">
            <h2>Combined API Documentation</h2>
            <p>Complete documentation for all services</p>
            <a href="/api-docs" target="_blank">View Combined Docs</a>
          </div>
          <div class="service-card">
            <h2>User Service</h2>
            <p>Authentication, user profiles, and account management</p>
            <a href="/api-docs/user" target="_blank">View User Service Docs</a>
          </div>
          <div class="service-card">
            <h2>Location Service</h2>
            <p>Geolocation and mapping services</p>
            <a href="/api-docs/location" target="_blank">View Location Service Docs</a>
          </div>
          <div class="service-card">
            <h2>Place Service</h2>
            <p>Places, venues, and location-based services</p>
            <a href="/api-docs/place" target="_blank">View Place Service Docs</a>
          </div>
          <div class="service-card">
            <h2>Media Service</h2>
            <p>File uploads, images, and media management</p>
            <a href="/api-docs/media" target="_blank">View Media Service Docs</a>
          </div>
        </body>
        </html>
      `);
      });

      logger.info("Swagger documentation setup completed successfully");
    } catch (error) {
      logger.error("Failed to setup Swagger documentation", {
        error: error.message,
        stack: error.stack,
      });
    }
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

          ApiResponse.success(
            "Redis metrics retrieved successfully",
            metrics
          ).send(res);
        } catch (error) {
          logger.error("Failed to get Redis metrics", { error: error.message });
          ApiResponse.error(
            "Failed to retrieve Redis metrics",
            "METRICS_ERROR",
            500
          ).send(res);
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

          ApiResponse.success(
            "Service metrics retrieved successfully",
            serviceMetrics
          ).send(res);
        } catch (error) {
          logger.error("Failed to get service metrics", {
            error: error.message,
          });
          ApiResponse.error(
            "Failed to retrieve service metrics",
            "SERVICE_METRICS_ERROR",
            500
          ).send(res);
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

          ApiResponse.success("Redis configuration retrieved", configInfo).send(
            res
          );
        } catch (error) {
          logger.error("Failed to get Redis config", { error: error.message });
          ApiResponse.error(
            "Failed to retrieve Redis configuration",
            "CONFIG_ERROR",
            500
          ).send(res);
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

          ApiResponse.success("Redis cache cleared successfully", {
            cleared: true,
            pattern,
          }).send(res);
        } catch (error) {
          logger.error("Failed to clear Redis cache", {
            error: error.message,
            adminId: req.user?.userId,
          });
          ApiResponse.error(
            "Failed to clear Redis cache",
            "CACHE_CLEAR_ERROR",
            500,
            { error: error.message }
          ).send(res);
        }
      }
    );
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    this.app.use(errorHandler.handleNotFound());
    this.app.use(errorHandler.handleError());
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

      // ===== SETUP Error Handling AFTER routes =====
      logger.info("Setting up error handler...");
      this.setupErrorHandling();

      // ===== START BACKGROUND JOBS =====
      logger.info("Starting background jobs...");
      require("./services/user-service/src/jobs/otp-cleanup.job");
      require("./services/user-service/src/jobs/account-deletion.job");
      require("./services/user-service/src/jobs/sessions-cleanup.job");
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

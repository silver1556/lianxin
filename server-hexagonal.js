const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { v4: uuidv4 } = require("uuid");

// Configuration
const securityConfig = require("./shared/config/security.config");
const logger = require("./shared/utils/logger.util");
const ApiResponse = require("./shared/utils/api.response");

// Hexagonal Architecture Bootstrap
const Bootstrap = require("./src/infrastructure/config/Bootstrap");

// Legacy Redis client for backward compatibility
const redisClient = require("./shared/libraries/cache/redis.client");

// Legacy database models for backward compatibility
const { sequelize, testConnection } = require("./services/user-service/src/models");

/**
 * Hexagonal Architecture Application
 * Main application using Ports & Adapters pattern with modular monolith
 */
class HexagonalApp {
  constructor() {
    this.app = express();
    this.port = securityConfig.app.port;
    this.app.set("trust proxy", 1);

    // Hexagonal architecture components
    this.bootstrap = new Bootstrap();
    this.container = null;
    this.moduleRegistry = null;
    this.modules = {};

    this.setupBasicMiddleware();
  }

  setupBasicMiddleware() {
    // Request ID middleware
    this.app.use((req, res, next) => {
      req.requestId = req.headers["x-request-id"] || uuidv4();
      req.startTime = Date.now();
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
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Compression middleware
    this.app.use(compression());

    // Request logging middleware
    this.app.use((req, res, next) => {
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
  }

  /**
   * Initialize hexagonal architecture
   */
  async initializeArchitecture() {
    try {
      logger.info("Initializing Hexagonal Architecture...");

      // Initialize legacy database connection
      const isDbConnected = await testConnection();
      if (!isDbConnected) {
        throw new Error("Database connection failed");
      }

      // Initialize legacy Redis connection
      await redisClient.connect();
      if (!redisClient.isReady()) {
        throw new Error("Redis connection failed");
      }

      // Bootstrap hexagonal architecture
      const { container, moduleRegistry } = await this.bootstrap.initialize(
        securityConfig,
        { sequelize, testConnection, ...require("./services/user-service/src/models") },
        redisClient
      );

      this.container = container;
      this.moduleRegistry = moduleRegistry;

      // Get module instances
      this.modules = this.moduleRegistry.getAllModules();

      logger.info("Hexagonal Architecture initialized successfully", {
        modules: Object.keys(this.modules),
        dependencies: this.container.getDependencyInfo(),
      });

    } catch (error) {
      logger.error("Hexagonal Architecture initialization failed", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Setup application routes using modules
   */
  setupRoutes() {
    // Health check endpoints
    this.setupHealthRoutes();

    // Mount module routes
    this.app.use("/api/v1", this.modules.user.getRouter());
    this.app.use("/api/v1", this.modules.location.getRouter());
    this.app.use("/api/v1", this.modules.place.getRouter());
    this.app.use("/api/v1", this.modules.media.getRouter());

    // 404 handler
    this.app.use("*", (req, res) => {
      ApiResponse.notFound(`Route ${req.method} ${req.originalUrl} not found`)
        .setRequestId(req.requestId)
        .send(res);
    });

    // Error handling middleware
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Setup health check routes
   */
  setupHealthRoutes() {
    // Comprehensive health check
    this.app.get("/health", async (req, res) => {
      try {
        const health = await this.bootstrap.getHealth();
        const statusCode = health.status === "healthy" ? 200 : 503;

        ApiResponse.healthCheck(health.modules)
          .addMetadata("architecture", "hexagonal")
          .addMetadata("dependencies", health.dependencies)
          .setStatusCode(statusCode)
          .setRequestId(req.requestId)
          .send(res);

      } catch (error) {
        logger.error("Health check failed", { error: error.message });
        ApiResponse.serviceUnavailable("Health check failed")
          .setRequestId(req.requestId)
          .send(res);
      }
    });

    // Readiness probe
    this.app.get("/ready", async (req, res) => {
      try {
        const moduleHealth = await this.moduleRegistry.getAllModulesHealth();
        const allReady = Object.values(moduleHealth).every(
          health => health.status === "healthy"
        );

        if (allReady) {
          ApiResponse.success("Service is ready", {
            ready: true,
            modules: moduleHealth
          })
            .setRequestId(req.requestId)
            .send(res);
        } else {
          ApiResponse.serviceUnavailable("Service not ready", {
            ready: false,
            modules: moduleHealth
          })
            .setRequestId(req.requestId)
            .send(res);
        }
      } catch (error) {
        ApiResponse.serviceUnavailable("Readiness check failed")
          .setRequestId(req.requestId)
          .send(res);
      }
    });

    // Liveness probe
    this.app.get("/live", (req, res) => {
      ApiResponse.success("Service is alive", {
        alive: true,
        uptime: process.uptime(),
        architecture: "hexagonal"
      })
        .setRequestId(req.requestId)
        .send(res);
    });
  }

  /**
   * Error handling middleware
   */
  errorHandler(err, req, res, next) {
    logger.error("Request error", {
      error: err.message,
      stack: err.stack,
      requestId: req.requestId,
      method: req.method,
      url: req.url,
    });

    // Handle different error types
    if (err.name === 'ValidationError') {
      return ApiResponse.validationError(err.message, err.errors || [])
        .setRequestId(req.requestId)
        .send(res);
    }

    if (err.name === 'AuthError') {
      return ApiResponse.unauthorized(err.message)
        .setRequestId(req.requestId)
        .send(res);
    }

    // Default error response
    ApiResponse.internalServerError(
      process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : err.message
    )
      .setRequestId(req.requestId)
      .send(res);
  }

  /**
   * Start the application
   */
  async start() {
    try {
      logger.info("Starting Hexagonal Architecture Application...");

      // Initialize hexagonal architecture
      await this.initializeArchitecture();

      // Setup routes after modules are initialized
      this.setupRoutes();

      // Start HTTP server
      this.app.listen(this.port, "0.0.0.0", () => {
        logger.info(`Hexagonal Architecture Server running on port ${this.port}`, {
          environment: process.env.NODE_ENV || "development",
          nodeVersion: process.version,
          architecture: "hexagonal",
          modules: Object.keys(this.modules),
          dependencies: this.container.getDependencyInfo(),
          timestamp: new Date().toISOString(),
        });
      });

    } catch (error) {
      logger.error("Failed to start Hexagonal Architecture Application", {
        error: error.message,
        stack: error.stack,
      });
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info("Shutting down Hexagonal Architecture Application...");

    try {
      // Shutdown bootstrap (which handles module shutdown)
      if (this.bootstrap) {
        await this.bootstrap.shutdown();
      }

      // Close legacy connections
      if (redisClient.isReady && redisClient.isReady()) {
        await redisClient.quit();
        logger.info("Redis connection closed");
      }

      logger.info("Hexagonal Architecture Application shut down successfully");
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

// Create application instance
const app = new HexagonalApp();

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM signal");
  app.shutdown();
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT signal");
  app.shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
  app.shutdown();
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    error: error.message,
    stack: error.stack,
  });
  app.shutdown();
});

// Start the application
if (require.main === module) {
  app.start();
}

module.exports = app;
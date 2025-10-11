const express = require("express");

const securityConfig = require("./config/security.config");

// Internal imports
const logger = require("../../../shared/utils/logger.util");

// Database imports
const { sequelize, testConnection, closeConnection } = require("./models");

// Routes import
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const sessionRoutes = require("./routes/session.routes");
const settingsRoutes = require("./routes/settings.routes");

const adminRoutes = require("./routes/admin.routes");
const complianceRoutes = require("./routes/compliance.routes");

class UserServiceApp {
  constructor() {
    this.router = express.Router();
    this.services = { database: false };
  }

  async initialize() {
    if (this.isInitialized) {
      logger.warn("User service already initialized");
      return { success: true, services: this.services };
    }

    try {
      logger.info("Initializing User Service...");

      // Test database connection
      const isConnectedDb = await testConnection();
      if (!isConnectedDb) {
        throw new Error("User service database connection failed");
      }
      this.services.database = true;
      logger.info("User service database connection established");

      // Setup routes after all services are ready
      this.setupRoutes();

      this.isInitialized = true;

      logger.info("User Service initialized successfully", {
        service: "user-service",
        services: this.services,
      });

      return {
        success: true,
        services: this.services,
      };
    } catch (error) {
      logger.error("User Service initialization failed", {
        service: "user-service",
        error: error.message,
        stack: error.stack,
        services: this.services,
      });

      throw new Error(`User Service initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup user service routes
   * @private
   */
  setupRoutes() {
    // User service health check - internal to the service
    this.router.get("/health", async (req, res) => {
      const healthData = await this.getHealthStatus();

      const statusCode = healthData.status === "healthy" ? 200 : 503;

      res.status(statusCode).json({
        success: healthData.status === "healthy",
        data: healthData,
        message: `User service is ${healthData.status}`,
        timestamp: new Date().toISOString(),
      });
    });

    // Auth routes
    this.router.use("/auth", authRoutes);

    // Profile management routes
    this.router.use("/user", profileRoutes);

    // User settings routes
    this.router.use("/user", settingsRoutes);

    // User sessions routes
    this.router.use("/user", sessionRoutes);

    // Admin routes
    this.router.use("/admin", adminRoutes);
    this.router.use("/admin", complianceRoutes);
  }

  /**
   * Get User service health status
   * This is internal health checking, separate from overall app health
   */
  async getHealthStatus() {
    // Check database connectivity
    let databaseStatus = false;
    try {
      databaseStatus = await testConnection();
    } catch (error) {
      logger.warn("Database health check failed", {
        service: "user-service",
        error: error.message,
      });
    }

    const isHealthy = databaseStatus && this.isInitialized;

    return {
      service: "user-service",
      status: isHealthy ? "healthy" : "unhealthy",
      uptime: process.uptime(),
      version: securityConfig.app.serviceVersion,
      initialized: this.isInitialized,
      database: databaseStatus,
      services: this.services,
    };
  }

  /**
   * Get the Express router for this service
   * Exposed to the main server
   */
  getRouter() {
    if (!this.isInitialized) {
      throw new Error("User service not initialized. Call initialize() first.");
    }
    return this.router;
  }

  /**
   * Check if the service is ready to handle requests
   */
  isReady() {
    return this.isInitialized && this.services.database;
  }

  /**
   * Get service status for monitoring
   */
  getStatus() {
    return {
      name: "user-service",
      initialized: this.isInitialized,
      ready: this.isReady(),
      services: { ...this.services },
    };
  }

  /**
   * Graceful shutdown of user service
   */
  async shutdown() {
    logger.info("Shutting down User Service...", { service: "user-service" });

    try {
      // Close database connections
      if (this.services.database) {
        await closeConnection();
        logger.info("User service database connection closed");
      }

      this.isInitialized = false;
      this.services = {
        database: false,
      };

      logger.info("User Service shut down successfully", {
        service: "user-service",
      });
    } catch (error) {
      logger.error("Error during User Service shutdown", {
        service: "user-service",
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

// Export singleton instance
const userServiceInstance = new UserServiceApp();

module.exports = userServiceInstance;

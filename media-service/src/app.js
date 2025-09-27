const express = require("express");
const path = require("path");
const fs = require("fs-extra");

// Internal imports
const config = require("./config/app.config");
const logger = require("../../../shared/utils/logger.util");

// Service imports
const queueService = require("./services/queue.service");
const clamavService = require("./services/clamav.service");
const videoProcessorService = require("./services/video-processor.service");

// Database imports
const { sequelize, testConnection, closeConnection } = require("./models");

// Routes import
const mediaRoutes = require("./routes/media.routes");
const uploadRoutes = require("./routes/upload.routes");
const adminRoutes = require("./routes/admin.routes");

class MediaServiceApp {
  constructor() {
    this.router = express.Router();
    this.services = {
      database: false,
      clamav: false,
      queue: false,
      videoProcessor: false,
    };

    // Setup internal directories
    this.setupDirectories();
  }

  /**
   * Create necessary directories for media service
   * @private
   */
  setupDirectories() {
    const directories = [
      config.uploadDir,
      config.tempDir,
      path.join(config.tempDir, "processing"),
      path.join(config.tempDir, "thumbnails"),
      path.join(config.tempDir, "videos"),
      "./logs",
    ];

    directories.forEach((dir) => {
      fs.ensureDirSync(dir);
    });

    logger.info("Media service directories created", {
      service: "media-service",
      directories,
    });
  }

  /**
   * Initialize all media service dependencies
   * Encapsulates all internal service initialization
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("Media service already initialized");
      return { success: true, services: this.services };
    }

    try {
      logger.info("Initializing Media Service...");

      // Test database connection
      const isConnectedDb = await testConnection();
      if (!isConnectedDb) {
        throw new Error("Media service database connection failed");
      }
      this.services.database = true;
      logger.info("Media service database connection established");

      // Initialize Video Processor Service
      await this.initializeVideoProcessor();

      // Initialize ClamAV service
      await this.initializeClamAV();

      // Initialize queue service
      await this.initializeQueue();

      // Setup routes after all services are ready
      this.setupRoutes();

      this.isInitialized = true;

      logger.info("Media Service initialized successfully", {
        service: "media-service",
        services: this.services,
      });

      return {
        success: true,
        services: this.services,
        capabilities: this.getCapabilities(),
      };
    } catch (error) {
      logger.error("Media Service initialization failed", {
        service: "media-service",
        error: error.message,
        stack: error.stack,
        services: this.services,
      });

      throw new Error(`Media Service initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize video processor service
   * @private
   */
  async initializeVideoProcessor() {
    try {
      await videoProcessorService.initialize();
      this.services.videoProcessor = true;

      const systemInfo = await videoProcessorService.getSystemInfo();
      logger.info("Video processor service initialized", {
        service: "media-service",
        ffmpeg: systemInfo.ffmpeg.version,
        ffmpeg_codecs: systemInfo.ffmpeg.codecs,
        ffprobe: systemInfo.ffprobe.version,
        ffprobe_codecs: systemInfo.ffprobe.codecs,
        supportedFormats: systemInfo.supportedFormats,
      });
    } catch (error) {
      logger.error("Video processor initialization failed", {
        service: "media-service",
        error: error.message,
      });

      if (config.videoProcessing.required) {
        throw new Error(
          `Video processing is required but initialization failed: ${error.message}`
        );
      } else {
        logger.warn("Continuing without video processing capabilities", {
          service: "media-service",
        });
      }
    }
  }

  /**
   * Initialize ClamAV service
   * @private
   */
  async initializeClamAV() {
    try {
      await clamavService.initialize();
      this.services.clamav = true;
      logger.info("ClamAV service initialized", { service: "media-service" });
    } catch (error) {
      logger.error("ClamAV initialization failed", {
        service: "media-service",
        error: error.message,
      });

      if (config.clamav.required) {
        throw new Error(
          `ClamAV is required but initialization failed: ${error.message}`
        );
      } else {
        logger.warn("Continuing without malware scanning", {
          service: "media-service",
        });
      }
    }
  }

  /**
   * Initialize queue service
   * @private
   */
  async initializeQueue() {
    try {
      await queueService.initialize();
      this.services.queue = true;
      logger.info("Queue service initialized", { service: "media-service" });
    } catch (error) {
      logger.warn("Queue service initialization failed", {
        service: "media-service",
        error: error.message,
      });
    }
  }

  /**
   * Setup media service routes
   * @private
   */
  setupRoutes() {
    // Media service health check - internal to the service
    this.router.get("/health", async (req, res) => {
      const healthData = await this.getHealthStatus();

      const statusCode = healthData.status === "healthy" ? 200 : 503;

      res.status(statusCode).json({
        success: healthData.status === "healthy",
        data: healthData,
        message: `Media service is ${healthData.status}`,
        timestamp: new Date().toISOString(),
      });
    });

    // Upload routes (protected by auth middleware in server.js)
    this.router.use("/upload", uploadRoutes);

    // Media management routes (protected)
    this.router.use("/media", mediaRoutes);

    // Admin routes (admin check handled in server.js)
    this.router.use("/admin", adminRoutes);
  }

  /**
   * Get media service health status
   * This is internal health checking, separate from overall app health
   */
  async getHealthStatus() {
    let videoProcessorInfo = null;

    // Get video processor system info if available
    if (this.services.videoProcessor) {
      try {
        videoProcessorInfo = await videoProcessorService.getSystemInfo();
      } catch (error) {
        logger.warn("Could not get video processor info for health check", {
          service: "media-service",
          error: error.message,
        });
      }
    }

    // Check database connectivity
    let databaseStatus = false;
    try {
      databaseStatus = await testConnection();
    } catch (error) {
      logger.warn("Database health check failed", {
        service: "media-service",
        error: error.message,
      });
    }

    const isHealthy = databaseStatus && this.isInitialized;

    return {
      service: "media-service",
      status: isHealthy ? "healthy" : "unhealthy",
      uptime: process.uptime(),
      version: config.serviceVersion,
      initialized: this.isInitialized,
      database: databaseStatus,
      services: this.services,
      capabilities: this.getCapabilities(),
      videoProcessor: videoProcessorInfo,
    };
  }

  /**
   * Get service capabilities
   */
  getCapabilities() {
    return {
      imageProcessing: true,
      videoProcessing: this.services.videoProcessor,
      malwareScanning: this.services.clamav,
      cloudStorage: true,
      queueProcessing: this.services.queue,
    };
  }

  /**
   * Get the Express router for this service
   * Exposed to the main server
   */
  getRouter() {
    if (!this.isInitialized) {
      throw new Error(
        "Media service not initialized. Call initialize() first."
      );
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
      name: "media-service",
      initialized: this.isInitialized,
      ready: this.isReady(),
      services: { ...this.services },
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Graceful shutdown of media service
   */
  async shutdown() {
    logger.info("Shutting down Media Service...", { service: "media-service" });

    try {
      // Close queue connections
      if (this.services.queue) {
        await queueService.close();
        logger.info("Queue service closed", { service: "media-service" });
      }

      // Close database connections
      if (this.services.database) {
        await closeConnection();
        logger.info("Media service database connection closed");
      }

      // Video processor cleanup (Video processor doesn't need explicit cleanup (it's stateless), but could add cleanup for temporary files if needed)

      // ClamAV cleanup (if needed)

      this.isInitialized = false;
      this.services = {
        database: false,
        clamav: false,
        queue: false,
        videoProcessor: false,
      };

      logger.info("Media Service shut down successfully", {
        service: "media-service",
      });
    } catch (error) {
      logger.error("Error during Media Service shutdown", {
        service: "media-service",
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

// Export singleton instance
const mediaServiceInstance = new MediaServiceApp();

module.exports = mediaServiceInstance;

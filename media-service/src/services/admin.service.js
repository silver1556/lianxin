const { MediaFile, MediaVariant, ProcessingJob } = require("../models");
const queueService = require("./queue.service");
const clamavService = require("./clamav.service");
const storageService = require("./alibaba-storage.service");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * Admin Service
 * Handles administrative operations for media service
 */
class AdminService {
  /**
   * Get comprehensive service statistics
   */
  async getServiceStatistics() {
    try {
      // Media file statistics
      const totalFiles = await MediaFile.count({
        where: { is_deleted: false },
      });
      const totalSize =
        (await MediaFile.sum("file_size", { where: { is_deleted: false } })) ||
        0;

      // File type breakdown
      const fileTypeStats = await MediaFile.findAll({
        where: { is_deleted: false },
        attributes: [
          "file_type",
          "media_type",
          [require("sequelize").fn("COUNT", "*"), "count"],
          [
            require("sequelize").fn(
              "SUM",
              require("sequelize").col("file_size")
            ),
            "total_size",
          ],
        ],
        group: ["file_type", "media_type"],
        raw: true,
      });

      // Processing status breakdown
      const processingStats = await MediaFile.findAll({
        where: { is_deleted: false },
        attributes: [
          "processing_status",
          "malware_scan_status",
          [require("sequelize").fn("COUNT", "*"), "count"],
        ],
        group: ["processing_status", "malware_scan_status"],
        raw: true,
      });

      // Recent activity (last 24 hours)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentUploads = await MediaFile.count({
        where: {
          created_at: { [require("sequelize").Op.gte]: last24Hours },
          is_deleted: false,
        },
      });

      // Variant statistics
      const variantStats = await MediaVariant.findAll({
        attributes: [
          "variant_type",
          "format",
          [require("sequelize").fn("COUNT", "*"), "count"],
          [
            require("sequelize").fn(
              "SUM",
              require("sequelize").col("file_size")
            ),
            "total_size",
          ],
        ],
        group: ["variant_type", "format"],
        raw: true,
      });

      // Queue statistics
      const queueStats = await queueService.getQueueStats();

      // Processing job statistics
      const jobStats = await ProcessingJob.getStats("24h");

      return {
        overview: {
          total_files: totalFiles,
          total_size: totalSize,
          formatted_size: this.formatFileSize(totalSize),
          recent_uploads_24h: recentUploads,
        },
        file_types: fileTypeStats.map((item) => ({
          file_type: item.file_type,
          media_type: item.media_type,
          count: parseInt(item.count),
          total_size: parseInt(item.total_size) || 0,
          formatted_size: this.formatFileSize(parseInt(item.total_size) || 0),
        })),
        processing_status: processingStats.map((item) => ({
          processing_status: item.processing_status,
          malware_scan_status: item.malware_scan_status,
          count: parseInt(item.count),
        })),
        variants: variantStats.map((item) => ({
          variant_type: item.variant_type,
          format: item.format,
          count: parseInt(item.count),
          total_size: parseInt(item.total_size) || 0,
          formatted_size: this.formatFileSize(parseInt(item.total_size) || 0),
        })),
        queues: queueStats,
        processing_jobs: jobStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get service statistics", {
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve service statistics",
        500,
        "STATS_ERROR"
      );
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    try {
      // Database health
      const { testConnection } = require("../models");
      const dbHealth = await testConnection();

      // ClamAV health
      const clamavHealth = await clamavService.healthCheck();

      // Queue health
      const queueHealth = queueService.isInitialized;

      // Storage health
      let storageHealth;
      try {
        await storageService.testConnection();
        storageHealth = {
          status: "healthy",
          message: "Storage service operational",
        };
      } catch (error) {
        storageHealth = { status: "unhealthy", message: error.message };
      }

      // System resources
      const systemHealth = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        node_version: process.version,
      };

      const overallStatus =
        dbHealth && queueHealth && storageHealth.status === "healthy"
          ? "healthy"
          : "degraded";

      return {
        overall_status: overallStatus,
        components: {
          database: {
            status: dbHealth ? "healthy" : "unhealthy",
            message: dbHealth
              ? "Database connection active"
              : "Database connection failed",
          },
          clamav: clamavHealth,
          queue: {
            status: queueHealth ? "healthy" : "unhealthy",
            message: queueHealth
              ? "Queue service operational"
              : "Queue service not initialized",
          },
          storage: storageHealth,
        },
        system: systemHealth,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get system health", {
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve system health",
        500,
        "HEALTH_CHECK_ERROR"
      );
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

module.exports = new AdminService();

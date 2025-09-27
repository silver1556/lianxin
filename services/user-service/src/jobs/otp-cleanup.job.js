const cron = require("node-cron");
const { OtpVerification } = require("../models");
const logger = require("../../../../shared/utils/logger.util");

/**
 * OTP Cleanup Job
 * Scheduled task to clean up expired and verified OTP records
 */
class OtpCleanupJob {
  constructor() {
    this.isRunning = false;
    this.schedule = "*/10 * * * *"; // Every 10 minutes
  }

  /**
   * Helper: Check if otp_verifications table exists
   */
  async tableExists() {
    try {
      const tableName = OtpVerification.getTableName();
      const queryInterface = OtpVerification.sequelize.getQueryInterface();
      const tables = await queryInterface.showAllTables();

      // Normalize table names for case-insensitive check
      const normalizedTables = tables.map((t) =>
        typeof t === "string" ? t.toLowerCase() : t.tableName.toLowerCase()
      );

      return normalizedTables.includes(tableName.toLowerCase());
    } catch (err) {
      logger.error("Error checking if table exists", { error: err.message });
      // Fail safe: assume table doesn’t exist to prevent crashes
      return false;
    }
  }

  /**
   * Start the cleanup job
   */
  start() {
    logger.info("Starting OTP cleanup job", {
      schedule: this.schedule,
    });

    // Schedule expired OTP cleanup every 10 minutes
    cron.schedule(this.schedule, async () => {
      if (this.isRunning) {
        logger.warn("OTP cleanup job already running, skipping this execution");
        return;
      }

      try {
        this.isRunning = true;
        await this.cleanupExpiredOtps();
      } catch (error) {
        logger.error("OTP cleanup job failed", {
          error: error.message,
          stack: error.stack,
        });
      } finally {
        this.isRunning = false;
      }
    });

    // Schedule verified OTP cleanup daily at 2 AM
    cron.schedule("0 2 * * *", async () => {
      try {
        await this.cleanupVerifiedOtps();
      } catch (error) {
        logger.error("Verified OTP cleanup job failed", {
          error: error.message,
          stack: error.stack,
        });
      }
    });

    logger.info("OTP cleanup job started successfully");
  }

  /**
   * Clean up expired OTP records
   */
  async cleanupExpiredOtps() {
    if (!(await this.tableExists())) {
      logger.warn(
        "Expired OTP cleanup skipped: otp_verifications table does not exist"
      );
      return 0;
    }

    try {
      const startTime = Date.now();

      const deletedCount = await OtpVerification.cleanupExpired();

      const duration = Date.now() - startTime;

      logger.info("Expired OTP cleanup completed", {
        deletedCount,
        duration,
        timestamp: new Date().toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup expired OTPs", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Clean up verified OTP records older than 90 days
   */
  async cleanupVerifiedOtps() {
    if (!(await this.tableExists())) {
      logger.warn(
        "Verified OTP cleanup skipped: otp_verifications table does not exist"
      );
      return 0;
    }

    try {
      const startTime = Date.now();
      const deletedCount = await OtpVerification.cleanupVerified();
      const duration = Date.now() - startTime;

      logger.info("Verified OTP cleanup completed", {
        deletedCount,
        duration,
        timestamp: new Date().toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup verified OTPs", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const expiredCount = await OtpVerification.count({
        where: {
          expires_at: {
            [require("sequelize").Op.lt]: new Date(),
          },
          is_verified: false,
        },
      });

      const verifiedOldCount = await OtpVerification.count({
        where: {
          verified_at: {
            [require("sequelize").Op.lt]: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000
            ),
            [require("sequelize").Op.not]: null,
          },
        },
      });

      const totalOtpCount = await OtpVerification.count();

      return {
        total_otps: totalOtpCount,
        expired_unverified: expiredCount,
        old_verified: verifiedOldCount,
        cleanup_candidates: expiredCount + verifiedOldCount,
      };
    } catch (error) {
      logger.error("Failed to get cleanup statistics", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Manual cleanup trigger
   */
  async runManualCleanup() {
    try {
      logger.info("Manual OTP cleanup triggered");

      const expiredDeleted = await this.cleanupExpiredOtps();
      const verifiedDeleted = await this.cleanupVerifiedOtps();

      const result = {
        expired_deleted: expiredDeleted,
        verified_deleted: verifiedDeleted,
        total_deleted: expiredDeleted + verifiedDeleted,
        timestamp: new Date().toISOString(),
      };

      logger.info("Manual OTP cleanup completed", result);

      return result;
    } catch (error) {
      logger.error("Manual OTP cleanup failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Stop the cleanup job
   */
  stop() {
    logger.info("Stopping OTP cleanup job");
    // Note: node-cron doesn't provide a direct way to stop specific tasks
    // In a production environment, you might want to use a more sophisticated job scheduler
  }
}

// Create and export singleton instance
const otpCleanupJob = new OtpCleanupJob();

// Auto-start the job when the module is loaded
if (process.env.NODE_ENV !== "test") {
  otpCleanupJob.start();
}

module.exports = otpCleanupJob;

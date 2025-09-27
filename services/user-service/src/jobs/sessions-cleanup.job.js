const cron = require("node-cron");
const { UserSession } = require("../models");
const logger = require("../../../../shared/utils/logger.util");

class SessionCleanupJob {
  constructor() {
    this.isRunning = false;
    this.schedule = "0 4,13 * * *"; // 4:00 AM and 1:00 PM China time daily
  }

  /**
   * Start the cleanup job
   */
  start() {
    logger.info("[Session Cleanup] Job starting", { schedule: this.schedule });

    cron.schedule(
      this.schedule,
      async () => {
        if (this.isRunning) {
          logger.warn(
            "[Session Cleanup] Job already running, skipping execution"
          );
          return;
        }

        try {
          this.isRunning = true;
          await this.cleanupExpiredAndRevoked();
        } catch (error) {
          logger.error("[Session Cleanup] Job failed", {
            error: error.message,
          });
        } finally {
          this.isRunning = false;
        }
      },
      { timezone: "Asia/Shanghai" } // ensures it runs at 4:40 AM China time
    );

    logger.info("[Session Cleanup] Job scheduled successfully");
  }

  /**
   * Perform the actual cleanup
   */
  async cleanupExpiredAndRevoked() {
    logger.info("[Session Cleanup] Running cleanup...");
    const startTime = Date.now();

    try {
      const deleted = await UserSession.cleanupExpiredAndRevoked();

      const duration = Date.now() - startTime;
      logger.info("[Session Cleanup] Completed", {
        deletedCount: deleted,
        duration,
        timestamp: new Date().toISOString(),
      });

      return deleted;
    } catch (error) {
      logger.error("[Session Cleanup] Failed to cleanup sessions", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Trigger manual cleanup if needed
   */
  async runManualCleanup() {
    return await this.cleanupExpiredAndRevoked();
  }
}

// Export singleton instance
const sessionCleanupJob = new SessionCleanupJob();

// Auto-start the job if not in test environment
if (process.env.NODE_ENV !== "test") {
  sessionCleanupJob.start();
}

module.exports = sessionCleanupJob;

const cron = require("node-cron");
const { User, UserSession, UserSettings, AuditLog } = require("../models");
const logger = require("../../../../shared/utils/logger.util");
const { Op } = require("sequelize");

/**
 * Account Deletion Job
 * Scheduled task to process permanent account deletions after grace period
 */
class AccountDeletionJob {
  constructor() {
    this.isRunning = false;
    this.schedule = "0 3 * * *"; // Daily at 3 AM
    this.gracePeriodDays = 15;
  }

  /**
   * Start the account deletion job
   */
  start() {
    logger.info("Starting account deletion job", {
      schedule: this.schedule,
      gracePeriodDays: this.gracePeriodDays,
    });

    // Schedule daily account deletion processing
    cron.schedule(this.schedule, async () => {
      if (this.isRunning) {
        logger.warn(
          "Account deletion job already running, skipping this execution"
        );
        return;
      }

      try {
        this.isRunning = true;
        await this.processAccountDeletions();
      } catch (error) {
        logger.error("Account deletion job failed", {
          error: error.message,
          stack: error.stack,
        });
      } finally {
        this.isRunning = false;
      }
    });

    logger.info("Account deletion job started successfully");
  }

  /**
   * Process accounts scheduled for deletion
   */
  async processAccountDeletions() {
    try {
      const startTime = Date.now();

      // Calculate cutoff date (15 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.gracePeriodDays);

      // Find users scheduled for deletion past grace period
      const usersToDelete = await User.findAll({
        where: {
          status: "pending_deletion",
          pending_deletion_at: {
            [Op.lt]: cutoffDate,
          },
        },
        attributes: ["id", "uuid", "phone", "pending_deletion_at"],
      });

      if (usersToDelete.length === 0) {
        logger.info("No accounts found for deletion", {
          cutoffDate: cutoffDate.toISOString(),
        });
        return { deleted_count: 0 };
      }

      let deletedCount = 0;
      const deletionResults = [];

      for (const user of usersToDelete) {
        try {
          const deletionResult = await this.deleteUserAccount(user);
          deletionResults.push(deletionResult);
          deletedCount++;
        } catch (error) {
          logger.error("Failed to delete individual user account", {
            userId: user.id,
            error: error.message,
          });

          deletionResults.push({
            user_id: user.id,
            success: false,
            error: error.message,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info("Account deletion processing completed", {
        totalCandidates: usersToDelete.length,
        deletedCount,
        failedCount: usersToDelete.length - deletedCount,
        duration,
        cutoffDate: cutoffDate.toISOString(),
        timestamp: new Date().toISOString(),
      });

      return {
        deleted_count: deletedCount,
        failed_count: usersToDelete.length - deletedCount,
        results: deletionResults,
        duration,
      };
    } catch (error) {
      logger.error("Failed to process account deletions", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Delete individual user account
   */
  async deleteUserAccount(user) {
    const transaction = await require("../models").sequelize.transaction();

    try {
      const userId = user.id;
      const userUuid = user.uuid;
      const userPhone = user.phone;

      logger.info("Starting account deletion", {
        userId,
        userUuid,
        pendingDeletionAt: user.pending_deletion_at,
      });

      // Log the deletion action before deleting
      await AuditLog.logAction(
        {
          userId: null, // System action
          action: "account_permanent_deletion",
          resource: "user",
          resourceId: userId.toString(),
          oldValues: {
            user_id: userId,
            uuid: userUuid,
            phone: userPhone,
            pending_deletion_at: user.pending_deletion_at,
          },
          newValues: {
            deleted_at: new Date(),
            deletion_method: "automated_job",
          },
        },
        { transaction }
      );

      // Delete user record (CASCADE will handle related records)
      await User.destroy({
        where: { id: userId },
        transaction,
      });

      await transaction.commit();

      logger.info("Account permanently deleted", {
        userId,
        userUuid,
        deletedAt: new Date().toISOString(),
      });

      return {
        user_id: userId,
        uuid: userUuid,
        success: true,
        deleted_at: new Date().toISOString(),
      };
    } catch (error) {
      await transaction.rollback();

      logger.error("Failed to delete user account", {
        userId: user.id,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Get deletion candidates
   */
  async getDeletionCandidates() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.gracePeriodDays);

      const candidates = await User.findAll({
        where: {
          status: "pending_deletion",
          pending_deletion_at: {
            [Op.lt]: cutoffDate,
          },
        },
        attributes: [
          "id",
          "uuid",
          "phone",
          "pending_deletion_at",
          "created_at",
        ],
      });

      return {
        count: candidates.length,
        cutoff_date: cutoffDate.toISOString(),
        candidates: candidates.map((user) => ({
          user_id: user.id,
          uuid: user.uuid,
          phone: user.phone,
          pending_deletion_at: user.pending_deletion_at,
          days_past_grace_period:
            Math.floor(
              (new Date() - new Date(user.pending_deletion_at)) /
                (1000 * 60 * 60 * 24)
            ) - this.gracePeriodDays,
        })),
      };
    } catch (error) {
      logger.error("Failed to get deletion candidates", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get deletion statistics
   */
  async getDeletionStats() {
    try {
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.gracePeriodDays);

      // Users pending deletion
      const pendingDeletion = await User.count({
        where: {
          status: "pending_deletion",
        },
      });

      // Users ready for deletion
      const readyForDeletion = await User.count({
        where: {
          status: "pending_deletion",
          pending_deletion_at: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      // Users still in grace period
      const inGracePeriod = pendingDeletion - readyForDeletion;

      // Deletions processed today
      const deletionsToday = await AuditLog.count({
        where: {
          action: "account_permanent_deletion",
          created_at: {
            [Op.gte]: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            ),
          },
        },
      });

      return {
        pending_deletion: pendingDeletion,
        ready_for_deletion: readyForDeletion,
        in_grace_period: inGracePeriod,
        deletions_today: deletionsToday,
        grace_period_days: this.gracePeriodDays,
        cutoff_date: cutoffDate.toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get deletion statistics", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Manual deletion trigger for testing
   */
  async runManualDeletion() {
    try {
      logger.info("Manual account deletion triggered");

      const result = await this.processAccountDeletions();

      logger.info("Manual account deletion completed", result);

      return result;
    } catch (error) {
      logger.error("Manual account deletion failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel account deletion (within grace period)
   */
  async cancelAccountDeletion(userId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new Error("User not found");
      }

      if (user.status !== "pending_deletion") {
        throw new Error("User is not scheduled for deletion");
      }

      // Check if still within grace period
      const gracePeriodEnd = new Date(user.pending_deletion_at);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + this.gracePeriodDays);

      if (new Date() > gracePeriodEnd) {
        throw new Error("Grace period has expired");
      }

      // Reactivate account
      await user.update({
        status: "active",
        pending_deletion_at: null,
      });

      // Log cancellation
      await AuditLog.logAction({
        userId: userId,
        action: "account_deletion_cancelled",
        resource: "user",
        resourceId: userId.toString(),
        newValues: {
          cancelled_at: new Date(),
          status: "active",
        },
      });

      logger.info("Account deletion cancelled", {
        userId,
        cancelledAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to cancel account deletion", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Stop the deletion job
   */
  stop() {
    logger.info("Stopping account deletion job");
    // Note: node-cron doesn't provide a direct way to stop specific tasks
  }
}

// Create and export singleton instance
const accountDeletionJob = new AccountDeletionJob();

// Auto-start the job when the module is loaded
if (process.env.NODE_ENV !== "test") {
  accountDeletionJob.start();
}

module.exports = accountDeletionJob;

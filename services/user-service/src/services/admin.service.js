const { User, UserSession, AuditLog } = require("../models");
const encryptionService = require("./encryption.service");
const sessionService = require("./session.service");
const passwordUtil = require("../utils/password.util");
const logger = require("../../../../shared/utils/logger.util");
const { AuthError } = require("../../../../shared/errors/authError");
const { AppError } = require("../../../../shared/errors/appError");
const { Op } = require("sequelize");

/**
 * Admin Service
 * Handles administrative operations for user management
 */
class AdminService {
  /**
   * Get user list with filters
   */
  async getUserList(filters) {
    try {
      const { page, limit, status, search } = filters;
      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = {};

      if (status) {
        whereClause.status = status;
      }

      if (search) {
        whereClause[Op.or] = [
          { display_name: { [Op.like]: `%${search}%` } },
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        attributes: [
          "id",
          "uuid",
          "phone",
          "display_name",
          "first_name",
          "last_name",
          "avatar_url",
          "is_verified",
          "is_private",
          "status",
          "last_login",
          "login_count",
          "created_at",
          "updated_at",
          "suspension_until",
        ],
      });

      // Decrypt and sanitize user data
      const sanitizedUsers = [];
      for (const user of users) {
        const decryptedUser = await encryptionService.decryptUserData(
          user.toJSON()
        );
        sanitizedUsers.push(this.sanitizeAdminUserData(decryptedUser));
      }

      return {
        users: sanitizedUsers,
        total_count: count,
        page,
        limit,
        total_pages: Math.ceil(count / limit),
      };
    } catch (error) {
      logger.error("Failed to get user list", {
        filters,
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve user list",
        500,
        "USER_LIST_ERROR"
      );
    }
  }

  /**
   * Get detailed user information
   */
  async getUserDetails(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: UserSession,
            as: "sessions",
            where: { is_active: true },
            required: false,
          },
        ],
      });

      if (!user) {
        throw AppError.notFound("User not found");
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(
        user.toJSON()
      );

      // Get additional statistics
      const stats = await this.getUserStatisticsForUser(userId);

      return {
        ...this.sanitizeAdminUserData(decryptedUser),
        sessions: user.sessions
          ? user.sessions.map((session) => session.toSafeObject())
          : [],
        statistics: stats,
      };
    } catch (error) {
      logger.error("Failed to get user details", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Suspend user account
   */
  async suspendUser(userId, suspensionData) {
    try {
      const { reason, duration, admin_note, suspended_by } = suspensionData;

      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound("User not found");
      }

      if (user.status === "suspended") {
        throw AppError.conflict("User is already suspended");
      }

      // Calculate suspension end date
      const suspensionUntil = new Date();
      suspensionUntil.setDate(suspensionUntil.getDate() + duration);

      // Update user status
      await user.update({
        status: "suspended",
        suspension_reason: reason,
        suspension_until: suspensionUntil,
      });

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(userId);

      // Log admin action
      await AuditLog.logAction({
        userId: suspended_by,
        action: "user_suspension",
        resource: "user",
        resourceId: userId.toString(),
        newValues: {
          reason,
          duration,
          admin_note,
          suspension_until: suspensionUntil,
        },
      });

      logger.info("User suspended by admin", {
        userId,
        suspendedBy: suspended_by,
        reason,
        duration,
        suspensionUntil,
      });

      return {
        message: "User suspended successfully",
        suspension_until: suspensionUntil.toISOString(),
      };
    } catch (error) {
      logger.error("Failed to suspend user", {
        userId,
        suspensionData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Unsuspend user account
   */
  async unsuspendUser(userId, unsuspensionData) {
    try {
      const { admin_note, unsuspended_by } = unsuspensionData;

      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound("User not found");
      }

      if (user.status !== "suspended") {
        throw AppError.badRequest("User is not suspended");
      }

      // Update user status
      await user.update({
        status: "active",
        suspension_reason: null,
        suspension_until: null,
      });

      // Log admin action
      await AuditLog.logAction({
        userId: unsuspended_by,
        action: "user_unsuspension",
        resource: "user",
        resourceId: userId.toString(),
        newValues: {
          admin_note,
          unsuspended_at: new Date(),
        },
      });

      logger.info("User unsuspended by admin", {
        userId,
        unsuspendedBy: unsuspended_by,
        adminNote: admin_note,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to unsuspend user", {
        userId,
        unsuspensionData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify user account
   */
  async verifyUser(userId, verificationData) {
    try {
      const { verification_type, verification_data, admin_note, verified_by } =
        verificationData;

      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound("User not found");
      }

      if (user.is_verified) {
        throw AppError.conflict("User is already verified");
      }

      // Encrypt verification data
      const encryptedVerificationData =
        await encryptionService.encryptVerificationData({
          type: verification_type,
          data: verification_data,
          verified_by,
          verified_at: new Date(),
          admin_note,
        });

      // Update user verification status
      await user.update({
        is_verified: true,
        verification_data: encryptedVerificationData,
      });

      // Log admin action
      await AuditLog.logAction({
        userId: verified_by,
        action: "user_verification",
        resource: "user",
        resourceId: userId.toString(),
        newValues: {
          verification_type,
          admin_note,
          verified_at: new Date(),
        },
      });

      logger.info("User verified by admin", {
        userId,
        verifiedBy: verified_by,
        verificationType: verification_type,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to verify user", {
        userId,
        verificationData,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    try {
      const stats = await User.findAll({
        attributes: [
          "status",
          [require("sequelize").fn("COUNT", "*"), "count"],
        ],
        group: ["status"],
        raw: true,
      });

      // Get additional statistics
      const totalUsers = await User.count();
      const verifiedUsers = await User.count({ where: { is_verified: true } });
      const activeToday = await User.count({
        where: {
          last_login: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      const newUsersToday = await User.count({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      return {
        total_users: totalUsers,
        verified_users: verifiedUsers,
        active_today: activeToday,
        new_users_today: newUsersToday,
        status_breakdown: stats.reduce((acc, stat) => {
          acc[stat.status] = parseInt(stat.count);
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error("Failed to get user statistics", {
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve user statistics",
        500,
        "USER_STATS_ERROR"
      );
    }
  }

  /**
   * Search users with advanced filters
   */
  async searchUsers(searchParams) {
    try {
      const { q, type, limit, offset } = searchParams;

      let whereClause = {};

      switch (type) {
        case "phone":
          whereClause.phone = { [Op.like]: `%${q}%` };
          break;
        case "id":
          whereClause.id = parseInt(q) || 0;
          break;
        case "name":
        default:
          whereClause[Op.or] = [
            { display_name: { [Op.like]: `%${q}%` } },
            { first_name: { [Op.like]: `%${q}%` } },
            { last_name: { [Op.like]: `%${q}%` } },
          ];
          break;
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        attributes: [
          "id",
          "uuid",
          "phone",
          "display_name",
          "first_name",
          "last_name",
          "avatar_url",
          "is_verified",
          "status",
          "created_at",
        ],
      });

      // Decrypt and sanitize user data
      const sanitizedUsers = [];
      for (const user of users) {
        const decryptedUser = await encryptionService.decryptUserData(
          user.toJSON()
        );
        sanitizedUsers.push(this.sanitizeAdminUserData(decryptedUser));
      }

      return {
        users: sanitizedUsers,
        total_count: count,
        limit,
        offset,
      };
    } catch (error) {
      logger.error("Failed to search users", {
        searchParams,
        error: error.message,
      });
      throw new AppError("Failed to search users", 500, "USER_SEARCH_ERROR");
    }
  }

  /**
   * Get statistics for a specific user
   */
  async getUserStatisticsForUser(userId) {
    try {
      // Get session statistics
      const sessionStats = await sessionService.getSessionStats(userId);

      // Get audit log count
      const auditLogCount = await AuditLog.count({
        where: { user_id: userId },
      });

      return {
        sessions: sessionStats,
        audit_logs: auditLogCount,
        // Additional stats would come from other services
        posts: 0,
        friends: 0,
        followers: 0,
      };
    } catch (error) {
      logger.error("Failed to get user statistics", {
        userId,
        error: error.message,
      });
      return {
        sessions: {},
        audit_logs: 0,
        posts: 0,
        friends: 0,
        followers: 0,
      };
    }
  }

  /**
   * Sanitize user data for admin view
   */
  sanitizeAdminUserData(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    // Keep more fields for admin view compared to public view
    return sanitized;
  }
}

module.exports = new AdminService();

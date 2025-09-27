const { AuditLog, User } = require("../models");
const encryptionService = require("./encryption.service");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");
const { Op } = require("sequelize");
const crypto = require("crypto");

/**
 * Compliance Service
 * Handles audit logs, compliance reporting, and data export
 */
class ComplianceService {
  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters) {
    try {
      const { page, limit, user_id, action, resource, start_date, end_date } =
        filters;
      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = {};

      if (user_id) {
        whereClause.user_id = user_id;
      }

      if (action) {
        whereClause.action = { [Op.like]: `%${action}%` };
      }

      if (resource) {
        whereClause.resource = resource;
      }

      if (start_date || end_date) {
        whereClause.created_at = {};
        if (start_date) {
          whereClause.created_at[Op.gte] = new Date(start_date);
        }
        if (end_date) {
          whereClause.created_at[Op.lte] = new Date(end_date);
        }
      }

      const { count, rows: logs } = await AuditLog.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "display_name", "phone"],
            required: false,
          },
        ],
      });

      // Sanitize audit logs for admin view
      const sanitizedLogs = logs.map((log) =>
        this.sanitizeAuditLog(log.toJSON())
      );

      return {
        logs: sanitizedLogs,
        total_count: count,
        page,
        limit,
        total_pages: Math.ceil(count / limit),
      };
    } catch (error) {
      logger.error("Failed to get audit logs", {
        filters,
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve audit logs",
        500,
        "AUDIT_LOGS_ERROR"
      );
    }
  }

  /**
   * Get user audit trail
   */
  async getUserAuditTrail(userId, filters) {
    try {
      const { page, limit, action } = filters;
      const offset = (page - 1) * limit;

      const whereClause = { user_id: userId };

      if (action) {
        whereClause.action = { [Op.like]: `%${action}%` };
      }

      const { count, rows: logs } = await AuditLog.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["created_at", "DESC"]],
      });

      const sanitizedLogs = logs.map((log) =>
        this.sanitizeAuditLog(log.toJSON())
      );

      return {
        logs: sanitizedLogs,
        total_count: count,
        page,
        limit,
        user_id: userId,
      };
    } catch (error) {
      logger.error("Failed to get user audit trail", {
        userId,
        filters,
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve user audit trail",
        500,
        "USER_AUDIT_ERROR"
      );
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(reportParams) {
    try {
      const { report_type, start_date, end_date, format, generated_by } =
        reportParams;

      const reportId = crypto.randomUUID();
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);

      let reportData = {};

      switch (report_type) {
        case "pipl":
          reportData = await this.generatePIPLReport(startDate, endDate);
          break;
        case "cybersecurity_law":
          reportData = await this.generateCybersecurityReport(
            startDate,
            endDate
          );
          break;
        case "data_security":
          reportData = await this.generateDataSecurityReport(
            startDate,
            endDate
          );
          break;
        case "full":
          reportData = await this.generateFullComplianceReport(
            startDate,
            endDate
          );
          break;
        default:
          throw new AppError("Invalid report type", 400, "INVALID_REPORT_TYPE");
      }

      // Log report generation
      await AuditLog.logAction({
        userId: generated_by,
        action: "compliance_report_generation",
        resource: "compliance_report",
        resourceId: reportId,
        newValues: {
          report_type,
          start_date,
          end_date,
          format,
        },
      });

      logger.info("Compliance report generated", {
        reportId,
        reportType: report_type,
        generatedBy: generated_by,
        startDate,
        endDate,
      });

      return {
        report_id: reportId,
        report_type,
        data: reportData,
        generated_at: new Date().toISOString(),
        generated_by,
        format,
      };
    } catch (error) {
      logger.error("Failed to generate compliance report", {
        reportParams,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Export user data for compliance
   */
  async exportUserData(userId, exportParams) {
    try {
      const { format, include_deleted, requested_by } = exportParams;

      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound("User not found");
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(
        user.toJSON()
      );

      // Get user audit trail
      const auditLogs = await AuditLog.findAll({
        where: { user_id: userId },
        order: [["created_at", "DESC"]],
      });

      // Get user sessions
      const sessions = await user.getSessions();

      const exportId = crypto.randomUUID();
      const exportData = {
        user_profile: this.sanitizeUserDataForExport(decryptedUser),
        audit_trail: auditLogs.map((log) =>
          this.sanitizeAuditLog(log.toJSON())
        ),
        sessions: sessions.map((session) => session.toSafeObject()),
        export_metadata: {
          export_id: exportId,
          exported_at: new Date().toISOString(),
          requested_by,
          include_deleted,
          format,
        },
      };

      // Log data export
      await AuditLog.logAction({
        userId: requested_by,
        action: "user_data_export",
        resource: "user_data",
        resourceId: userId.toString(),
        newValues: {
          export_id: exportId,
          format,
          include_deleted,
        },
      });

      logger.info("User data exported", {
        exportId,
        userId,
        requestedBy: requested_by,
        format,
      });

      return {
        export_id: exportId,
        data: exportData,
        format,
        exported_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to export user data", {
        userId,
        exportParams,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get compliance statistics
   */
  async getComplianceStatistics(period) {
    try {
      const periodMap = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };

      const periodMs = periodMap[period] || periodMap["24h"];
      const since = new Date(Date.now() - periodMs);

      // Get audit log statistics
      const auditStats = await AuditLog.findAll({
        where: {
          created_at: { [Op.gte]: since },
        },
        attributes: [
          "action",
          [require("sequelize").fn("COUNT", "*"), "count"],
        ],
        group: ["action"],
        raw: true,
      });

      // Get user registration statistics
      const newUsers = await User.count({
        where: {
          created_at: { [Op.gte]: since },
        },
      });

      // Get verification statistics
      const verifiedUsers = await User.count({
        where: {
          is_verified: true,
          updated_at: { [Op.gte]: since },
        },
      });

      return {
        period,
        audit_events: auditStats.reduce((acc, stat) => {
          acc[stat.action] = parseInt(stat.count);
          return acc;
        }, {}),
        new_users: newUsers,
        verified_users: verifiedUsers,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get compliance statistics", {
        period,
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve compliance statistics",
        500,
        "COMPLIANCE_STATS_ERROR"
      );
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(filters) {
    try {
      const { page, limit, severity, event_type } = filters;
      const offset = (page - 1) * limit;

      // Build where clause for security-related audit logs
      const whereClause = {
        action: {
          [Op.in]: [
            "login_failed",
            "account_lockout",
            "suspicious_activity",
            "password_change",
            "session_revoked",
            "admin_action",
          ],
        },
      };

      if (event_type) {
        whereClause.action = { [Op.like]: `%${event_type}%` };
      }

      const { count, rows: events } = await AuditLog.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "display_name", "phone"],
            required: false,
          },
        ],
      });

      const sanitizedEvents = events.map((event) => ({
        ...this.sanitizeAuditLog(event.toJSON()),
        severity: this.calculateEventSeverity(event.action),
        event_type: event.action,
      }));

      return {
        events: sanitizedEvents,
        total_count: count,
        page,
        limit,
      };
    } catch (error) {
      logger.error("Failed to get security events", {
        filters,
        error: error.message,
      });
      throw new AppError(
        "Failed to retrieve security events",
        500,
        "SECURITY_EVENTS_ERROR"
      );
    }
  }

  /**
   * Generate PIPL compliance report
   */
  async generatePIPLReport(startDate, endDate) {
    try {
      // Data processing activities
      const dataProcessingActivities = await AuditLog.count({
        where: {
          created_at: { [Op.between]: [startDate, endDate] },
          action: {
            [Op.in]: ["profile_update", "data_export", "account_deletion"],
          },
        },
      });

      // User consent tracking
      const newRegistrations = await User.count({
        where: {
          created_at: { [Op.between]: [startDate, endDate] },
        },
      });

      // Data deletion requests
      const deletionRequests = await AuditLog.count({
        where: {
          created_at: { [Op.between]: [startDate, endDate] },
          action: "account_deletion_request",
        },
      });

      return {
        report_type: "PIPL Compliance Report",
        period: { start_date: startDate, end_date: endDate },
        data_processing_activities: dataProcessingActivities,
        new_user_registrations: newRegistrations,
        deletion_requests: deletionRequests,
        compliance_status: "COMPLIANT",
      };
    } catch (error) {
      logger.error("Failed to generate PIPL report", { error: error.message });
      throw error;
    }
  }

  /**
   * Generate Cybersecurity Law compliance report
   */
  async generateCybersecurityReport(startDate, endDate) {
    try {
      // Security incidents
      const securityIncidents = await AuditLog.count({
        where: {
          created_at: { [Op.between]: [startDate, endDate] },
          action: {
            [Op.in]: ["login_failed", "account_lockout", "suspicious_activity"],
          },
        },
      });

      // Data breach incidents (would be tracked separately)
      const dataBreaches = 0; // Placeholder

      return {
        report_type: "Cybersecurity Law Compliance Report",
        period: { start_date: startDate, end_date: endDate },
        security_incidents: securityIncidents,
        data_breaches: dataBreaches,
        compliance_status: "COMPLIANT",
      };
    } catch (error) {
      logger.error("Failed to generate Cybersecurity report", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate Data Security Law compliance report
   */
  async generateDataSecurityReport(startDate, endDate) {
    try {
      // Data classification activities
      const dataClassificationActivities = await AuditLog.count({
        where: {
          created_at: { [Op.between]: [startDate, endDate] },
          resource: "user_data",
        },
      });

      return {
        report_type: "Data Security Law Compliance Report",
        period: { start_date: startDate, end_date: endDate },
        data_classification_activities: dataClassificationActivities,
        compliance_status: "COMPLIANT",
      };
    } catch (error) {
      logger.error("Failed to generate Data Security report", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate full compliance report
   */
  async generateFullComplianceReport(startDate, endDate) {
    try {
      const piplReport = await this.generatePIPLReport(startDate, endDate);
      const cybersecurityReport = await this.generateCybersecurityReport(
        startDate,
        endDate
      );
      const dataSecurityReport = await this.generateDataSecurityReport(
        startDate,
        endDate
      );

      return {
        report_type: "Full Compliance Report",
        period: { start_date: startDate, end_date: endDate },
        pipl_compliance: piplReport,
        cybersecurity_compliance: cybersecurityReport,
        data_security_compliance: dataSecurityReport,
        overall_compliance_status: "COMPLIANT",
      };
    } catch (error) {
      logger.error("Failed to generate full compliance report", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Sanitize audit log for admin view
   */
  sanitizeAuditLog(log) {
    const sanitized = { ...log };

    // Remove sensitive data from old_values and new_values
    if (sanitized.old_values) {
      delete sanitized.old_values.password;
      delete sanitized.old_values.password_hash;
      delete sanitized.old_values.otp_code;
    }

    if (sanitized.new_values) {
      delete sanitized.new_values.password;
      delete sanitized.new_values.password_hash;
      delete sanitized.new_values.otp_code;
    }

    return sanitized;
  }

  /**
   * Sanitize user data for export
   */
  sanitizeUserDataForExport(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    delete sanitized.verification_data;
    return sanitized;
  }

  /**
   * Calculate event severity
   */
  calculateEventSeverity(action) {
    const severityMap = {
      login_failed: "low",
      account_lockout: "medium",
      suspicious_activity: "high",
      data_breach: "critical",
      admin_action: "medium",
      password_change: "low",
      session_revoked: "medium",
    };

    return severityMap[action] || "low";
  }
}

module.exports = new ComplianceService();

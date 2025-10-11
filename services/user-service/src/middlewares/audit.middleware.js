const { AuditLog } = require("../models");
const logger = require("../../../../shared/utils/logger.util");

/**
 * Audit Middleware
 * Handles activity logging for compliance and security monitoring
 */
class AuditMiddleware {
  /**
   * Log all user activities
   */
  async logActivity(req, res, next) {
    try {
      // Store original json method
      const originalJson = res.json;
      const startTime = Date.now();

      // Override json method to log after response
      res.json = async function (data) {
        try {
          const duration = Date.now() - startTime;

          // Log the activity
          await auditMiddleware.createAuditLog({
            req,
            res,
            data,
            duration,
          });

          // Call original json method
          return originalJson.call(this, data);
        } catch (auditError) {
          logger.error("Audit logging failed", {
            error: auditError.message,
            requestId: req.requestId,
          });

          // Continue with response even if audit fails
          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      logger.error("Audit middleware setup failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(req, res, next) {
    try {
      const originalJson = res.json;

      res.json = async function (data) {
        try {
          const action = auditMiddleware.getAuthAction(req.path, req.method);

          if (action) {
            await auditMiddleware.createAuthAuditLog({
              req,
              res,
              action,
              data,
              success: data.success,
            });
          }

          return originalJson.call(this, data);
        } catch (auditError) {
          logger.error("Auth audit logging failed", {
            error: auditError.message,
            requestId: req.requestId,
          });

          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      logger.error("Auth audit middleware setup failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Log profile changes
   */
  async logProfileChange(req, res, next) {
    try {
      // Store original data for comparison
      if (req.user && req.user.userId && req.method === "PUT") {
        req.auditData = {
          oldValues: await this.getCurrentUserData(req.user.userId),
          newValues: req.body,
        };
      }

      const originalJson = res.json;

      res.json = async function (data) {
        try {
          if (req.auditData && data.success) {
            await auditMiddleware.createProfileAuditLog({
              req,
              res,
              oldValues: req.auditData.oldValues,
              newValues: req.auditData.newValues,
            });
          }

          return originalJson.call(this, data);
        } catch (auditError) {
          logger.error("Profile audit logging failed", {
            error: auditError.message,
            requestId: req.requestId,
          });

          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      logger.error("Profile audit middleware setup failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(eventType) {
    return async (req, res, next) => {
      try {
        const originalJson = res.json;

        res.json = async function (data) {
          try {
            await auditMiddleware.createSecurityAuditLog({
              req,
              res,
              eventType,
              data,
              success: data.success,
            });

            return originalJson.call(this, data);
          } catch (auditError) {
            logger.error("Security audit logging failed", {
              error: auditError.message,
              eventType,
              requestId: req.requestId,
            });

            return originalJson.call(this, data);
          }
        };

        next();
      } catch (error) {
        logger.error("Security audit middleware setup failed", {
          error: error.message,
          eventType,
          requestId: req.requestId,
        });

        next(error);
      }
    };
  }

  /**
   * Log admin actions
   */
  async logAdminAction(req, res, next) {
    try {
      const originalJson = res.json;

      res.json = async function (data) {
        try {
          if (req.user && req.user.roles && req.user.roles.includes("admin")) {
            await auditMiddleware.createAdminAuditLog({
              req,
              res,
              data,
              success: data.success,
            });
          }

          return originalJson.call(this, data);
        } catch (auditError) {
          logger.error("Admin audit logging failed", {
            error: auditError.message,
            requestId: req.requestId,
          });

          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      logger.error("Admin audit middleware setup failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Create general audit log
   */
  async createAuditLog({ req, res, data, duration }) {
    try {
      // Skip logging for health checks and non-important endpoints
      if (this.shouldSkipLogging(req.path, req.method)) {
        return;
      }

      const auditData = {
        userId: req.user?.userId || null,
        action: this.getActionFromRequest(req),
        resource: this.getResourceFromPath(req.path),
        resourceId: this.getResourceId(req),
        oldValues: req.auditData?.oldValues || null,
        newValues: this.sanitizeRequestData(req.body),
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.user?.sessionId || null,
      };

      await AuditLog.logAction(auditData);

      logger.debug("Audit log created", {
        action: auditData.action,
        resource: auditData.resource,
        userId: auditData.userId,
        duration,
        requestId: req.requestId,
      });
    } catch (error) {
      logger.error("Failed to create audit log", {
        error: error.message,
        requestId: req.requestId,
      });
    }
  }

  /**
   * Create authentication audit log
   */
  async createAuthAuditLog({ req, res, action, data, success }) {
    try {
      const auditData = {
        userId: data.data?.user?.id || null,
        action: action,
        resource: "authentication",
        resourceId: null,
        oldValues: null,
        newValues: {
          phone: req.body.phone,
          loginMethod: req.body.password ? "password" : "otp",
          success: success,
          deviceInfo: {
            device_id: req.body.device_id,
            device_type: req.body.device_type,
            device_name: req.body.device_name,
          },
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: data.data?.session?.id || null,
      };

      await AuditLog.logAction(auditData);

      logger.info("Authentication audit log created", {
        action,
        success,
        phone: req.body.phone,
        requestId: req.requestId,
      });
    } catch (error) {
      logger.error("Failed to create auth audit log", {
        error: error.message,
        action,
        requestId: req.requestId,
      });
    }
  }

  /**
   * Create profile change audit log
   */
  async createProfileAuditLog({ req, res, oldValues, newValues }) {
    try {
      const auditData = {
        userId: req.user.userId,
        action: "profile_update",
        resource: "user_profile",
        resourceId: req.user.userId.toString(),
        oldValues: this.sanitizeUserData(oldValues),
        newValues: this.sanitizeRequestData(newValues),
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.user.sessionId,
      };

      await AuditLog.logAction(auditData);

      logger.info("Profile change audit log created", {
        userId: req.user.userId,
        changedFields: Object.keys(newValues),
        requestId: req.requestId,
      });
    } catch (error) {
      logger.error("Failed to create profile audit log", {
        error: error.message,
        userId: req.user?.userId,
        requestId: req.requestId,
      });
    }
  }

  /**
   * Create security audit log
   */
  async createSecurityAuditLog({ req, res, eventType, data, success }) {
    try {
      const auditData = {
        userId: req.user?.userId || null,
        action: eventType,
        resource: "security",
        resourceId: null,
        oldValues: null,
        newValues: {
          eventType,
          success,
          details: this.getSecurityEventDetails(req, eventType),
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.user?.sessionId || null,
      };

      await AuditLog.logAction(auditData);

      logger.info("Security audit log created", {
        eventType,
        success,
        userId: req.user?.userId,
        requestId: req.requestId,
      });
    } catch (error) {
      logger.error("Failed to create security audit log", {
        error: error.message,
        eventType,
        requestId: req.requestId,
      });
    }
  }

  /**
   * Create admin action audit log
   */
  async createAdminAuditLog({ req, res, data, success }) {
    try {
      const auditData = {
        userId: req.user.userId,
        action: `admin_${this.getActionFromRequest(req)}`,
        resource: this.getResourceFromPath(req.path),
        resourceId: this.getResourceId(req),
        oldValues: req.auditData?.oldValues || null,
        newValues: this.sanitizeRequestData(req.body),
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        sessionId: req.user.sessionId,
      };

      await AuditLog.logAction(auditData);

      logger.info("Admin action audit log created", {
        action: auditData.action,
        resource: auditData.resource,
        adminUserId: req.user.userId,
        requestId: req.requestId,
      });
    } catch (error) {
      logger.error("Failed to create admin audit log", {
        error: error.message,
        adminUserId: req.user?.userId,
        requestId: req.requestId,
      });
    }
  }

  /**
   * Helper methods
   */
  shouldSkipLogging(path, method) {
    const skipPaths = ["/health", "/metrics"];
    const skipMethods = ["OPTIONS"];

    return skipPaths.includes(path) || skipMethods.includes(method);
  }

  getActionFromRequest(req) {
    const method = req.method.toLowerCase();
    const path = req.path;

    if (path.includes("/login")) return "login";
    if (path.includes("/register")) return "register";
    if (path.includes("/logout")) return "logout";
    if (path.includes("/profile")) return `profile_${method}`;
    if (path.includes("/settings")) return `settings_${method}`;
    if (path.includes("/password")) return "password_change";
    if (path.includes("/avatar")) return "avatar_upload";
    if (path.includes("/sessions")) return `session_${method}`;

    return `${method}_${this.getResourceFromPath(path)}`;
  }

  getResourceFromPath(path) {
    if (path.includes("/auth")) return "authentication";
    if (path.includes("/profile")) return "user_profile";
    if (path.includes("/settings")) return "user_settings";
    if (path.includes("/sessions")) return "user_session";
    if (path.includes("/user")) return "user";
    if (path.includes("/admin")) return "admin";

    return "unknown";
  }

  getResourceId(req) {
    // Extract resource ID from URL parameters
    if (req.params.userId) return req.params.userId;
    if (req.params.sessionId) return req.params.sessionId;
    if (req.user?.userId) return req.user.userId.toString();

    return null;
  }

  getAuthAction(path, method) {
    if (path.includes("/register") && method === "POST")
      return "user_registration";
    if (path.includes("/login") && method === "POST") return "user_login";
    if (path.includes("/logout") && method === "POST") return "user_logout";
    if (path.includes("/refresh") && method === "POST") return "token_refresh";
    if (path.includes("/reset-password") && method === "POST")
      return "password_reset";

    return null;
  }

  getSecurityEventDetails(req, eventType) {
    const details = {
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    };

    switch (eventType) {
      case "failed_login":
        details.phone = req.body.phone;
        break;
      case "account_lockout":
        details.phone = req.body.phone;
        break;
      case "suspicious_activity":
        details.reason = "Multiple failed attempts";
        break;
      default:
        break;
    }

    return details;
  }

  async getCurrentUserData(userId) {
    try {
      const { User } = require("../models");
      const user = await User.findByPk(userId);
      return user ? this.sanitizeUserData(user.toJSON()) : null;
    } catch (error) {
      logger.error("Failed to get current user data for audit", {
        userId,
        error: error.message,
      });
      return null;
    }
  }

  sanitizeUserData(userData) {
    if (!userData) return null;

    const sanitized = { ...userData };
    delete sanitized.password_hash;
    delete sanitized.verification_data;
    delete sanitized.failed_login_attempts;
    delete sanitized.last_failed_login;

    return sanitized;
  }

  sanitizeRequestData(requestData) {
    if (!requestData) return null;

    const sanitized = { ...requestData };
    delete sanitized.password;
    delete sanitized.new_password;
    delete sanitized.current_password;
    delete sanitized.confirm_password;
    delete sanitized.otp_code;

    return sanitized;
  }
}

const auditMiddleware = new AuditMiddleware();
module.exports = auditMiddleware;

const axios = require("axios");
const config = require("../config/app.config");
const logger = require("../utils/logger.util");
const { AppError } = require("../../shared/errors/appError");

/**
 * Authentication Middleware
 * Validates JWT tokens with the user service
 */
class AuthMiddleware {
  /**
   * Authenticate user with user service
   */
  async authenticate(req, res, next) {
    try {
      // Extract token from Authorization header
      const authHeader = req.get("Authorization");
      if (!authHeader) {
        throw AppError.unauthorized("Authorization header is required");
      }

      // Verify token with user service
      const response = await axios.get(
        `${config.userServiceUrl}/api/v1/auth/verify-token`,
        {
          headers: {
            Authorization: authHeader,
          },
          timeout: 5000,
        }
      );

      if (!response.data.success) {
        throw AppError.unauthorized("Invalid authentication token");
      }

      // Attach user information to request
      req.user = response.data.user;

      logger.debug("User authenticated successfully", {
        userId: req.user.userId,
        requestId: req.requestId,
      });

      next();
    } catch (error) {
      logger.warn("Authentication failed", {
        error: error.message,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        requestId: req.requestId,
      });

      if (error.response?.status === 401) {
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTHENTICATION_FAILED",
            message: "Authentication failed",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      }

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({
        success: false,
        error: {
          code: "AUTHENTICATION_ERROR",
          message: "Authentication service error",
        },
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
      });
    }
  }

  /**
   * Require admin role
   */
  async requireAdmin(req, res, next) {
    try {
      if (!req.user) {
        throw AppError.unauthorized("Authentication required");
      }

      const userRoles = req.user.roles || [];
      const adminRoles = ["admin", "super_admin"];

      const hasAdminRole = userRoles.some((role) => adminRoles.includes(role));

      if (!hasAdminRole) {
        throw AppError.forbidden("Admin access required");
      }

      logger.debug("Admin access granted", {
        userId: req.user.userId,
        roles: userRoles,
        requestId: req.requestId,
      });

      next();
    } catch (error) {
      logger.warn("Admin access denied", {
        userId: req.user?.userId,
        roles: req.user?.roles,
        error: error.message,
        requestId: req.requestId,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Admin access required",
        },
        timestamp: new Date().toISOString(),
        request_id: req.requestId,
      });
    }
  }

  /**
   * Optional authentication (doesn't fail if no token)
   */
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.get("Authorization");

      if (authHeader) {
        try {
          const response = await axios.get(
            `${config.userServiceUrl}/api/v1/auth/verify-token`,
            {
              headers: {
                Authorization: authHeader,
              },
              timeout: 5000,
            }
          );

          if (response.data.success) {
            req.user = response.data.user;
            logger.debug("Optional authentication succeeded", {
              userId: req.user.userId,
              requestId: req.requestId,
            });
          }
        } catch (authError) {
          logger.debug("Optional authentication failed", {
            error: authError.message,
            requestId: req.requestId,
          });
        }
      }

      next();
    } catch (error) {
      // For optional auth, we don't fail on authentication errors
      logger.debug("Optional authentication error", {
        error: error.message,
        requestId: req.requestId,
      });

      next();
    }
  }
}

module.exports = new AuthMiddleware();

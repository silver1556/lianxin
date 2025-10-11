const jwtUtil = require("../utils/jwt.util");
const sessionService = require("../services/session.service");
const logger = require("../../../../shared/utils/logger.util");
const { AuthError } = require("../../../../shared/errors/authError");

/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */
class AuthMiddleware {
  /**
   * Authenticate user with JWT token
   */
  async authenticate(req, res, next) {
    try {
      // Extract token from Authorization header
      const authHeader = req.get("Authorization");
      if (!authHeader) {
        throw AuthError.missingToken("Authorization header is required");
      }

      const token = jwtUtil.extractToken(authHeader);

      // Verify JWT token
      const payload = jwtUtil.verifyAccessToken(token);

      // Verify session exists and is valid
      const session = await sessionService.getSession(payload.sessionId);

      if (!session || !session.isValid()) {
        throw AuthError.sessionExpired("Session has expired or is invalid");
      }

      // Update session activity
      await sessionService.updateSessionActivity(
        payload.sessionId,
        req.ip,
        req.get("User-Agent")
      );

      // Attach user information to request
      req.user = {
        userId: payload.userId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        roles: payload.roles || ["user"],
        permissions: payload.permissions || [],
      };

      logger.debug("User authenticated successfully", {
        userId: payload.userId,
        sessionId: payload.sessionId,
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

      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.errorCode,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      }

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
  }

  /**
   * Require admin role
   */
  async requireAdmin(req, res, next) {
    try {
      if (!req.user) {
        throw AuthError.unauthorized("Authentication required");
      }

      const userRoles = req.user.roles || [];
      const adminRoles = ["admin", "super_admin"];

      const hasAdminRole = userRoles.some((role) => adminRoles.includes(role));

      if (!hasAdminRole) {
        throw AuthError.insufficientPermissions("Admin access required");
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
        const token = jwtUtil.extractToken(authHeader);
        const payload = jwtUtil.verifyAccessToken(token);

        // Verify session
        const session = await sessionService.getSession(payload.sessionId);

        if (session && session.isValid()) {
          req.user = {
            userId: payload.userId,
            sessionId: payload.sessionId,
            deviceId: payload.deviceId,
            roles: payload.roles || ["user"],
            permissions: payload.permissions || [],
          };

          logger.debug("Optional authentication succeeded", {
            userId: payload.userId,
            sessionId: payload.sessionId,
            requestId: req.requestId,
          });

          // Update session activity
          await sessionService.updateSessionActivity(
            payload.sessionId,
            req.ip,
            req.get("User-Agent")
          );
        }
      }

      next();
    } catch (error) {
      // For optional auth, we don't fail on authentication errors
      logger.debug("Optional authentication failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next();
    }
  }

  /**
   * Require specific permission
   */
  requirePermission(permission) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          throw AuthError.unauthorized("Authentication required");
        }

        const userPermissions = req.user.permissions || [];

        if (!userPermissions.includes(permission)) {
          throw AuthError.insufficientPermissions(
            `Permission '${permission}' required`
          );
        }

        logger.debug("Permission check passed", {
          userId: req.user.userId,
          permission,
          requestId: req.requestId,
        });

        next();
      } catch (error) {
        logger.warn("Permission check failed", {
          userId: req.user?.userId,
          permission,
          error: error.message,
          requestId: req.requestId,
        });

        return res.status(403).json({
          success: false,
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: `Permission '${permission}' required`,
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      }
    };
  }

  /**
   * Check if user owns resource
   */
  requireOwnership(getUserIdFromParams) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          throw AuthError.unauthorized("Authentication required");
        }

        const resourceUserId = getUserIdFromParams(req);

        if (req.user.userId !== resourceUserId) {
          // Check if user has admin privileges
          const userRoles = req.user.roles || [];
          const adminRoles = ["admin", "super_admin"];
          const hasAdminRole = userRoles.some((role) =>
            adminRoles.includes(role)
          );

          if (!hasAdminRole) {
            throw AuthError.forbidden(
              "Access denied: You can only access your own resources"
            );
          }
        }

        logger.debug("Ownership check passed", {
          userId: req.user.userId,
          resourceUserId,
          requestId: req.requestId,
        });

        next();
      } catch (error) {
        logger.warn("Ownership check failed", {
          userId: req.user?.userId,
          error: error.message,
          requestId: req.requestId,
        });

        return res.status(403).json({
          success: false,
          error: {
            code: "ACCESS_DENIED",
            message: "You can only access your own resources",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      }
    };
  }

  /**
   * Rate limiting by user
   */
  userRateLimit(maxRequests, windowMs) {
    const userRequests = new Map();

    // Runs periodically in the background to Clean up old request entries to avoid memory leaks
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - windowMs;
      for (const [userId, timestamps] of userRequests.entries()) {
        const filtered = timestamps.filter((ts) => ts > cutoff);
        if (filtered.length) {
          userRequests.set(userId, filtered);
        } else {
          userRequests.delete(userId);
        }
      }
    }, windowMs);

    return async (req, res, next) => {
      try {
        if (!req.user) {
          return next();
        }

        const userId = req.user.userId;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries for the current active user making request.
        if (userRequests.has(userId)) {
          const requests = userRequests.get(userId);
          const validRequests = requests.filter(
            (timestamp) => timestamp > windowStart
          );
          userRequests.set(userId, validRequests);
        }

        // Check current requests
        const currentRequests = userRequests.get(userId) || [];

        if (currentRequests.length >= maxRequests) {
          throw AuthError.rateLimitExceeded("User rate limit exceeded");
        }

        // Add current request
        currentRequests.push(now);
        userRequests.set(userId, currentRequests);

        next();
      } catch (error) {
        logger.warn("User rate limit exceeded", {
          userId: req.user?.userId,
          error: error.message,
          requestId: req.requestId,
        });

        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      }
    };
  }
}

module.exports = new AuthMiddleware();

const rateLimit = require("express-rate-limit");
const config = require("../config/app.config");
const logger = require("../utils/logger.util");

/**
 * Rate Limiting Middleware
 * Implements rate limiting for media service endpoints
 */
class RateLimitMiddleware {
  /**
   * Global rate limiting
   */
  get globalRateLimit() {
    return rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const userId = req.user?.userId || "anonymous";
        return `${req.ip}:${userId}`;
      },
      handler: (req, res) => {
        logger.warn("Global rate limit exceeded", {
          ip: req.ip,
          userId: req.user?.userId,
          endpoint: req.path,
          method: req.method,
          requestId: req.requestId,
        });

        res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests, please try again later",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      },
      skip: (req) => {
        return req.path === "/health";
      },
    });
  }

  /**
   * Upload rate limiting
   */
  get uploadRateLimit() {
    return rateLimit({
      windowMs: config.rateLimit.upload.windowMs,
      max: config.rateLimit.upload.max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => `upload:${req.user?.userId || req.ip}`,
      handler: (req, res) => {
        logger.warn("Upload rate limit exceeded", {
          ip: req.ip,
          userId: req.user?.userId,
          endpoint: req.path,
          requestId: req.requestId,
        });

        res.status(429).json({
          success: false,
          error: {
            code: "UPLOAD_RATE_LIMIT_EXCEEDED",
            message: "Too many upload requests, please try again later",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      },
    });
  }

  /**
   * Admin rate limiting
   */
  get adminRateLimit() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 admin requests per minute
      keyGenerator: (req) => `admin:${req.user?.userId || req.ip}`,
      handler: (req, res) => {
        logger.warn("Admin rate limit exceeded", {
          ip: req.ip,
          userId: req.user?.userId,
          endpoint: req.path,
          requestId: req.requestId,
        });

        res.status(429).json({
          success: false,
          error: {
            code: "ADMIN_RATE_LIMIT_EXCEEDED",
            message: "Too many admin requests",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      },
    });
  }

  /**
   * Media access rate limiting
   */
  get mediaAccessRateLimit() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 200, // 200 media access requests per minute
      keyGenerator: (req) => `media:${req.user?.userId || req.ip}`,
      handler: (req, res) => {
        logger.warn("Media access rate limit exceeded", {
          ip: req.ip,
          userId: req.user?.userId,
          endpoint: req.path,
          requestId: req.requestId,
        });

        res.status(429).json({
          success: false,
          error: {
            code: "MEDIA_ACCESS_RATE_LIMIT_EXCEEDED",
            message: "Too many media access requests",
          },
          timestamp: new Date().toISOString(),
          request_id: req.requestId,
        });
      },
    });
  }
}

module.exports = new RateLimitMiddleware();

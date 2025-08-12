const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis").default;
const securityConfig = require("../config/security.config");
const redisClient = require("../../shared/libraries/cache/redis.client");
const logger = require("../utils/logger.util");

/**
 * Rate Limiting Middleware
 * Implements various rate limiting strategies for different endpoints
 */
class RateLimitMiddleware {
  constructor() {
    this.store = new RedisStore({
      sendCommand: (...args) => redisClient.client.sendCommand(...args),
      prefix: "rl:",
    });
  }

  /**
   * Create custom rate limiter
   */
  createRateLimit(options) {
    const defaultOptions = {
      store: this.store,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use IP address and user ID if available
        const userId = req.user?.userId || "anonymous";
        return `${req.ip}:${userId}`;
      },
      handler: (req, res) => {
        logger.warn("Rate limit exceeded", {
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
        // Skip rate limiting for health checks
        return req.path === "/health";
      },
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Global rate limiting
   */
  get globalRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.windowMs,
      max: securityConfig.rateLimit.max,
      message: "Too many requests from this IP",
    });
  }

  /**
   * Authentication rate limiting
   */
  get authRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.auth.windowMs,
      max: securityConfig.rateLimit.rules.auth.max,
      keyGenerator: (req) => `auth:${req.ip}`,
      message: "Too many authentication attempts",
    });
  }

  /**
   * Registration rate limiting
   */
  get registerRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.register.windowMs,
      max: securityConfig.rateLimit.rules.register.max,
      keyGenerator: (req) => `register:${req.ip}`,
      message: "Too many registration attempts",
    });
  }

  /**
   * Login rate limiting
   */
  get loginRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.login.windowMs,
      max: securityConfig.rateLimit.rules.login.max,
      keyGenerator: (req) => `login:${req.ip}:${req.body.phone || "unknown"}`,
      message: "Too many login attempts",
    });
  }

  /**
   * OTP rate limiting
   */
  get otpRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.otp.windowMs,
      max: securityConfig.rateLimit.rules.otp.max,
      keyGenerator: (req) =>
        `otp:${req.ip}:${req.body.phone || req.body.new_phone || "unknown"}`,
      message: "Too many OTP requests",
    });
  }

  /**
   * Password reset rate limiting
   */
  get passwordResetRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.passwordReset.windowMs,
      max: securityConfig.rateLimit.rules.passwordReset.max,
      keyGenerator: (req) =>
        `pwd_reset:${req.ip}:${req.body.phone || "unknown"}`,
      message: "Too many password reset attempts",
    });
  }

  /**
   * Profile update rate limiting
   */
  get profileUpdateRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 profile updates per minute
      keyGenerator: (req) => `profile:${req.user?.userId || req.ip}`,
      message: "Too many profile update requests",
    });
  }

  /**
   * File upload rate limiting
   */
  get fileUploadRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 file uploads per minute
      keyGenerator: (req) => `upload:${req.user?.userId || req.ip}`,
      message: "Too many file upload requests",
    });
  }

  /**
   * Admin action rate limiting
   */
  get adminRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 admin actions per minute
      keyGenerator: (req) => `admin:${req.user?.userId || req.ip}`,
      message: "Too many admin requests",
    });
  }

  /**
   * Session management rate limiting
   */
  get sessionRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 session operations per minute
      keyGenerator: (req) => `session:${req.user?.userId || req.ip}`,
      message: "Too many session requests",
    });
  }

  /**
   * Settings update rate limiting
   */
  get settingsRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 15, // 15 settings updates per minute
      keyGenerator: (req) => `settings:${req.user?.userId || req.ip}`,
      message: "Too many settings update requests",
    });
  }

  /**
   * Account action rate limiting (deactivate, delete)
   */
  get accountActionRateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 account actions per hour
      keyGenerator: (req) => `account:${req.user?.userId || req.ip}`,
      message: "Too many account action requests",
    });
  }

  /**
   * Phone-based rate limiting for sensitive operations
   */
  createPhoneRateLimit(windowMs, max, prefix = "phone") {
    return this.createRateLimit({
      windowMs,
      max,
      keyGenerator: (req) => {
        const phone = req.body.phone || req.body.new_phone || "unknown";
        return `${prefix}:${phone}`;
      },
      message: "Too many requests for this phone number",
    });
  }

  /**
   * User-based rate limiting
   */
  createUserRateLimit(windowMs, max, prefix = "user") {
    return this.createRateLimit({
      windowMs,
      max,
      keyGenerator: (req) => `${prefix}:${req.user?.userId || req.ip}`,
      message: "Too many requests from this user",
    });
  }

  /**
   * Sliding window rate limiter using Redis client methods
   */
  createSlidingWindowRateLimit(options) {
    return async (req, res, next) => {
      try {
        const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
        const now = Date.now();
        const windowStart = now - options.windowMs;
        const redisKey = `sliding:${key}`;

        // Get current requests from Redis
        const currentRequests = (await redisClient.get(redisKey)) || [];

        // Filter out expired requests
        const validRequests = currentRequests.filter(
          (timestamp) => timestamp > windowStart
        );

        if (validRequests.length >= options.max) {
          logger.warn("Sliding window rate limit exceeded", {
            key,
            requests: validRequests.length,
            max: options.max,
            requestId: req.requestId,
          });

          return res.status(429).json({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: options.message || "Too many requests",
            },
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
          });
        }

        // Add current request and save back to Redis
        validRequests.push(now);
        await redisClient.set(
          redisKey,
          validRequests,
          Math.ceil(options.windowMs / 1000)
        );

        next();
      } catch (error) {
        logger.error("Sliding window rate limiter error", {
          error: error.message,
          requestId: req.requestId,
        });
        // Continue on Redis error to avoid blocking requests
        next();
      }
    };
  }

  /**
   * Burst rate limiter using Redis (allows short bursts)
   */
  createBurstRateLimit(burstMax, sustainedMax, windowMs) {
    return async (req, res, next) => {
      try {
        const key = req.user?.userId || req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        const burstWindowStart = now - 10000; // 10 seconds for burst

        // Check burst limit
        const burstKey = `burst:${key}`;
        const currentBurstRequests = (await redisClient.get(burstKey)) || [];
        const validBurstRequests = currentBurstRequests.filter(
          (timestamp) => timestamp > burstWindowStart
        );

        if (validBurstRequests.length >= burstMax) {
          return res.status(429).json({
            success: false,
            error: {
              code: "BURST_RATE_LIMIT_EXCEEDED",
              message: "Too many requests in short time",
            },
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
          });
        }

        // Check sustained limit
        const sustainedKey = `sustained:${key}`;
        const currentSustainedRequests =
          (await redisClient.get(sustainedKey)) || [];
        const validSustainedRequests = currentSustainedRequests.filter(
          (timestamp) => timestamp > windowStart
        );

        if (validSustainedRequests.length >= sustainedMax) {
          return res.status(429).json({
            success: false,
            error: {
              code: "SUSTAINED_RATE_LIMIT_EXCEEDED",
              message: "Too many requests over time",
            },
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
          });
        }

        // Update counters in Redis
        validBurstRequests.push(now);
        validSustainedRequests.push(now);

        await Promise.all([
          redisClient.set(burstKey, validBurstRequests, 10), // 10 seconds TTL
          redisClient.set(
            sustainedKey,
            validSustainedRequests,
            Math.ceil(windowMs / 1000)
          ),
        ]);

        next();
      } catch (error) {
        logger.error("Burst rate limiter error", {
          error: error.message,
          requestId: req.requestId,
        });
        // Continue on Redis error to avoid blocking requests
        next();
      }
    };
  }

  /**
   * Distributed rate limiter using Redis atomic operations
   */
  createDistributedRateLimit(options) {
    return async (req, res, next) => {
      try {
        const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
        const redisKey = `dist_rl:${key}`;
        const ttl = Math.ceil(options.windowMs / 1000);

        // Use Redis pipeline for atomic operations
        const current = await redisClient.incr(redisKey);

        if (current === 1) {
          // First request in window, set expiration
          await redisClient.expire(redisKey, ttl);
        }

        if (current > options.max) {
          logger.warn("Distributed rate limit exceeded", {
            key,
            current,
            max: options.max,
            requestId: req.requestId,
          });

          return res.status(429).json({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: options.message || "Too many requests",
            },
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
            retryAfter: ttl,
          });
        }

        // Add rate limit headers
        res.set({
          "X-RateLimit-Limit": options.max,
          "X-RateLimit-Remaining": Math.max(0, options.max - current),
          "X-RateLimit-Reset": new Date(Date.now() + ttl * 1000).toISOString(),
        });

        next();
      } catch (error) {
        logger.error("Distributed rate limiter error", {
          error: error.message,
          requestId: req.requestId,
        });
        // Continue on Redis error to avoid blocking requests
        next();
      }
    };
  }

  /**
   * Adaptive rate limiter that adjusts limits based on system load
   */
  createAdaptiveRateLimit(baseMax, windowMs) {
    return async (req, res, next) => {
      try {
        const key = req.user?.userId || req.ip;
        const redisKey = `adaptive:${key}`;

        // Get system metrics to determine current load
        const metrics = redisClient.getMetrics();
        const errorRate =
          metrics.totalRequests > 0
            ? (metrics.errors / metrics.totalRequests) * 100
            : 0;

        // Adjust rate limit based on error rate and cache hit rate
        let adjustedMax = baseMax;
        if (errorRate > 5) {
          adjustedMax = Math.floor(baseMax * 0.5); // Reduce by 50% if error rate > 5%
        } else if (parseFloat(metrics.hitRate) < 80) {
          adjustedMax = Math.floor(baseMax * 0.7); // Reduce by 30% if cache hit rate < 80%
        }

        // Use distributed rate limit with adjusted max
        const distributedLimiter = this.createDistributedRateLimit({
          max: adjustedMax,
          windowMs,
          keyGenerator: () => key,
          message: `Rate limit temporarily reduced due to system load`,
        });

        return distributedLimiter(req, res, next);
      } catch (error) {
        logger.error("Adaptive rate limiter error", {
          error: error.message,
          requestId: req.requestId,
        });
        // Fall back to basic rate limiting
        const fallbackLimiter = this.createDistributedRateLimit({
          max: baseMax,
          windowMs,
          keyGenerator: () => req.user?.userId || req.ip,
        });
        return fallbackLimiter(req, res, next);
      }
    };
  }

  /**
   * Get rate limit status for a key
   */
  async getRateLimitStatus(key, windowMs) {
    try {
      const redisKey = `dist_rl:${key}`;
      const current = (await redisClient.get(redisKey)) || 0;
      const ttl = await redisClient.client.ttl(redisKey);

      return {
        current: parseInt(current),
        resetTime: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null,
        windowMs,
      };
    } catch (error) {
      logger.error("Failed to get rate limit status", {
        error: error.message,
        key,
      });
      return null;
    }
  }

  /**
   * Clear rate limit for a key (admin function)
   */
  async clearRateLimit(key, prefix = "dist_rl") {
    try {
      const redisKey = `${prefix}:${key}`;
      const result = await redisClient.del(redisKey);

      logger.info("Rate limit cleared", { key: redisKey, success: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error("Failed to clear rate limit", {
        error: error.message,
        key,
      });
      return false;
    }
  }
}

module.exports = new RateLimitMiddleware();

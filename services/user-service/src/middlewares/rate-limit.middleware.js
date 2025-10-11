const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis").default;
const securityConfig = require("../config/security.config");
const redisClient = require("../cache/redis.client");
const logger = require("../../../../shared/utils/logger.util");

/**
 * Rate Limiting Middleware
 * Implements various rate limiting strategies for different endpoints
 */
class RateLimitMiddleware {
  constructor() {
    // Initialize store as null - will be created lazily when Redis is ready
    this.store = null;
    this.storeInitialized = false;
    this.initializationPromise = null;
    this.serviceName = securityConfig.app.serviceName;
  }

  /**
   * Initialize Redis store for rate limiting
   */
  async initializeRedisStore() {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitializeRedisStore();
    return this.initializationPromise;
  }

  async _doInitializeRedisStore() {
    try {
      // Verify Redis is ready first
      if (!redisClient.isReady()) {
        throw new Error(
          `${this.serviceName}: Redis client not ready for rate limiting store initialization`
        );
      }

      // Test Redis connection before creating store
      const pingResult = await redisClient.ping();
      if (pingResult !== "PONG") {
        throw new Error("Redis ping test failed");
      }

      // Create Redis store with proper error handling
      this.store = new RedisStore({
        sendCommand: (...args) => {
          try {
            if (!redisClient.isReady()) {
              throw new Error("Redis client not ready");
            }
            if (redisClient.client.sendCommand) {
              // For ioredis
              return redisClient.client.sendCommand(args);
            } else {
              // For node-redis v4+ or custom wrapper
              const [command, ...commandArgs] = args;
              return redisClient.client[command.toLowerCase()](...commandArgs);
            }
          } catch (error) {
            logger.error("Redis store command failed", {
              error: error.message,
              command: args[0],
              serviceName: this.serviceName,
            });
            throw error;
          }
        },
      });

      // Test the store by performing a simple operation
      await this._testRedisStore();

      this.storeInitialized = true;
      logger.info("Redis store initialized for rate limiting", {
        prefix: `rl:${this.serviceName}:`,
        redisReady: redisClient.isReady(),
      });
    } catch (error) {
      logger.error("Failed to initialize Redis store for rate limiting", {
        error: error.message,
        serviceName: this.serviceName,
      });
      this.store = null;
      this.storeInitialized = false;
      this.initializationPromise = null; // Reset so we can try again
      throw error;
    }
  }

  /**
   * Test Redis store functionality
   */
  async _testRedisStore() {
    try {
      const testKey = `rl:${this.serviceName}:test:initialization`;

      // Try to set and get a test key
      await redisClient.set(testKey, "test", 5);
      const result = await redisClient.get(testKey);

      if (result !== "test") {
        throw new Error(
          "Redis store test failed - could not retrieve test value"
        );
      }

      // Clean up test key
      await redisClient.del(testKey);

      logger.debug("Redis store test passed");
    } catch (error) {
      logger.error("Redis store test failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get or create Redis store (safe method)
   */
  getStore() {
    if (!this.storeInitialized || !this.store) {
      logger.warn(
        "Redis store not available for rate limiting, using memory store"
      );
      return null;
    }

    // Double-check Redis is still ready
    if (!redisClient.isReady()) {
      logger.warn(
        "Redis connection lost, rate limiting falling back to in-memory store"
      );
      return null;
    }

    return this.store;
  }

  createRateLimit(options) {
    const store = this.getStore();
    const ip = this.getIp() || "unknown";

    const defaultOptions = {
      store: store, // // Use Redis store if available, otherwise defaults to memory store
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use IP address and user ID if available
        const userId = req.user?.userId || "anonymous";

        return `rl:${this.serviceName}:${ip}:${userId}`;
      },
      handler: (req, res) => {
        logger.warn("Rate limit exceeded", {
          ip: ip,
          userId: req.user?.userId,
          endpoint: req.path,
          method: req.method,
          requestId: req.requestId,
          limit: options.max,
          window: options.windowMs,
          storeType: store ? "redis" : "memory",
          serviceName: this.serviceName,
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
        const allowedHealthPaths = ["/health", "/health/"];
        // Skip rate limiting for health checks
        return allowedHealthPaths.includes(req.path);
      },

      // Skip on store errors to prevent blocking requests
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
    };

    // If Redis store is not available, log warning and use default memory store
    if (!store) {
      logger.warn(
        "Redis store not available for rate limiting, using memory store",
        {
          endpoint: options.message || "unknown",
          serviceName: this.serviceName,
        }
      );
    }

    // Create rate limiter with error handling
    const limiterOptions = { ...defaultOptions, ...options };
    const limiter = rateLimit(limiterOptions);

    // Wrap the limiter to handle Redis errors gracefully
    return (req, res, next) => {
      try {
        // Check if we should skip rate limiting due to Redis issues
        if (options.requireRedis && !redisClient.isReady()) {
          logger.warn("Skipping rate limiting due to Redis unavailability", {
            path: req.path,
            serviceName: this.serviceName,
          });
          return next();
        }

        limiter(req, res, next);
      } catch (error) {
        logger.error("Rate limiter error", {
          error: error.message,
          path: req.path,
          storeType: store ? "redis" : "memory",
          serviceName: this.serviceName,
        });

        // Continue without rate limiting on error
        next();
      }
    };
  }

  /**
   * Global rate limiting
   */
  globalRateLimit() {
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.windowMs,
      max: securityConfig.rateLimit.max,
      message: "Too many requests from this IP",
    });
  }

  /**
   * Authentication rate limiting
   */
  authRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.auth.windowMs,
      max: securityConfig.rateLimit.rules.auth.max,
      keyGenerator: (req) => {
        // Use IP address and user ID if available
        const userId = req.user?.userId || "anonymous";

        return `rl:${this.serviceName}:auth:${ip}:${userId}`;
      },
      message: "Too many authentication attempts",
    });
  }

  /**
   * Registration rate limiting
   */
  registerRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.register.windowMs,
      max: securityConfig.rateLimit.rules.register.max,
      keyGenerator: () => {
        return `rl:${this.serviceName}:register:${ip}`;
      },
      message: "Too many registration attempts",
    });
  }

  /**
   * Login rate limiting
   */
  loginRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.login.windowMs,
      max: securityConfig.rateLimit.rules.login.max,
      keyGenerator: (req) => {
        return `rl:${this.serviceName}:login:${ip}:${
          req.body.phone || "unknown"
        }`;
      },
      message: "Too many login attempts",
    });
  }

  /**
   * OTP rate limiting
   */
  otpRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.otp.windowMs,
      max: securityConfig.rateLimit.rules.otp.max,

      keyGenerator: (req) => {
        return `rl:${this.serviceName}:otp:${ip}:${
          req.body.phone || req.body.new_phone || "unknown"
        }`;
      },
      message: "Too many OTP requests",
    });
  }

  /**
   * Distributed rate limiter using Redis atomic operations (with fallback)
   */
  createDistributedRateLimit(options) {
    return async (req, res, next) => {
      try {
        // If Redis is not ready, skip rate limiting with warning
        if (!redisClient.isReady()) {
          logger.warn("Redis not ready, skipping distributed rate limit", {
            path: req.path,
            serviceName: this.serviceName,
          });
          return next();
        }

        const ip = this.getIp() || "unknown";
        const key = options.keyGenerator
          ? options.keyGenerator(req)
          : `rl:${this.serviceName}:${ip}`;
        const redisKey = `dist:${key}`;
        const ttl = Math.ceil(options.windowMs / 1000);

        // Use Redis atomic operations with proper error handling
        let current;
        try {
          current = await redisClient.incr(redisKey);

          if (current === 1) {
            // First request in window, set expiration
            await redisClient.expire(redisKey, ttl);
          }
        } catch (redisError) {
          logger.error("Redis error in distributed rate limiter", {
            error: redisError.message,
            key: redisKey,
            serviceName: this.serviceName,
          });

          // Fall back to allowing the request
          return next();
        }

        if (current > options.max) {
          logger.warn("Distributed rate limit exceeded", {
            key,
            current,
            max: options.max,
            requestId: req.requestId,
            serviceName: this.serviceName,
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
          serviceName: this.serviceName,
        });
        // Continue without rate limiting on error
        next();
      }
    };
  }

  /**
   * Password reset rate limiting
   */
  passwordResetRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: securityConfig.rateLimit.rules.passwordReset.windowMs,
      max: securityConfig.rateLimit.rules.passwordReset.max,
      keyGenerator: (req) =>
        `rl:${this.serviceName}:pwd_reset:${ip}:${req.body.phone || "unknown"}`,
      message: "Too many password reset attempts",
    });
  }

  /**
   * Profile update rate limiting
   */
  profileUpdateRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // 10 profile updates per minute
      keyGenerator: (req) =>
        `rl:${this.serviceName}:profileUpdate:${req.user?.userId || ip}`,
      message: "Too many profile update requests",
    });
  }

  /**
   * File upload rate limiting
   */
  fileUploadRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 file uploads per minute
      keyGenerator: (req) =>
        `rl:${this.serviceName}:upload:${req.user?.userId || ip}`,
      message: "Too many file upload requests",
    });
  }

  /**
   * Admin action rate limiting
   */
  adminRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 admin actions per minute
      keyGenerator: (req) =>
        `rl:${this.serviceName}:admin:${req.user?.userId || ip}`,
      message: "Too many admin requests",
    });
  }

  /**
   * Session management rate limiting
   */
  sessionRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 session operations per minute
      keyGenerator: (req) =>
        `rl:${this.serviceName}:session:${req.user?.userId || ip}`,
      message: "Too many session requests",
    });
  }

  /**
   * Settings update rate limiting
   */
  settingsRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 settings updates per minute
      keyGenerator: (req) =>
        `rl:${this.serviceName}:settings:${req.user?.userId || ip}`,
      message: "Too many settings update requests",
      headers: true,
    });
  }

  /**
   * Account action rate limiting (deactivate, delete)
   */
  accountActionRateLimit() {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 account actions per hour
      keyGenerator: (req) =>
        `rl:${this.serviceName}:account:${req.user?.userId || ip}`,
      message: "Too many account action requests",
      headers: true,
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
        return `rl:${this.serviceName}:${prefix}:${phone}`;
      },
      message: "Too many requests for this phone number",
    });
  }

  /**
   * User-based rate limiting
   */
  createUserRateLimit(windowMs, max, prefix = "user") {
    const ip = this.getIp() || "unknown";
    return this.createRateLimit({
      windowMs,
      max,
      keyGenerator: (req) =>
        `rl:${this.serviceName}:${prefix}:${req.user?.userId || ip}`,
      message: "Too many requests from this user",
    });
  }

  /**
   * Sliding window rate limiter using Redis client methods
   */
  createSlidingWindowRateLimit(options) {
    return async (req, res, next) => {
      try {
        // If Redis is not ready, skip rate limiting
        if (!redisClient.isReady()) {
          logger.warn("Redis not ready, skipping sliding window rate limit");
          return next();
        }

        const ip = this.getIp() || "unknown";
        const key = options.keyGenerator
          ? options.keyGenerator(req)
          : `rl:${this.serviceName}:${ip}`;
        const now = Date.now();
        const windowStart = now - options.windowMs;
        const redisKey = `sliding:${key}`;

        try {
          // Remove expired entries
          await redisClient.zremrangebyscore(redisKey, 0, windowStart);

          // Count current requests
          const currentCount = await redisClient.zcard(redisKey);

          if (currentCount >= options.max) {
            logger.warn("Sliding window rate limit exceeded", {
              key,
              requests: currentCount,
              max: options.max,
              requestId: req.requestId,
              serviceName: this.serviceName,
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

          // Add current request
          await redisClient.zAdd(redisKey, [
            { score: now, value: `${now}-${Math.random()}` },
          ]);

          // Set expiration
          await redisClient.expire(
            redisKey,
            Math.ceil(options.windowMs / 1000)
          );
        } catch (redisError) {
          logger.error("Redis error in sliding window rate limiter", {
            error: redisError.message,
            serviceName: this.serviceName,
          });
          return next();
        }

        next();
      } catch (error) {
        logger.error("Sliding window rate limiter error", {
          error: error.message,
          requestId: req.requestId,
          serviceName: this.serviceName,
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
        // If Redis is not ready, skip rate limiting
        if (!redisClient.isReady()) {
          logger.warn("Redis not ready, skipping burst rate limit");
          return next();
        }

        const ip = this.getIp() || "unknown";
        const key = req.user?.userId || ip;
        const now = Date.now();
        const burstWindowStart = now - 10000; // 10 seconds for burst
        const sustainedWindowStart = now - windowMs;

        // Check burst limit
        const burstKey = `burst:${key}`;
        await redisClient.zAdd(burstKey, [
          { score: now, value: now.toString() },
        ]);
        await redisClient.zRemRangeByScore(burstKey, 0, burstWindowStart);
        const burstCount = await redisClient.zCard(burstKey);

        if (burstCount >= burstMax) {
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
        await redisClient.zAdd(sustainedKey, [
          { score: now, value: now.toString() },
        ]);
        await redisClient.zRemRangeByScore(
          sustainedKey,
          0,
          sustainedWindowStart
        );
        const sustainedCount = await redisClient.zCard(sustainedKey);

        if (sustainedCount >= sustainedMax) {
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

        // Set expiry to auto-clean keys
        await Promise.all([
          redisClient.expire(burstKey, 10),
          redisClient.expire(sustainedKey, Math.ceil(windowMs / 1000)),
        ]);

        next();
      } catch (error) {
        logger.error("Burst rate limiter error", {
          error: error.message,
          requestId: req.requestId,
          serviceName: this.serviceName,
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
        // If Redis is not ready, skip rate limiting
        if (!redisClient.isReady()) {
          logger.warn("Redis not ready, skipping adaptive rate limit");
          return next();
        }

        const ip = this.getIp() || "unknown";
        const key = req.user?.userId || ip;

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
        const ip = this.getIp() || "unknown";
        const fallbackLimiter = this.createDistributedRateLimit({
          max: baseMax,
          windowMs,
          keyGenerator: () => req.user?.userId || ip,
        });
        return fallbackLimiter(req, res, next);
      }
    };
  }

  /**
   * Get rate limit status for a key
   * key = rl:${this.serviceName}:${ip}
   */
  async getDistRateLimitStatus(key, windowMs) {
    try {
      if (!redisClient.isReady()) {
        return null;
      }

      const redisKey = `dist:${key}`;
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
   * key for dist = rl:${this.serviceName}:${ip}
   */
  async clearDistRateLimit(key, prefix = "dist") {
    try {
      if (!redisClient.isReady()) {
        return false;
      }

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

  /**
   * Health check for rate limiting system
   */
  async healthCheck() {
    const status = {
      serviceName: this.serviceName,
      redisStoreInitialized: this.storeInitialized,
      redisClientReady: redisClient.isReady(),
      storeAvailable: this.getStore() !== null,
      timestamp: new Date().toISOString(),
      healthy: this.storeInitialized && redisClient.isReady() ? true : false,
    };

    return status;
  }

  /**
   * Reset rate limiting state (for testing/admin purposes)
   */
  async reset() {
    try {
      this.store = null;
      this.storeInitialized = false;
      this.initializationPromise = null;

      if (redisClient.isReady()) {
        await this.initializeRedisStore();
      }

      logger.info("Rate limiting middleware reset");
    } catch (error) {
      logger.error("Failed to reset rate limiting middleware", {
        error: error.message,
        serviceName: this.serviceName,
      });
    }
  }

  // Get ip and normalize
  getIp() {
    let ip = req.ip;
    // Normalize IPv6 mapped IPv4 (::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // Remove IPv6 zone index if present
    const percentIndex = ip.indexOf("%");
    if (percentIndex !== -1) ip = ip.substring(0, percentIndex);

    return ip;
  }
}

module.exports = new RateLimitMiddleware();

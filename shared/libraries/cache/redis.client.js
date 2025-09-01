// shared/libraries/cache/redis.client.js

const { createClient, createCluster } = require("redis");
const zlib = require("zlib");
const crypto = require("crypto");
const logger = require("../logging/logger");
const redisConfig = require("./redis.config");

/**
 * Redis Client Manager
 * Handles Redis connections, caching, session management, and monitoring
 */
class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.ready = false;
    this.connectionPromise = null;
    this.healthCheckInterval = null;
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      connections: 0,
      slowQueries: 0,
    };

    this.config = redisConfig;

    // Bind methods
    this.connect = this.connect.bind(this);
    this.quit = this.quit.bind(this);
    this.startHealthCheck = this.startHealthCheck.bind(this);
    this.stopHealthCheck = this.stopHealthCheck.bind(this);
  }

  /**
   * Initialize Redis connection or cluster connection
   */
  async connect() {
    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._doConnect();
    return this.connectionPromise;
  }

  async _doConnect() {
    try {
      const clientOptions = this._buildClientOptions();

      if (this.config.cluster.enabled) {
        this.client = createCluster({
          rootNodes: this.config.cluster.nodes,
          defaults: clientOptions,
          useReplicas: this.config.cluster.scaleReads === "slave",
          maxRedirections: this.config.cluster.maxRedirections,
          enableOfflineQueue: this.config.cluster.enableOfflineQueue,
          enableReadyCheck: this.config.cluster.enableReadyCheck,
        });
      } else {
        this.client = createClient(clientOptions);
      }

      this._registerEventListeners();

      // Connect with timeout
      const connectTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connection timeout")), 10000)
      );

      await Promise.race([this.client.connect(), connectTimeout]);

      // Wait for ready state
      await this._waitForReady();

      // Test connection with simple command
      await this._testConnection();

      // Start health check if enabled
      if (this.config.health.enabled) {
        this.startHealthCheck();
      }

      if (this.config.enableLogging) {
        logger.info("Redis connection established", {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db,
          cluster: this.config.cluster.enabled,
          tls: this.config.enableTLS,
        });
      }

      return this.client;
    } catch (error) {
      this.metrics.errors++;
      this.isConnected = false;
      this.isReady = false;
      this.connectionPromise = null;

      logger.error("Failed to connect to Redis", {
        error: error.message,
        config: {
          host: this.config.host,
          port: this.config.port,
          cluster: this.config.cluster.enabled,
        },
      });
      throw error;
    }
  }

  /**
   * Wait for Redis to be in ready state
   */
  async _waitForReady(timeout = 5000) {
    const startTime = Date.now();

    while (!this.ready && Date.now() - startTime < timeout) {
      if (this.client && this.client.isReady) {
        this.ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.ready) {
      throw new Error("Redis client failed to reach ready state");
    }
  }

  /**
   * Test Redis connection with a simple command
   */
  async _testConnection() {
    try {
      // Use a simple command to test the connection
      const result = await this.client.ping();
      if (result !== "PONG") {
        throw new Error(`Unexpected ping response: ${result}`);
      }

      // Test basic set/get operations
      const testKey = `__test_connection_${Date.now()}`;
      await this.client.set(testKey, "test");
      const testValue = await this.client.get(testKey);
      await this.client.del(testKey);

      if (testValue !== "test") {
        throw new Error("Redis set/get test failed");
      }

      logger.info("Redis connection test successful");
    } catch (error) {
      throw new Error(`Redis connection test failed: ${error.message}`);
    }
  }

  /**
   * Build client options from config
   */
  _buildClientOptions() {
    const options = {
      socket: {
        host: this.config.host,
        port: this.config.port,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        keepAlive: this.config.keepAlive,
        reconnectStrategy: (retries) => {
          if (retries >= this.config.maxRetriesPerRequest) {
            return false; // Stop reconnecting
          }
          const delay = Math.min(retries * 50, 2000); // Progressive delay, max 2s
          return delay;
        },
      },
      password: this.config.password,
      database: this.config.db,
    };

    // Add TLS configuration if enabled
    if (this.config.enableTLS && this.config.tls) {
      options.socket.tls = this.config.tls;
    }

    return options;
  }

  /**
   * Register event listeners
   */
  _registerEventListeners() {
    this.client.on("connect", () => {
      this.isConnected = true;
      this.metrics.connections++;

      if (this.config.enableLogging) {
        logger.info("Redis client connected");
      }
    });

    this.client.on("ready", () => {
      this.ready = true;
      if (this.config.enableLogging) {
        logger.info("Redis client is ready");
      }
    });

    this.client.on("error", (err) => {
      this.isConnected = false;
      this.ready = false;
      this.metrics.errors++;
      logger.error("Redis client error", { error: err.message });

      // Reset connection promise on error to allow reconnection
      if (this.connectionPromise) {
        this.connectionPromise = null;
      }

      // Trigger alerts if monitoring is enabled
      if (this.config.monitoring.alerts.enabled) {
        this._checkAlerts();
      }
    });

    this.client.on("end", () => {
      this.isConnected = false;
      this.ready = false;
      if (this.config.enableLogging) {
        logger.info("Redis client disconnected");
      }
    });

    // Monitor slow queries if enabled
    if (this.config.monitoring.slowLogEnabled) {
      this.client.on("slowlog", (entry) => {
        this.metrics.slowQueries++;
        logger.warn("Redis slow query detected", {
          command: entry.command,
          duration: entry.duration,
          timestamp: entry.timestamp,
        });
      });
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        if (!this.isReady()) {
          logger.warn("Redis health check skipped - client not ready");
          return;
        }

        const start = Date.now();
        await this.ping();
        const latency = Date.now() - start;

        // Check latency alerts
        if (
          this.config.monitoring.alerts.enabled &&
          latency > this.config.monitoring.alerts.latencyThreshold
        ) {
          logger.warn("Redis high latency detected", { latency });
        }

        if (this.config.enableLogging && this.config.logLevel === "debug") {
          logger.debug("Redis health check passed", { latency });
        }
      } catch (error) {
        logger.error("Redis health check failed", { error: error.message });
        this.metrics.errors++;

        // Try to reconnect if health check fails consistently
        if (this.metrics.errors > 5) {
          logger.warn(
            "Multiple Redis errors detected, attempting reconnection"
          );
          this._attemptReconnection();
        }
      }
    }, this.config.health.interval);
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Attempt to reconnect Redis
   */
  async _attemptReconnection() {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      this.isConnected = false;
      this.isReady = false;
      this.connectionPromise = null;

      // Wait a bit before reconnecting
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.connect();
    } catch (error) {
      logger.error("Redis reconnection failed", { error: error.message });
    }
  }

  /**
   * Check monitoring alerts
   */
  _checkAlerts() {
    if (!this.config.monitoring.alerts.enabled) return;

    const { connectionThreshold, memoryThreshold } =
      this.config.monitoring.alerts;

    if (this.metrics.connections > connectionThreshold) {
      logger.warn("Redis connection threshold exceeded", {
        current: this.metrics.connections,
        threshold: connectionThreshold,
      });
    }
  }

  /**
   * Check if Redis is ready and connected
   */
  isReady() {
    try {
      return (
        this.isConnected && this.ready && this.client && this.client.isReady
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute Redis command with connection check
   */
  async _executeCommand(commandName, commandFn) {
    if (!this.isReady()) {
      throw new Error(`Redis not ready for command: ${commandName}`);
    }

    try {
      const result = await commandFn();
      this.metrics.totalRequests++;
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Redis ${commandName} failed`, { error: error.message });
      throw error;
    }
  }

  /**
   * Test Redis connection
   */
  async ping() {
    return this._executeCommand("PING", async () => {
      const start = Date.now();
      const result = await this.client.ping();
      const duration = Date.now() - start;

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis ping successful", { result, duration });
      }
      return result;
    });
  }

  /**
   * Serialize value with optional compression and encryption
   */
  _serialize(value) {
    let serialized = JSON.stringify(value);

    // Apply compression if enabled and data meets threshold
    if (
      this.config.cache.compression.enabled &&
      serialized.length > this.config.cache.compression.threshold
    ) {
      switch (this.config.cache.compression.algorithm) {
        case "gzip":
          serialized = zlib.gzipSync(serialized).toString("base64");
          break;
        case "deflate":
          serialized = zlib.deflateSync(serialized).toString("base64");
          break;
      }
    }

    // Apply encryption if enabled
    if (this.config.cache.serialization.enableEncryption) {
      const algorithm = "aes-256-gcm";
      const key = crypto.scryptSync(
        process.env.REDIS_ENCRYPTION_KEY || "default-key",
        "salt",
        32
      );
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);

      let encrypted = cipher.update(serialized, "utf8", "hex");
      encrypted += cipher.final("hex");

      serialized = JSON.stringify({
        encrypted,
        iv: iv.toString("hex"),
        algorithm,
      });
    }

    return serialized;
  }

  /**
   * Deserialize value with decompression and decryption
   */
  _deserialize(serializedValue) {
    try {
      let value = serializedValue;

      // Check if encrypted
      if (this.config.cache.serialization.enableEncryption) {
        const encryptedData = JSON.parse(value);
        if (encryptedData.encrypted && encryptedData.iv) {
          const key = crypto.scryptSync(
            process.env.REDIS_ENCRYPTION_KEY || "default-key",
            "salt",
            32
          );
          const decipher = crypto.createDecipher(encryptedData.algorithm, key);

          let decrypted = decipher.update(
            encryptedData.encrypted,
            "hex",
            "utf8"
          );
          decrypted += decipher.final("utf8");
          value = decrypted;
        }
      }

      // Check if compressed (simple check for base64 format)
      if (
        this.config.cache.compression.enabled &&
        typeof value === "string" &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(value)
      ) {
        try {
          const buffer = Buffer.from(value, "base64");
          switch (this.config.cache.compression.algorithm) {
            case "gzip":
              value = zlib.gunzipSync(buffer).toString();
              break;
            case "deflate":
              value = zlib.inflateSync(buffer).toString();
              break;
          }
        } catch (err) {
          // If decompression fails, treat as regular JSON
        }
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error("Redis deserialization failed", { error: error.message });
      return serializedValue;
    }
  }

  /**
   * Generate cache key with prefix
   */
  _generateKey(key) {
    return `${this.config.cache.keyPrefix}${key}`;
  }

  /**
   * Set key-value pair with optional TTL in seconds
   */
  async set(key, value, ttl = null) {
    return this._executeCommand("SET", async () => {
      const start = Date.now();
      const prefixedKey = this._generateKey(key);
      const serializedValue = this._serialize(value);

      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, serializedValue);
      } else {
        await this.client.set(prefixedKey, serializedValue);
      }

      const duration = Date.now() - start;

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis SET operation", {
          key: prefixedKey,
          ttl,
          duration,
        });
      }

      // Log slow queries if enabled
      if (
        this.config.monitoring.slowLogEnabled &&
        duration > this.config.monitoring.slowLogThreshold / 1000
      ) {
        this.metrics.slowQueries++;
        logger.warn("Redis slow SET operation", { key: prefixedKey, duration });
      }
    });
  }

  /**
   * Get value by key
   */
  async get(key) {
    return this._executeCommand("GET", async () => {
      const start = Date.now();
      const prefixedKey = this._generateKey(key);
      const value = await this.client.get(prefixedKey);

      const duration = Date.now() - start;

      if (value === null) {
        this.metrics.cacheMisses++;
        if (this.config.enableLogging && this.config.logLevel === "debug") {
          logger.debug("Redis GET cache miss", { key: prefixedKey, duration });
        }
        return null;
      }

      this.metrics.cacheHits++;
      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis GET cache hit", { key: prefixedKey, duration });
      }

      // Log slow queries if enabled
      if (
        this.config.monitoring.slowLogEnabled &&
        duration > this.config.monitoring.slowLogThreshold / 1000
      ) {
        this.metrics.slowQueries++;
        logger.warn("Redis slow GET operation", { key: prefixedKey, duration });
      }

      return this._deserialize(value);
    });
  }

  /**
   * Delete key
   */
  async del(key) {
    return this._executeCommand("DEL", async () => {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.del(prefixedKey);

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis DEL operation", {
          key: prefixedKey,
          deleted: result,
        });
      }
      return result;
    });
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    return this._executeCommand("EXISTS", async () => {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.exists(prefixedKey);
      return result === 1;
    });
  }

  /**
   * Set expiration for key in seconds
   */
  async expire(key, ttl) {
    return this._executeCommand("EXPIRE", async () => {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.expire(prefixedKey, ttl);

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis EXPIRE operation", {
          key: prefixedKey,
          ttl,
          success: result,
        });
      }
      return result;
    });
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    return this._executeCommand("MGET", async () => {
      const prefixedKeys = keys.map((key) => this._generateKey(key));
      const values = await this.client.mGet(prefixedKeys);

      return values.map((value) => {
        if (value === null) {
          this.metrics.cacheMisses++;
          return null;
        }
        this.metrics.cacheHits++;
        return this._deserialize(value);
      });
    });
  }

  /**
   * Increment counter for key
   */
  async incr(key) {
    return this._executeCommand("INCR", async () => {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.incr(prefixedKey);

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis INCR operation", {
          key: prefixedKey,
          value: result,
        });
      }
      return result;
    });
  }

  /**
   * Cache management methods using configured TTLs
   */

  // Session management
  async setSession(userId, sessionData, customTTL = null) {
    const ttl = customTTL || this.config.cache.ttl.session;
    return this.set(`session:${userId}`, sessionData, ttl);
  }

  async getSession(userId) {
    return this.get(`session:${userId}`);
  }

  async deleteSession(userId) {
    return this.del(`session:${userId}`);
  }

  // OTP management
  async setOTP(phone, otpData, customTTL = null) {
    const ttl = customTTL || this.config.cache.ttl.otp;
    return this.set(`otp:${phone}`, otpData, ttl);
  }

  async getOTP(phone) {
    return this.get(`otp:${phone}`);
  }

  async deleteOTP(phone) {
    return this.del(`otp:${phone}`);
  }

  // User profile caching
  async setUserProfile(userId, profileData, customTTL = null) {
    const ttl = customTTL || this.config.cache.ttl.userProfile;
    return this.set(`profile:${userId}`, profileData, ttl);
  }

  async getUserProfile(userId) {
    return this.get(`profile:${userId}`);
  }

  async deleteUserProfile(userId) {
    return this.del(`profile:${userId}`);
  }

  // Settings caching
  async setUserSettings(userId, settings, customTTL = null) {
    const ttl = customTTL || this.config.cache.ttl.settings;
    return this.set(`settings:${userId}`, settings, ttl);
  }

  async getUserSettings(userId) {
    return this.get(`settings:${userId}`);
  }

  // Token blacklist
  async blacklistToken(token, customTTL = null) {
    const ttl = customTTL || this.config.cache.ttl.tokenBlacklist;
    return this.set(
      `blacklist:${token}`,
      { blacklisted: true, timestamp: Date.now() },
      ttl
    );
  }

  async isTokenBlacklisted(token) {
    const result = await this.get(`blacklist:${token}`);
    return result !== null;
  }

  /**
   * Sliding window rate limiter using Redis client methods
   */
  createSlidingWindowRateLimit(options) {
    return async (req, res, next) => {
      try {
        // If Redis is not ready, skip rate limiting
        if (!this.isReady()) {
          logger.warn("Redis not ready, skipping sliding window rate limit");
          return next();
        }

        const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
        const now = Date.now();
        const windowStart = now - options.windowMs;
        const redisKey = `sliding:${key}`;

        // Get current requests from Redis
        const currentRequests = (await this.get(redisKey)) || [];

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
        await this.set(
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
        // If Redis is not ready, skip rate limiting
        if (!this.isReady()) {
          logger.warn("Redis not ready, skipping burst rate limit");
          return next();
        }

        const key = req.user?.userId || req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        const burstWindowStart = now - 10000; // 10 seconds for burst

        // Check burst limit
        const burstKey = `burst:${key}`;
        const currentBurstRequests = (await this.get(burstKey)) || [];
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
        const currentSustainedRequests = (await this.get(sustainedKey)) || [];
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
          this.set(burstKey, validBurstRequests, 10), // 10 seconds TTL
          this.set(
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
        // If Redis is not ready, skip rate limiting
        if (!this.isReady()) {
          logger.warn("Redis not ready, skipping distributed rate limit");
          return next();
        }

        const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
        const redisKey = `dist_rl:${key}`;
        const ttl = Math.ceil(options.windowMs / 1000);

        // Use Redis pipeline for atomic operations
        const current = await this.incr(redisKey);

        if (current === 1) {
          // First request in window, set expiration
          await this.expire(redisKey, ttl);
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
        // If Redis is not ready, skip rate limiting
        if (!this.isReady()) {
          logger.warn("Redis not ready, skipping adaptive rate limit");
          return next();
        }

        const key = req.user?.userId || req.ip;
        const redisKey = `adaptive:${key}`;

        // Get system metrics to determine current load
        const metrics = this.getMetrics();
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
   * Get Redis metrics
   */
  getMetrics() {
    const hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits /
            (this.metrics.cacheHits + this.metrics.cacheMisses)) *
          100
        : 0;

    return {
      ...this.metrics,
      hitRate: hitRate.toFixed(2) + "%",
      isConnected: this.isConnected,
      uptime: process.uptime(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      connections: 0,
      slowQueries: 0,
    };
  }

  /**
   * Close Redis connection
   */
  async quit() {
    try {
      this.stopHealthCheck();

      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        this.isReady = false;
        this.connectionPromise = null;

        if (this.config.enableLogging) {
          logger.info("Redis connection closed");
        }
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error("Error closing Redis connection", { error: error.message });
      throw error;
    }
  }

  /**
   * Flush database (use with caution)
   */
  async flushdb() {
    try {
      await this.client.flushDb();
      if (this.config.enableLogging) {
        logger.warn("Redis database flushed");
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis FLUSHDB failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Get Redis info
   */
  async info(section = null) {
    try {
      const result = await this.client.info(section);
      this.metrics.totalRequests++;
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis INFO failed", { error: error.message, section });
      throw error;
    }
  }

  /**
   * Monitor Redis operations (for debugging)
   */
  async monitor() {
    if (!this.config.monitoring.enabled) {
      throw new Error("Monitoring is not enabled in configuration");
    }

    try {
      await this.client.monitor();
      if (this.config.enableLogging) {
        logger.info("Redis monitoring started");
      }
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis MONITOR failed", { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new RedisClient();

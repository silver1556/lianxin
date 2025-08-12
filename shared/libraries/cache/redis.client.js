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

      // Connect if not lazy
      if (!this.config.lazyConnect) {
        await this.client.connect();
      }

      // Test connection
      await this.ping();

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
        lazyConnect: this.config.lazyConnect,
      },
      password: this.config.password,
      database: this.config.db,
    };

    // Add TLS configuration if enabled
    if (this.config.enableTLS && this.config.tls) {
      options.socket.tls = this.config.tls;
    }

    // Add retry strategy
    if (this.config.maxRetriesPerRequest > 0) {
      options.socket.retryStrategy = (retries) => {
        if (retries >= this.config.maxRetriesPerRequest) {
          return new Error("Max retries reached");
        }
        const delay = this.config.retryDelayOnFailover * Math.min(retries, 10);

        if (this.config.enableLogging) {
          logger.warn(
            `Redis retry attempt #${retries}, retrying in ${delay}ms`
          );
        }
        return delay;
      };
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

      if (
        this.config.enableLogging &&
        ["debug", "info", "warn", "error"].includes(this.config.logLevel)
      ) {
        logger.info("Redis client connected");
      }
    });

    this.client.on("ready", () => {
      if (
        this.config.enableLogging &&
        ["debug", "info"].includes(this.config.logLevel)
      ) {
        logger.info("Redis client is ready");
      }
    });

    this.client.on("error", (err) => {
      this.isConnected = false;
      this.metrics.errors++;
      logger.error("Redis client error", { error: err.message });

      // Trigger alerts if monitoring is enabled
      if (this.config.monitoring.alerts.enabled) {
        this._checkAlerts();
      }
    });

    this.client.on("end", () => {
      this.isConnected = false;
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
   * Test Redis connection
   */
  async ping() {
    try {
      const start = Date.now();
      const result = await this.client.ping();
      const duration = Date.now() - start;

      this.metrics.totalRequests++;

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis ping successful", { result, duration });
      }
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis ping failed", { error: error.message });
      throw error;
    }
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
    try {
      const start = Date.now();
      const prefixedKey = this._generateKey(key);
      const serializedValue = this._serialize(value);

      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, serializedValue);
      } else {
        await this.client.set(prefixedKey, serializedValue);
      }

      this.metrics.totalRequests++;
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
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis SET failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Get value by key
   */
  async get(key) {
    try {
      const start = Date.now();
      const prefixedKey = this._generateKey(key);
      const value = await this.client.get(prefixedKey);

      this.metrics.totalRequests++;
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
    } catch (error) {
      this.metrics.errors++;
      this.metrics.cacheMisses++;
      logger.error("Redis GET failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Delete key
   */
  async del(key) {
    try {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.del(prefixedKey);

      this.metrics.totalRequests++;

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis DEL operation", {
          key: prefixedKey,
          deleted: result,
        });
      }
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis DEL failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.exists(prefixedKey);
      this.metrics.totalRequests++;
      return result === 1;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis EXISTS failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Set expiration for key in seconds
   */
  async expire(key, ttl) {
    try {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.expire(prefixedKey, ttl);

      this.metrics.totalRequests++;

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis EXPIRE operation", {
          key: prefixedKey,
          ttl,
          success: result,
        });
      }
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis EXPIRE failed", { error: error.message, key, ttl });
      throw error;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      const prefixedKeys = keys.map((key) => this._generateKey(key));
      const values = await this.client.mGet(prefixedKeys);

      this.metrics.totalRequests++;

      return values.map((value) => {
        if (value === null) {
          this.metrics.cacheMisses++;
          return null;
        }
        this.metrics.cacheHits++;
        return this._deserialize(value);
      });
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis MGET failed", { error: error.message, keys });
      throw error;
    }
  }

  /**
   * Increment counter for key
   */
  async incr(key) {
    try {
      const prefixedKey = this._generateKey(key);
      const result = await this.client.incr(prefixedKey);

      this.metrics.totalRequests++;

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis INCR operation", {
          key: prefixedKey,
          value: result,
        });
      }
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis INCR failed", { error: error.message, key });
      throw error;
    }
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
   * Get connection status
   */
  isReady() {
    return this.isConnected && this.client && this.client.isReady;
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

// shared/libraries/cache/redis.client.js

const { createClient, createCluster } = require("redis");
const zlib = require("zlib");
const crypto = require("crypto");
const logger = require("../../utils/logger.util");
const redisConfig = require("./redis.config");

/**
 * Redis Client Manager
 * Handles Redis connections, caching, session management, and monitoring
 */
class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
    this.healthCheckInterval = null;
    this.reconnectAttempts = 0;

    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      connections: 0,
      slowQueries: 0,
      startTime: Date.now(),
      lastResetTime: Date.now(),
      commandCounts: new Map(), // Track individual command usage
      responseTimes: [], // Track response times for better averages
      maxResponseTime: 0,
      minResponseTime: Infinity,
      errorsByType: new Map(), // Track different error types
      memoryUsage: {
        peak: 0,
        current: 0,
        compressionSaved: 0,
      },
      networkStats: {
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0,
      },
    };

    this.config = redisConfig;
    this._bindMethods();
  }

  /**
   * Bind methods to preserve context
   */
  _bindMethods() {
    this.connect = this.connect.bind(this);
    this.quit = this.quit.bind(this);
    this.isReady = this.isReady.bind(this);
    this.ping = this.ping.bind(this);
    this.startHealthCheck = this.startHealthCheck.bind(this);
    this.stopHealthCheck = this.stopHealthCheck.bind(this);
  }

  /**
   * Unified metrics tracking method
   */
  _updateMetrics(type, data = {}) {
    switch (type) {
      case "increment":
        if (typeof this.metrics[data.metric] === "number") {
          this.metrics[data.metric] += data.value || 1;
        }
        break;
      case "command":
        {
          const current = this.metrics.commandCounts.get(data.command) || 0;
          this.metrics.commandCounts.set(data.command, current + 1);
        }
        break;
      case "response_time":
        if (this.metrics.responseTimes.length >= 1000) {
          this.metrics.responseTimes.shift();
        }
        this.metrics.responseTimes.push({
          duration: data.duration,
          timestamp: Date.now(),
          command: data.command,
        });
        this.metrics.maxResponseTime = Math.max(
          this.metrics.maxResponseTime,
          data.duration
        );
        this.metrics.minResponseTime = Math.min(
          this.metrics.minResponseTime,
          data.duration
        );
        break;
      case "error":
        {
          this.metrics.errors++;
          const errorType =
            data.error.code || data.error.name || "UNKNOWN_ERROR";
          const errorCount = this.metrics.errorsByType.get(errorType) || 0;
          this.metrics.errorsByType.set(errorType, errorCount + 1);

          logger.error("Redis error tracked", {
            errorType,
            command: data.command,
            message: data.error.message,
            totalErrors: this.metrics.errors,
          });
        }
        break;
    }
  }

  /**
   * Check if Redis is ready
   */
  isReady() {
    return !!(this.client && this.client.isReady && this.isConnected);
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
      logger.info("Initializing Redis client...", {
        host: this.config.host,
        port: this.config.port,
        cluster: this.config.cluster.enabled,
        environment: this.config.environment,
      });

      const options = this._buildClientOptions();

      // If cluster enabled then create cluster, otherwise create standard one
      this.client = this.config.cluster.enabled
        ? createCluster({
            rootNodes: this.config.cluster.nodes,
            defaults: options,
            useReplicas: this.config.cluster.scaleReads === "slave",
            maxRedirections: this.config.cluster.maxRedirections,
            enableOfflineQueue: this.config.cluster.enableOfflineQueue,
            enableReadyCheck: this.config.cluster.enableReadyCheck,
          })
        : createClient(options);

      // Register event listeners before connecting
      this._registerEventListeners();

      // Connect with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Redis connection timeout")),
          this.config.connectTimeout
        )
      );

      await Promise.race([connectPromise, timeoutPromise]);

      // Wait for ready state with timeout
      await this._waitForReady(this.config.connectTimeout);

      // Test connection functionality
      await this._testConnection();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      this._updateMetrics("increment", { metric: "connections" });

      // Start health monitoring if enabled
      if (this.config.health.enabled) {
        this.startHealthCheck();
      }

      logger.info("Redis connection established successfully", {
        host: this.config.host,
        port: this.config.port,
        cluster: this.config.cluster.enabled,
        database: this.config.db,
        tls: this.config.enableTLS,
        totalConnections: this.metrics.connections,
      });

      return this.client;
    } catch (error) {
      this._updateMetrics("error", { error, command: "CONNECT" });
      this.isConnected = false;
      this.connectionPromise = null;

      logger.error("Failed to connect to Redis", {
        error: error.message,
        stack: error.stack,
        config: {
          host: this.config.host,
          port: this.config.port,
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
    const pollInterval = 100;

    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (Date.now() - startTime > timeout) {
          reject(
            new Error("Redis client failed to reach ready state within timeout")
          );
          return;
        }

        // Check if client is ready (Redis client property, not method)
        if (this.client && this.client.isReady) {
          this.isConnected = true;
          resolve();
          return;
        }

        setTimeout(checkReady, pollInterval);
      };

      checkReady();
    });
  }

  /**
   * Test Redis connection with a simple command
   */
  async _testConnection() {
    const testStart = Date.now();

    try {
      // Test ping
      const pingResult = await this.client.ping();
      if (pingResult !== "PONG") {
        throw new Error(`Unexpected ping response: ${pingResult}`);
      }

      // Test basic set/get operations
      const testKey = `__connection_test_${Date.now()}`;
      const testValue = { test: "ok", timestamp: new Date().toISOString() };

      await this.client.set(testKey, JSON.stringify(testValue));
      const retrievedValue = await this.client.get(testKey);
      await this.client.del(testKey);

      if (!retrievedValue) {
        throw new Error("Redis set/get test failed - no value retrieved");
      }

      const parsed = JSON.parse(retrievedValue);
      if (parsed.test !== "ok") {
        throw new Error("Redis set/get test failed - incorrect value");
      }

      this._updateMetrics("response_time", {
        duration: Date.now() - testStart,
        command: "CONNECTION_TEST",
      });

      logger.info("Redis connection test successful", {
        duration: Date.now() - testStart,
      });
    } catch (error) {
      this._updateMetrics("error", { error, command: "CONNECTION_TEST" });
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
        family: this.config.family || 4, // IPv4 by default
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        keepAlive: this.config.keepAlive,
        reconnectStrategy: (retries) => {
          if (retries >= this.config.maxRetriesPerRequest) {
            logger.warn("Max Redis reconnection attempts reached", { retries });
            return false; // Stop reconnecting
          }

          const delay = Math.min(
            retries * this.config.retryDelayOnFailover,
            5000
          );
          logger.info("Redis reconnection attempt", { retries, delay });
          return delay;
        },
      },
      password: this.config.password,
      database: this.config.db,
    };

    // Add TLS configuration if enabled
    if (this.config.enableTLS && this.config.tls) {
      options.socket.tls = this.config.tls;
      logger.info("Redis TLS enabled", {
        servername: this.config.tls.servername,
        rejectUnauthorized: this.config.tls.rejectUnauthorized,
      });
    }

    return options;
  }

  /**
   * Register event listeners for Redis client
   */
  _registerEventListeners() {
    if (!this.client) return;

    this.client.on("connect", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info("Redis client connected", {
        connections: this.metrics.connections,
      });
    });

    this.client.on("ready", () => {
      logger.info("Redis client is ready for commands");
    });

    this.client.on("error", (err) => {
      this.isConnected = false;
      this._updateMetrics("error", { error: err });

      logger.error("Redis client error", {
        error: err.message,
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
        totalErrors: this.metrics.errors,
      });

      // Reset connection promise on error to allow reconnection
      this.connectionPromise = null;

      // Trigger alerts if monitoring is enabled
      if (this.config.monitoring.alerts.enabled) {
        this._checkAlerts();
      }
    });

    this.client.on("end", () => {
      this.isConnected = false;
      logger.info("Redis client connection ended");
    });

    this.client.on("reconnecting", () => {
      this.reconnectAttempts++;
      logger.info("Redis client reconnecting", {
        attempt: this.reconnectAttempts,
      });
    });

    // Handle cluster-specific events if using cluster
    if (this.config.cluster.enabled) {
      this.client.on("shardError", (error, shard) => {
        this._updateMetrics("error", { error, command: "SHARD_ERROR" });
        logger.error("Redis cluster shard error", {
          error: error.message,
          shard: shard.options,
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

    logger.info("Starting Redis health check monitoring", {
      interval: `${this.config.health.interval}ms`,
      timeout: this.config.health.timeout,
    });

    this.healthCheckInterval = setInterval(async () => {
      try {
        const result = await this._performHealthCheck();

        if (this.config.logLevel === "debug" || result.status !== "healthy") {
          logger.info("Health check completed", {
            status: result.status,
            responseTime: result.responseTime,
            error: result.error,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error("Health check interval error", {
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }, this.config.health.interval);

    // Run initial health check immediately
    setTimeout(async () => {
      try {
        const result = await this._performHealthCheck();
        logger.info("Redis initial health check completed", {
          status: result.status,
          responseTime: result.responseTime,
        });
      } catch (error) {
        logger.error("Redis initial health check failed", {
          error: error.message,
        });
      }
    }, this.config.health.timeout);
  }

  /**
   * Unified health check with automatic reconnection
   */
  async _performHealthCheck() {
    const healthCheckStart = Date.now();

    try {
      // If not ready, attempt reconnection once
      if (!this.isReady()) {
        logger.warn(
          "Redis health check - client not ready, attempting reconnection"
        );

        try {
          await this._attemptReconnection();

          // Check again after reconnection attempt
          if (!this.isReady()) {
            logger.error(
              "Redis health check - reconnection failed, client still not ready"
            );
            return {
              status: "unhealthy",
              error: "Redis not connected and reconnection failed",
              responseTime: Date.now() - healthCheckStart,
            };
          }

          logger.info("Redis health check - reconnection successful");
        } catch (reconnectionError) {
          logger.error("Redis health check - reconnection attempt failed", {
            error: reconnectionError.message,
          });
          return {
            status: "unhealthy",
            error: `Redis reconnection failed: ${reconnectionError.message}`,
            responseTime: Date.now() - healthCheckStart,
          };
        }
      }

      // At this point, Redis should be ready
      // Basic ping test with timeout
      const pingResult = await Promise.race([
        this.client.ping(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Redis health check timeout")),
            this.config.health.timeout
          )
        ),
      ]);

      const latency = Date.now() - healthCheckStart;
      this._updateMetrics("response_time", {
        duration: latency,
        command: "HEALTH_CHECK",
      });

      // Check latency alerts
      if (
        this.config.monitoring.alerts.enabled &&
        latency > this.config.monitoring.alerts.latencyThreshold
      ) {
        logger.warn("Redis high latency detected", { latency });
      }

      // Additional health checks
      if (this.config.health.commands && this.config.health.commands.info) {
        const infoStart = Date.now();
        await this.client.info("server");
        this._updateMetrics("response_time", {
          duration: Date.now() - infoStart,
          command: "INFO",
        });
      }

      if (this.config.health.commands && this.config.health.commands.memory) {
        const memoryStart = Date.now();
        const memoryInfo = await this.client.info("memory");
        this._updateMetrics("response_time", {
          duration: Date.now() - memoryStart,
          command: "MEMORY_INFO",
        });
        this._checkMemoryUsage(memoryInfo);
      }

      if (this.config.logLevel === "debug") {
        logger.debug("Redis health check passed", {
          latency,
          result: pingResult,
          totalRequests: this.metrics.totalRequests,
        });
      }

      return { status: "healthy", responseTime: latency };
    } catch (error) {
      this._updateMetrics("error", { error, command: "HEALTH_CHECK" });

      logger.error("Redis health check failed", {
        error: error.message,
        duration: Date.now() - healthCheckStart,
        totalErrors: this.metrics.errors,
      });

      return {
        status: "unhealthy",
        error: error.message,
        responseTime: Date.now() - healthCheckStart,
      };
    }
  }

  /**
   * Check memory usage from Redis info
   */
  _checkMemoryUsage(memoryInfo) {
    try {
      const usedMemoryMatch = memoryInfo.match(/used_memory:(\d+)/);
      const maxMemoryMatch = memoryInfo.match(/maxmemory:(\d+)/);

      if (usedMemoryMatch) {
        const usedMemory = parseInt(usedMemoryMatch[1], 10);
        this.metrics.memoryUsage.current = usedMemory;

        if (usedMemory > this.metrics.memoryUsage.peak) {
          this.metrics.memoryUsage.peak = usedMemory;
        }

        if (maxMemoryMatch) {
          const maxMemory = parseInt(maxMemoryMatch[1], 10);
          const memoryUsagePercent = (usedMemory / maxMemory) * 100;

          if (
            this.config.monitoring.alerts.enabled &&
            memoryUsagePercent > this.config.monitoring.alerts.memoryThreshold
          ) {
            logger.warn("Redis memory threshold exceeded", {
              usedMemory,
              maxMemory,
              usagePercent: memoryUsagePercent.toFixed(2),
            });
          }
        }
      }
    } catch (error) {
      this._updateMetrics("error", { error, command: "MEMORY_CHECK" });
      logger.error("Failed to parse Redis memory info", {
        error: error.message,
      });
    }
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info("Redis health check monitoring stopped");
    }
  }

  /**
   * Attempt to reconnect Redis (improved version)
   */
  async _attemptReconnection() {
    try {
      logger.info("Attempting Redis reconnection...");

      // Clean up existing client if it exists
      if (this.client) {
        try {
          if (this.client.isReady) {
            await this.client.disconnect();
          }
        } catch (disconnectError) {
          logger.warn("Error during disconnect in reconnection redis", {
            error: disconnectError.message,
          });
        }
      }

      // Reset connection state
      this.isConnected = false;
      this.connectionPromise = null;
      this.client = null;

      // Attempt new connection
      await this.connect();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      logger.info("Redis reconnection successful");
      return true;
    } catch (error) {
      this.reconnectAttempts++;
      this._updateMetrics("error", { error, command: "RECONNECTION" });

      logger.error("Redis reconnection failed", {
        error: error.message,
        attempt: this.reconnectAttempts,
      });

      throw error;
    }
  }

  /**
   * Check monitoring alerts
   */
  _checkAlerts() {
    if (!this.config.monitoring.alerts.enabled) return;

    const { connectionThreshold } = this.config.monitoring.alerts;

    if (this.metrics.connections > connectionThreshold) {
      logger.warn("Redis connection threshold exceeded", {
        current: this.metrics.connections,
        threshold: connectionThreshold,
      });
    }

    // Check error rate
    const totalRequests = this.metrics.totalRequests;
    if (totalRequests > 100) {
      // Only check after some requests
      const errorRate = (this.metrics.errors / totalRequests) * 100;
      if (errorRate > 5) {
        // 5% error rate threshold
        logger.warn("Redis error rate threshold exceeded 5%", {
          errorRate: errorRate.toFixed(2),
          errors: this.metrics.errors,
          totalRequests,
        });
      }
    }
  }

  /**
   * Execute Redis command with connection check and error handling
   */
  async _executeCommand(commandName, commandFn) {
    if (!this.isReady()) {
      const error = new Error(`Redis not ready for command: ${commandName}`);
      this._updateMetrics("error", { error, command: commandName });

      throw error;
    }

    const start = Date.now();

    try {
      this._updateMetrics("command", { command: commandName });
      this._updateMetrics("increment", { metric: "totalRequests" });

      const result = await commandFn();
      const duration = Date.now() - start;

      this._updateMetrics("response_time", { duration, command: commandName });

      // Log slow queries if enabled
      if (
        this.config.monitoring.slowLogEnabled &&
        duration > this.config.monitoring.slowLogThreshold
      ) {
        this._updateMetrics("increment", { metric: "slowQueries" });
        logger.warn("Redis slow query detected", {
          command: commandName,
          duration,
          threshold: this.config.monitoring.slowLogThreshold,
        });
      }

      return result;
    } catch (error) {
      this._updateMetrics("error", { error, command: commandName });
      logger.error(`Redis ${commandName} command failed`, {
        error: error.message,
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  /**
   * Test Redis connection - used by health checks
   */
  async ping() {
    return this._executeCommand("PING", async () => {
      const result = await this.client.ping();

      if (this.config.logLevel === "debug") {
        logger.debug("Redis ping successful", { result });
      }

      return result;
    });
  }

  /**
   * Serialize value with optional compression and encryption
   */
  _serialize(value, shouldCompress = true, shouldEncrypt = true) {
    try {
      let serialized = JSON.stringify(value);
      const originalSize = serialized.length;

      // Apply compression if enabled and data meets threshold
      if (
        this.config.cache.compression.enabled &&
        serialized.length > this.config.cache.compression.threshold &&
        shouldCompress
      ) {
        serialized = this._compress(serialized);

        const savedSize = originalSize - serialized.length;
        this.metrics.memoryUsage.compressionSaved += savedSize;

        if (this.config.logLevel === "debug") {
          const compressionRatio = ((savedSize / originalSize) * 100).toFixed(
            2
          );
          logger.debug("Data compressed", {
            algorithm: this.config.cache.compression.algorithm,
            originalSize,
            compressedSize: serialized.length,
            compressionRatio: `${compressionRatio}%`,
          });
        }
      }

      // Apply encryption if enabled
      if (this.config.cache.serialization.enableEncryption && shouldEncrypt) {
        serialized = this._encrypt(serialized);
      }

      return serialized;
    } catch (error) {
      this._updateMetrics("error", { error, command: "SERIALIZE" });
      logger.error("Redis serialization failed", { error: error.message });
      throw new Error(`Serialization failed: ${error.message}`);
    }
  }

  /**
   * Compression helper
   */
  _compress(data) {
    const buffer = Buffer.from(data);

    switch (this.config.cache.compression.algorithm) {
      case "gzip":
        return zlib.gzipSync(buffer).toString("base64");
      case "deflate":
        return zlib.deflateSync(buffer).toString("base64");
      case "br":
        if (zlib.brotliCompressSync) {
          return zlib.brotliCompressSync(buffer).toString("base64");
        }
        return data;
      default:
        return data;
    }
  }

  /**
   * Encryption helper
   */
  _encrypt(data) {
    const encryptionKey =
      process.env.REDIS_ENCRYPTION_KEY ||
      "default-redis-key-change-in-production";
    const algorithm = "aes-256-gcm";
    const key = crypto.scryptSync(encryptionKey, "redis-salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      algorithm,
      __encrypted: true,
    });
  }

  /**
   * Unified deserialization with decompression and decryption
   */
  _deserialize(serializedValue) {
    try {
      let value = serializedValue;

      // Decryption
      if (this.config.cache.serialization.enableEncryption) {
        value = this._decrypt(value) || value;
      }

      // Decompression
      if (this.config.cache.compression.enabled) {
        value = this._decompress(value) || value;
      }

      return JSON.parse(value);
    } catch (error) {
      logger.warn("Redis deserialization failed", { error: error.message });
      // Return original value if deserialization fails
      return serializedValue;
    }
  }

  /**
   * Decompression helper
   */
  _decompress(value) {
    try {
      //check if compressed first, then decompress
      if (typeof value === "string" && /^[A-Za-z0-9+/]+=*$/.test(value)) {
        const buffer = Buffer.from(value, "base64");

        switch (this.config.cache.compression.algorithm) {
          case "gzip":
            if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
              return zlib.gunzipSync(buffer).toString("utf8");
            }
            break;
          case "deflate":
            return zlib.inflateSync(buffer).toString("utf8");
          case "br":
            if (zlib.brotliDecompressSync) {
              return zlib.brotliDecompressSync(buffer).toString("utf8");
            }
            break;
        }
      }
      return null; // value was not compressed
    } catch (error) {
      this._updateMetrics("error", { error, command: "DECOMPRESS" });
      return null;
    }
  }

  /**
   * Decryption helper
   */
  _decrypt(value) {
    try {
      // check if encrypted first, then decrypt
      const parsed = JSON.parse(value);
      if (
        parsed.__encrypted &&
        parsed.encrypted &&
        parsed.iv &&
        parsed.authTag
      ) {
        const encryptionKey =
          process.env.REDIS_ENCRYPTION_KEY ||
          "default-redis-key-change-in-production";
        const key = crypto.scryptSync(encryptionKey, "redis-salt", 32);
        const iv = Buffer.from(parsed.iv, "hex");
        const authTag = Buffer.from(parsed.authTag, "hex");
        const decipher = crypto.createDecipheriv(parsed.algorithm, key, iv);

        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(parsed.encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      }
      return null; // value was not encrypted
    } catch (error) {
      this._updateMetrics("error", { error, command: "DECRYPT" });
      return null;
    }
  }

  /**
   * Generate cache key with prefix
   */
  _generateKey(key) {
    return `${this.config.cache.keyPrefix}${key}`;
  }

  /**
   * Store a key-value pair in Redis with optional TTL (time-to-live), compression, and encryption.
   *
   * This method wraps the Redis `SET` / `SETEX` commands and ensures values
   * are serialized according to configuration before storage.
   *
   * @async
   * @function set
   * @param {string} key - The logical key to store the value under (will be namespaced internally).
   * @param {*} value - The value to store (objects will be serialized).
   * @param {number|null} [ttl=null] - Optional expiration time in seconds.
   * @param {boolean} [shouldCompress=true] - Whether to compress the value before storing.
   * @param {boolean} [shouldEncrypt=true] - Whether to encrypt the value before storing.
   *
   * @returns {Promise<string>} - Redis response, `"OK"` if the operation succeeded.
   *
   * @throws {Error} If the Redis operation fails or serialization encounters an error.
   */
  async set(
    key,
    value,
    ttl = null,
    shouldCompress = true,
    shouldEncrypt = true
  ) {
    return this._executeCommand("SET", async () => {
      const redisKey = this._generateKey(key);
      const serializedValue = this._serialize(
        value,
        shouldCompress,
        shouldEncrypt
      );

      let result;
      if (ttl) {
        result = await this.client.setEx(redisKey, ttl, serializedValue);
      } else {
        result = await this.client.set(redisKey, serializedValue);
      }

      if (this.config.logLevel === "debug") {
        logger.debug("Redis SET operation", { key: redisKey, ttl });
      }
      return result;
    });
  }

  /**
   * Get value by key
   */
  async get(key) {
    return this._executeCommand("GET", async () => {
      const redisKey = this._generateKey(key);
      const value = await this.client.get(redisKey);

      if (value === null) {
        this._updateMetrics("increment", { metric: "cacheMisses" });
        if (this.config.logLevel === "debug") {
          logger.debug("Redis GET cache miss", { key: redisKey });
        }
        return null;
      }

      this._updateMetrics("increment", { metric: "cacheHits" });
      if (this.config.logLevel === "debug") {
        logger.debug("Redis GET cache hit", { key: redisKey });
      }

      return this._deserialize(value);
    });
  }

  /**
   * Delete key
   */
  async del(key) {
    return this._executeCommand("DEL", async () => {
      const redisKey = this._generateKey(key);
      const result = await this.client.del(redisKey);

      if (this.config.logLevel === "debug") {
        logger.debug("Redis DEL operation", { key: redisKey, deleted: result });
      }

      return result;
    });
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    return this._executeCommand("EXISTS", async () => {
      const redisKey = this._generateKey(key);
      const result = await this.client.exists(redisKey);
      return result === 1;
    });
  }

  /**
   * Set expiration for key in seconds
   */
  async expire(key, ttl) {
    return this._executeCommand("EXPIRE", async () => {
      const redisKey = this._generateKey(key);
      const result = await this.client.expire(redisKey, ttl);

      if (this.config.logLevel === "debug") {
        logger.debug("Redis EXPIRE operation", {
          key: redisKey,
          ttl,
          success: result,
        });
      }

      return result === 1;
    });
  }

  /**
   * Increment counter for key
   */
  async incr(key) {
    return this._executeCommand("INCR", async () => {
      const redisKey = this._generateKey(key);
      const result = await this.client.incr(redisKey);

      if (this.config.logLevel === "debug") {
        logger.debug("Redis INCR operation", { key: redisKey, value: result });
      }

      return result;
    });
  }

  /**
   * Get ttl of a key
   */
  async ttl(key) {
    return this._executeCommand("TTL", async () => {
      const redisKey = this._generateKey(key);
      const result = await this.client.ttl(redisKey);

      if (this.config.logLevel === "debug") {
        logger.debug("Redis TTL operation", { key: redisKey, value: result });
      }

      return result;
    });
  }

  /**
   * Bulk operations
   */
  /**
   * Get multiple keys at once (MGET)
   */
  async mget(keys) {
    return this._executeCommand("MGET", async () => {
      const redisKeys = keys.map((key) => this._generateKey(key));
      const values = await this.client.mGet(redisKeys);

      return values.map((value) => {
        if (value === null) {
          this._updateMetrics("increment", { metric: "cacheMisses" });
          return null;
        }
        this._updateMetrics("increment", { metric: "cacheHits" });
        return this._deserialize(value);
      });
    });
  }

  /**
   * Set multiple keys at once (MSET)
   */
  async mset(keyValuePairs) {
    return this._executeCommand("MSET", async () => {
      const serializedPairs = [];

      for (const [key, value] of keyValuePairs) {
        serializedPairs.push(this._generateKey(key));
        serializedPairs.push(this._serialize(value));
      }

      await this.client.mSet(serializedPairs);

      if (this.config.logLevel === "debug") {
        logger.debug("Redis MSET operation", {
          keys: keyValuePairs.length,
          pairs: keyValuePairs.map(([k]) => k),
        });
      }
    });
  }

  /**
   * Hash operations for complex data structures
   */
  async hset(key, field, value) {
    return this._executeCommand("HSET", async () => {
      const redisKey = this._generateKey(key);
      const serializedValue = this._serialize(value);
      return await this.client.hSet(redisKey, field, serializedValue);
    });
  }

  async hget(key, field) {
    return this._executeCommand("HGET", async () => {
      const redisKey = this._generateKey(key);
      const value = await this.client.hGet(redisKey, field);

      if (value === null) {
        this._updateMetrics("increment", { metric: "cacheMisses" });
        return null;
      }

      this._updateMetrics("increment", { metric: "cacheHits" });
      return this._deserialize(value);
    });
  }

  async hgetall(key) {
    return this._executeCommand("HGETALL", async () => {
      const redisKey = this._generateKey(key);
      const hash = await this.client.hGetAll(redisKey);

      if (Object.keys(hash).length === 0) {
        this._updateMetrics("increment", { metric: "cacheMisses" });
        return null;
      }

      this._updateMetrics("increment", { metric: "cacheHits" });

      // Deserialize all values in the hash
      const deserializedHash = {};
      for (const [field, value] of Object.entries(hash)) {
        deserializedHash[field] = this._deserialize(value);
      }

      return deserializedHash;
    });
  }

  /**
   * List operations for queues and activity feeds
   */
  async lpush(key, ...values) {
    return this._executeCommand("LPUSH", async () => {
      const redisKey = this._generateKey(key);
      const serializedValues = values.map((value) => this._serialize(value));
      return await this.client.lPush(redisKey, serializedValues);
    });
  }

  async rpop(key) {
    return this._executeCommand("RPOP", async () => {
      const redisKey = this._generateKey(key);
      const value = await this.client.rPop(redisKey);

      if (value === null) {
        this._updateMetrics("increment", { metric: "cacheMisses" });
        return null;
      }

      this._updateMetrics("increment", { metric: "cacheHits" });
      return this._deserialize(value);
    });
  }

  async llen(key) {
    return this._executeCommand("LLEN", async () => {
      const redisKey = this._generateKey(key);
      return await this.client.lLen(redisKey);
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

  /**
   * Partially or full cache an object in Redis hash
   * Updates existing fields or creates key if not exists
   * Automatically refreshes TTL on update for hot data
   * Uses _serialize for compression/encryption
   *
   * @param {string} key - key (service name:subservice:uniqueId)
   * @param {object} data - Source object
   * @param {string[]} fields - Fields to cache (if empty, cache all fields)
   * @param {number|null} ttl - TTL in seconds (optional)
   * @param {boolean} shouldCompress - Apply compression per field
   * @param {boolean} shouldEncrypt - Apply encryption per field
   */
  async cachePartialHash(
    key,
    data,
    fields = [],
    ttl = null,
    shouldCompress = true,
    shouldEncrypt = true
  ) {
    const redisData = {};
    const targetFields = fields.length > 0 ? fields : Object.keys(data);

    for (const field of targetFields) {
      if (data[field] !== undefined) {
        // Serialize each field
        redisData[field] = this._serialize(
          data[field],
          shouldCompress,
          shouldEncrypt
        );
      }
    }

    if (Object.keys(redisData).length === 0) return; // Nothing to cache

    const redisKey = this._generateKey(key);

    // Wrap HSET
    await this._executeCommand("HSET", async () =>
      this.client.hSet(redisKey, redisData)
    );

    let ttlValue = ttl;

    // Extract subservice from key
    const subservice = key.split(":")[1];

    // If no TTL provided, check config
    if (
      !ttlValue &&
      Object.prototype.hasOwnProperty.call(this.config.cache.ttl, subservice)
    ) {
      ttlValue = this.config.cache.ttl[subservice];
    }

    // Set TTL if defined
    if (ttlValue) {
      await this._executeCommand("EXPIRE", async () =>
        this.client.expire(redisKey, ttlValue)
      );
    }
  }

  /**
   * Get partial or full object from Redis hash
   * Automatically deserializes fields (with decompression/decryption)
   * Optionally refreshes TTL
   *
   * @param {string} key - key (service name:subservice:uniqueId)
   * @param {number|null} ttl - TTL to refresh (optional)
   * @param {string[]} fields -  Fields to fetch (if empty, fetch all fields)
   * @returns {object} - Partial or full object from hash
   */
  async getPartialHash(key, ttl = null, fields = []) {
    const redisKey = this._generateKey(key);
    let result = {};

    if (fields.length > 0) {
      // Fetch only requested fields
      const values = await this._executeCommand("HMGET", async () =>
        this.client.hmGet(redisKey, fields)
      );

      fields.forEach((field, i) => {
        if (values[i] !== null) {
          result[field] = this._deserialize(values[i]);
        }
      });
    } else {
      // Fetch all fields
      const allFields = await this._executeCommand("HGETALL", async () =>
        this.client.hGetAll(redisKey)
      );

      for (const [field, value] of Object.entries(allFields)) {
        result[field] = this._deserialize(value);
      }
    }

    let ttlValue = ttl;

    // Extract subservice from key
    const subservice = key.split(":")[1];

    // If no TTL provided, check config
    if (
      !ttlValue &&
      Object.prototype.hasOwnProperty.call(this.config.cache.ttl, subservice)
    ) {
      ttlValue = this.config.cache.ttl[subservice];
    }

    // Refresh TTL if defined
    if (Object.keys(result).length > 0 && ttlValue) {
      await this._executeCommand("EXPIRE", async () =>
        this.client.expire(redisKey, ttlValue)
      );
    }

    return result;
  }

  /**
   * Cache user profile data in Redis
   * Supports two modes: "hot" (long-lived) and "full" (short-lived)
   *
   * @param {string|number} userId - User ID
   * @param {object} profileData - Profile data object
   * @param {"hot"|"full"} mode - Cache mode
   */
  async cacheUserProfile(userId, profileData, mode = "full") {
    if (!["hot", "full"].includes(mode)) {
      throw new Error(`Invalid cache mode: ${mode}`);
    }

    // Redis key format
    const redisKey = `user:profile:${userId}:${mode}`;

    // Decide which fields to store
    let fieldsToCache = {};
    if (mode === "hot") {
      fieldsToCache = [
        "display_name",
        "avatar_url",
        "gender",
        "birth_date",
        "is_verified",
      ];
    } else {
      fieldsToCache = []; // empty → cache all fields (handled by cachePartialHash)
    }

    // TTL based on mode
    const ttlValue =
      mode === "hot"
        ? this.config.cache.ttl.userProfileHot // default 6h
        : this.config.cache.ttl.userProfileFull; // default 1h

    // Delegate to cachePartialHash
    await this.cachePartialHash(redisKey, profileData, fieldsToCache, ttlValue);
  }

  /**
   * Get user profile from Redis (hot or full cache)
   * Falls back to DB if cache miss
   *
   * @param {string|number} userId - User ID
   * @param {"hot"|"full"} mode - Cache mode
   * @returns {object|null} User profile data
   */
  async getUserProfile(userId, mode = "full") {
    if (!["hot", "full"].includes(mode)) {
      throw new Error(`Invalid cache mode: ${mode}`);
    }

    const redisKey = `user:profile:${userId}:${mode}`;

    // Hot fields are limited; full means fetch all
    let fieldsToGet = [];
    if (mode === "hot") {
      fieldsToGet = [
        "display_name",
        "avatar_url",
        "gender",
        "birth_date",
        "is_verified",
      ];
    } else {
      fieldsToGet = []; // empty → get all fields
    }

    // Use getPartialHash helper
    return await this.getPartialHash(redisKey, fieldsToGet);
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
   * Get Redis metrics for monitoring
   */
  getMetrics() {
    const totalCacheRequests =
      this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate =
      totalCacheRequests > 0
        ? (this.metrics.cacheHits / totalCacheRequests) * 100
        : 0;
    const uptime = Date.now() - this.metrics.startTime;

    // Calculate response time statistics
    const responseTimes = this.metrics.responseTimes.map((rt) => rt.duration);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    // Calculate percentiles for response times
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p50 =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.5)]
        : 0;
    const p95 =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
        : 0;
    const p99 =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.99)]
        : 0;

    // Calculate error rate
    const errorRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.errors / this.metrics.totalRequests) * 100
        : 0;

    // Get top commands by usage
    const topCommands = Array.from(this.metrics.commandCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Get error breakdown
    const errorBreakdown = Object.fromEntries(this.metrics.errorsByType);

    return {
      // Basic counters
      totalRequests: this.metrics.totalRequests,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      errors: this.metrics.errors,
      connections: this.metrics.connections,
      slowQueries: this.metrics.slowQueries,

      // Calculated metrics
      hitRate: `${hitRate.toFixed(2)}%`,
      errorRate: `${errorRate.toFixed(2)}%`,

      // Connection status
      isConnected: this.isConnected,
      isReady: this.isReady(),

      // Time metrics
      uptime: Math.floor(uptime / 1000), // in seconds
      uptimeHuman: this._formatUptime(uptime),
      startTime: new Date(this.metrics.startTime).toISOString(),
      lastResetTime: new Date(this.metrics.lastResetTime).toISOString(),

      // Response time metrics
      averageResponseTime: Math.round(averageResponseTime),
      minResponseTime:
        this.metrics.minResponseTime === Infinity
          ? 0
          : this.metrics.minResponseTime,
      maxResponseTime: this.metrics.maxResponseTime,
      responseTimePercentiles: {
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
      },

      // Memory metrics
      memoryUsage: this.metrics.memoryUsage,

      // Network stats (if available)
      networkStats: this.metrics.networkStats,

      // Command usage
      topCommands: topCommands.map(([cmd, count]) => ({ command: cmd, count })),
      totalCommands: this.metrics.commandCounts.size,

      // Error breakdown
      errorsByType: errorBreakdown,

      // Performance indicators
      requestsPerSecond:
        uptime > 0
          ? Math.round((this.metrics.totalRequests / uptime) * 1000)
          : 0,
      reconnectionAttempts: this.reconnectAttempts,

      // Health indicators
      healthStatus: this._getHealthStatus(),
    };
  }

  /**
   * Format uptime in human readable format
   */
  _formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Get overall health status based on metrics
   */
  _getHealthStatus() {
    if (!this.isReady()) {
      return "CRITICAL";
    }

    const errorRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.errors / this.metrics.totalRequests) * 100
        : 0;

    const avgResponseTime =
      this.metrics.responseTimes.length > 0
        ? this.metrics.responseTimes.reduce((sum, rt) => sum + rt.duration, 0) /
          this.metrics.responseTimes.length
        : 0;

    // Critical conditions
    if (errorRate > 10 || avgResponseTime > 5000 || this.reconnectAttempts > 3)
      return "CRITICAL";

    // Warning conditions
    if (errorRate > 5 || avgResponseTime > 2000 || this.reconnectAttempts > 0)
      return "WARNING";

    // Check cache hit rate
    const totalCacheRequests =
      this.metrics.cacheHits + this.metrics.cacheMisses;
    if (totalCacheRequests > 100) {
      const hitRate = (this.metrics.cacheHits / totalCacheRequests) * 100;
      if (hitRate < 50) return "WARNING";
    }

    return "HEALTHY";
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    const previousMetrics = { ...this.metrics };

    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      connections: this.metrics.connections, // Keep connection count
      slowQueries: 0,
      startTime: this.metrics.startTime, // Keep original start time
      lastResetTime: Date.now(), // Track when reset occurred
      commandCounts: new Map(),
      responseTimes: [],
      maxResponseTime: 0,
      minResponseTime: Infinity,
      errorsByType: new Map(),
      memoryUsage: {
        peak: this.metrics.memoryUsage.peak, // Keep peak memory
        current: this.metrics.memoryUsage.current,
        compressionSaved: 0, // Reset compression savings
      },
      networkStats: {
        bytesReceived: 0,
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0,
      },
    };

    logger.info("Redis metrics reset", {
      previousTotalRequests: previousMetrics.totalRequests,
      previousErrors: previousMetrics.errors,
      previousHitRate:
        previousMetrics.totalRequests > 0
          ? (
              (previousMetrics.cacheHits /
                (previousMetrics.cacheHits + previousMetrics.cacheMisses)) *
              100
            ).toFixed(2) + "%"
          : "0%",
      resetTime: new Date().toISOString(),
    });
  }

  /**
   * Get detailed metrics for specific time windows
   */
  getMetricsWindow(windowMinutes = 5) {
    const windowMs = windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;

    // Filter response times within the window
    const recentResponses = this.metrics.responseTimes.filter(
      (rt) => rt.timestamp > cutoff
    );

    if (recentResponses.length === 0) {
      return {
        window: `${windowMinutes} minutes`,
        requests: 0,
        averageResponseTime: 0,
        requestsPerMinute: 0,
      };
    }

    const totalResponseTime = recentResponses.reduce(
      (sum, rt) => sum + rt.duration,
      0
    );
    const avgResponseTime = totalResponseTime / recentResponses.length;
    const requestsPerMinute = recentResponses.length / windowMinutes;

    return {
      window: `${windowMinutes} minutes`,
      requests: recentResponses.length,
      averageResponseTime: Math.round(avgResponseTime),
      requestsPerMinute: Math.round(requestsPerMinute),
      commands: this._getCommandBreakdown(recentResponses),
    };
  }

  /**
   * Get command breakdown from response time data
   */
  _getCommandBreakdown(responses) {
    const commandCounts = new Map();
    responses.forEach((rt) => {
      if (rt.command) {
        const current = commandCounts.get(rt.command) || 0;
        commandCounts.set(rt.command, current + 1);
      }
    });

    return Array.from(commandCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([command, count]) => ({ command, count }));
  }

  /**
   * Close Redis connection gracefully with proper cleanup
   */
  async quit() {
    try {
      logger.info("Closing Redis connection...", {
        totalRequests: this.metrics.totalRequests,
        uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000),
        errors: this.metrics.errors,
      });

      this.stopHealthCheck();

      if (this.client && this.client.isReady) {
        await this.client.quit();
        logger.info("Redis connection closed successfully");
      }

      this.isConnected = false;
      this.connectionPromise = null;
      this.client = null;
    } catch (error) {
      this._updateMetrics("error", { error, command: "QUIT" });
      logger.error("Error closing Redis connection", { error: error.message });

      // Force disconnect if quit fails
      if (this.client) {
        try {
          await this.client.disconnect();
        } catch (disconnectError) {
          logger.error("Error force disconnecting Redis", {
            error: disconnectError.message,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Flush database (use with extreme caution)
   */
  async flushdb() {
    return this._executeCommand("FLUSHDB", async () => {
      await this.client.flushDb();

      // Reset relevant metrics since database is flushed
      this.metrics.cacheHits = 0;
      this.metrics.cacheMisses = 0;

      logger.warn("Redis database flushed", {
        timestamp: new Date().toISOString(),
        requestsBeforeFlush: this.metrics.totalRequests,
      });
    });
  }

  /**
   * Get Redis info
   */
  async info(section = null) {
    return this._executeCommand("INFO", async () => {
      return await this.client.info(section);
    });
  }

  /**
   * Unified rate limiter factory
   */
  _createRateLimit(type, options) {
    return async (req, res, next) => {
      const rateLimitStart = Date.now();

      try {
        if (!this.isReady()) {
          logger.warn(`Redis not ready, skipping ${type} rate limit`, {
            requestId: req.requestId,
          });
          return next();
        }

        const key = options.keyGenerator
          ? options.keyGenerator(req)
          : req.user?.userId || req.ip;

        let result;

        switch (type) {
          case "sliding":
            result = await this._slidingWindowLimit(key, options);
            break;
          case "burst":
            result = await this._burstLimit(key, options);
            break;
          case "distributed":
            result = await this._distributedLimit(key, options);
            break;
          case "adaptive":
            result = await this._adaptiveLimit(key, options);
            break;
        }

        this._updateMetrics("response_time", {
          duration: Date.now() - rateLimitStart,
          command: `RATE_LIMIT_${type.toUpperCase()}`,
        });

        if (result.blocked) {
          logger.warn(`${type} rate limit exceeded`, {
            key,
            requests: result.current,
            max: result.max,
            requestId: req.requestId,
          });

          return res.status(429).json({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: result.message || "Too many requests",
            },
            timestamp: new Date().toISOString(),
            request_id: req.requestId,
            retryAfter: result.retryAfter,
          });
        }

        // Add rate limit headers if provided
        if (result.headers) {
          res.set(result.headers);
        }

        next();
      } catch (error) {
        this._updateMetrics("error", {
          error,
          command: `RATE_LIMIT_${type.toUpperCase()}`,
        });
        logger.error(`${type} rate limiter error`, {
          error: error.message,
          requestId: req.requestId,
        });
        next(); // Continue on error
      }
    };
  }

  /**
   * Sliding window rate limit implementation
   */
  async _slidingWindowLimit(key, options) {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const redisKey = `sliding:${key}`;

    const currentRequests = (await this.get(redisKey)) || [];
    const validRequests = currentRequests.filter(
      (timestamp) => timestamp > windowStart
    );

    if (validRequests.length >= options.max) {
      return {
        blocked: true,
        current: validRequests.length,
        max: options.max,
        retryAfter: Math.ceil(options.windowMs / 1000),
        message: options.message,
      };
    }

    validRequests.push(now);
    await this.set(redisKey, validRequests, Math.ceil(options.windowMs / 1000));

    return { blocked: false };
  }

  /**
   * Burst rate limit implementation
   */
  async _burstLimit(key, options) {
    const now = Date.now();
    const burstWindowStart = now - 10000; // 10 seconds
    const sustainedWindowStart = now - options.windowMs;

    const burstKey = `burst:${key}`;
    const sustainedKey = `sustained:${key}`;

    const [currentBurstRequests, currentSustainedRequests] = await Promise.all([
      this.get(burstKey),
      this.get(sustainedKey),
    ]);

    const validBurstRequests = (currentBurstRequests || []).filter(
      (t) => t > burstWindowStart
    );
    const validSustainedRequests = (currentSustainedRequests || []).filter(
      (t) => t > sustainedWindowStart
    );

    if (validBurstRequests.length >= options.burstMax) {
      return {
        blocked: true,
        current: validBurstRequests.length,
        max: options.burstMax,
        retryAfter: 10,
        message: "Too many requests in short time",
      };
    }

    if (validSustainedRequests.length >= options.sustainedMax) {
      return {
        blocked: true,
        current: validSustainedRequests.length,
        max: options.sustainedMax,
        retryAfter: Math.ceil(options.windowMs / 1000),
        message: "Too many requests over time",
      };
    }

    validBurstRequests.push(now);
    validSustainedRequests.push(now);

    await Promise.all([
      this.set(burstKey, validBurstRequests, 10),
      this.set(
        sustainedKey,
        validSustainedRequests,
        Math.ceil(options.windowMs / 1000)
      ),
    ]);

    return { blocked: false };
  }

  /**
   * Distributed rate limit implementation
   */
  async _distributedLimit(key, options) {
    const redisKey = `dist_rl:${key}`;
    const ttl = Math.ceil(options.windowMs / 1000);

    const current = await this.incr(redisKey);

    if (current === 1) {
      await this.expire(redisKey, ttl);
    }

    if (current > options.max) {
      return {
        blocked: true,
        current,
        max: options.max,
        retryAfter: ttl,
        message: options.message,
      };
    }

    return {
      blocked: false,
      headers: {
        "X-RateLimit-Limit": options.max,
        "X-RateLimit-Remaining": Math.max(0, options.max - current),
        "X-RateLimit-Reset": new Date(Date.now() + ttl * 1000).toISOString(),
      },
    };
  }

  /**
   * Adaptive rate limit implementation
   */
  async _adaptiveLimit(key, options) {
    const metrics = this.getMetrics();
    const errorRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.errors / this.metrics.totalRequests) * 100
        : 0;

    let adjustedMax = options.baseMax;
    if (errorRate > 5) {
      adjustedMax = Math.floor(options.baseMax * 0.5);
    } else if (parseFloat(metrics.hitRate) < 80) {
      adjustedMax = Math.floor(options.baseMax * 0.7);
    }

    if (adjustedMax !== options.baseMax) {
      logger.info("Adaptive rate limit adjustment", {
        original: options.baseMax,
        adjusted: adjustedMax,
        reason: errorRate > 5 ? "high_error_rate" : "low_cache_hit_rate",
      });
    }

    return this._distributedLimit(key, { ...options, max: adjustedMax });
  }

  // Rate limiter factory methods
  createSlidingWindowRateLimit(options) {
    return this._createRateLimit("sliding", options);
  }

  createBurstRateLimit(burstMax, sustainedMax, windowMs) {
    return this._createRateLimit("burst", { burstMax, sustainedMax, windowMs });
  }

  createDistributedRateLimit(options) {
    return this._createRateLimit("distributed", options);
  }

  createAdaptiveRateLimit(baseMax, windowMs) {
    return this._createRateLimit("adaptive", { baseMax, windowMs });
  }

  /**
   * Advanced metrics export for external monitoring systems
   */
  exportMetrics() {
    const metrics = this.getMetrics();

    return {
      redis_total_requests: metrics.totalRequests,
      redis_cache_hits: metrics.cacheHits,
      redis_cache_misses: metrics.cacheMisses,
      redis_cache_hit_rate: parseFloat(metrics.hitRate) / 100,
      redis_errors_total: metrics.errors,
      redis_error_rate: parseFloat(metrics.errorRate) / 100,
      redis_connections_total: metrics.connections,
      redis_slow_queries: metrics.slowQueries,
      redis_uptime_seconds: metrics.uptime,
      redis_avg_response_time_ms: metrics.averageResponseTime,
      redis_max_response_time_ms: metrics.maxResponseTime,
      redis_min_response_time_ms: metrics.minResponseTime,
      redis_p50_response_time_ms: metrics.responseTimePercentiles.p50,
      redis_p95_response_time_ms: metrics.responseTimePercentiles.p95,
      redis_p99_response_time_ms: metrics.responseTimePercentiles.p99,
      redis_memory_peak_bytes: metrics.memoryUsage.peak,
      redis_memory_current_bytes: metrics.memoryUsage.current,
      redis_compression_saved_bytes: metrics.memoryUsage.compressionSaved,
      redis_requests_per_second: metrics.requestsPerSecond,
      redis_connection_state: metrics.isReady ? 1 : 0,
      redis_health_status: metrics.healthStatus,
      redis_reconnection_attempts: metrics.reconnectionAttempts,
    };
  }

  /**
   * Create a metrics snapshot for reporting
   */
  createMetricsSnapshot() {
    return {
      timestamp: new Date().toISOString(),
      version: "1.0",
      instance: process.env.NODE_ENV || "development",
      pid: process.pid,
      ...this.getMetrics(),
      config: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.db,
        cluster: this.config.cluster?.enabled || false,
        compression: this.config.cache?.compression?.enabled || false,
        encryption: this.config.cache?.serialization?.enableEncryption || false,
      },
    };
  }

  /**
   * Benchmark Redis performance
   */
  async benchmark(iterations = 1000, keySize = 100, valueSize = 1000) {
    if (!this.isReady()) {
      throw new Error("Redis not ready for benchmarking");
    }

    logger.info("Starting Redis benchmark", { iterations, keySize, valueSize });

    // Generate test data
    const testKey = "benchmark_" + "x".repeat(keySize);
    const testValue = { data: "x".repeat(valueSize), timestamp: Date.now() };

    const runOperation = async (operation, iterations) => {
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        await operation(i);
      }
      const totalTime = Date.now() - start;
      return {
        totalTime,
        opsPerSecond: Math.round((iterations / totalTime) * 1000),
        avgTime: totalTime / iterations,
      };
    };

    const results = {
      iterations,
      keySize,
      valueSize,
      startTime: Date.now(),
      operations: {},
    };

    // Benchmark operations
    results.operations.set = await runOperation(
      async (i) => await this.set(`${testKey}_${i}`, testValue),
      iterations
    );

    results.operations.get = await runOperation(
      async (i) => await this.get(`${testKey}_${i}`),
      iterations
    );

    results.operations.del = await runOperation(
      async (i) => await this.del(`${testKey}_${i}`),
      iterations
    );

    results.endTime = Date.now();
    results.totalTime = results.endTime - results.startTime;

    logger.info("Redis benchmark completed", results);
    return results;
  }

  /**
   * Pipeline operations for batch processing
   */
  async pipeline(operations) {
    if (!this.isReady()) {
      throw new Error("Redis not ready for pipeline operations");
    }

    return this._executeCommand("PIPELINE", async () => {
      const pipeline = this.client.multi();

      operations.forEach((op) => {
        const { command, args } = op;
        switch (command.toUpperCase()) {
          case "SET":
            pipeline.set(this._generateKey(args[0]), this._serialize(args[1]));
            break;
          case "GET":
            pipeline.get(this._generateKey(args[0]));
            break;
          case "DEL":
            pipeline.del(this._generateKey(args[0]));
            break;
          case "EXPIRE":
            pipeline.expire(this._generateKey(args[0]), args[1]);
            break;
          case "INCR":
            pipeline.incr(this._generateKey(args[0]));
            break;
          default:
            logger.warn("Unsupported pipeline command", { command });
        }
      });

      const results = await pipeline.exec();

      if (this.config.logLevel === "debug") {
        logger.debug("Redis pipeline operation", {
          operations: operations.length,
          results: results.length,
        });
      }

      return results;
    });
  }

  /**
   * Pub/Sub operations with metrics tracking
   */
  async publish(channel, message) {
    return this._executeCommand("PUBLISH", async () => {
      const serializedMessage = this._serialize(message);
      const result = await this.client.publish(channel, serializedMessage);

      if (this.config.logLevel === "debug") {
        logger.debug("Redis PUBLISH operation", {
          channel,
          subscribers: result,
        });
      }

      return result;
    });
  }

  async subscribe(channel, callback) {
    if (!this.isReady()) {
      throw new Error("Redis not ready for subscription");
    }

    try {
      this._updateMetrics("command", { command: "SUBSCRIBE" });

      const subscriber = this.client.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(channel, (message) => {
        try {
          const deserializedMessage = this._deserialize(message);
          callback(deserializedMessage, channel);
        } catch (error) {
          this._updateMetrics("error", {
            error,
            command: "SUBSCRIBE_CALLBACK",
          });
          logger.error("Error processing subscription message", {
            error: error.message,
            channel,
          });
        }
      });

      if (this.config.logLevel === "debug") {
        logger.debug("Redis SUBSCRIBE operation", { channel });
      }

      return subscriber;
    } catch (error) {
      this._updateMetrics("error", { error, command: "SUBSCRIBE" });
      throw error;
    }
  }

  /**
   * Lua script execution with caching
   */
  async evalScript(script, keys = [], args = []) {
    return this._executeCommand("EVAL", async () => {
      const redisKeys = keys.map((key) => this._generateKey(key));
      const serializedArgs = args.map((arg) =>
        typeof arg === "object" ? this._serialize(arg) : String(arg)
      );

      const result = await this.client.eval(script, {
        keys: redisKeys,
        arguments: serializedArgs,
      });

      if (this.config.logLevel === "debug") {
        logger.debug("Redis EVAL operation", {
          scriptLength: script.length,
          keysCount: keys.length,
          argsCount: args.length,
        });
      }

      return result;
    });
  }

  /**
   * Transaction operations
   */
  async transaction(operations) {
    if (!this.isReady()) {
      throw new Error("Redis not ready for transaction");
    }

    return this._executeCommand("TRANSACTION", async () => {
      const transaction = this.client.multi();

      for (const op of operations) {
        const { command, args } = op;
        switch (command.toUpperCase()) {
          case "SET":
            if (args[2]) {
              transaction.setEx(
                this._generateKey(args[0]),
                args[2],
                this._serialize(args[1])
              );
            } else {
              transaction.set(
                this._generateKey(args[0]),
                this._serialize(args[1])
              );
            }
            break;
          case "GET":
            transaction.get(this._generateKey(args[0]));
            break;
          case "DEL":
            transaction.del(this._generateKey(args[0]));
            break;
          case "INCR":
            transaction.incr(this._generateKey(args[0]));
            break;
          default:
            logger.warn("Unsupported transaction command", { command });
        }
      }

      const results = await transaction.exec();

      if (this.config.logLevel === "debug") {
        logger.debug("Redis transaction completed", {
          operations: operations.length,
          success: results !== null,
        });
      }

      return results;
    });
  }

  /**
   * Memory optimization utilities
   */
  async optimizeMemory() {
    if (!this.isReady()) {
      return { error: "Redis not ready" };
    }

    try {
      const beforeInfo = await this.info("memory");
      const beforeMemory = this._extractMemoryUsage(beforeInfo);

      // Trigger memory optimization
      await this.client.sendCommand(["MEMORY", "PURGE"]);

      const afterInfo = await this.info("memory");
      const afterMemory = this._extractMemoryUsage(afterInfo);

      const saved = beforeMemory - afterMemory;

      logger.info("Redis memory optimization completed", {
        before: beforeMemory,
        after: afterMemory,
        saved,
        savedPercent: ((saved / beforeMemory) * 100).toFixed(2),
      });

      return {
        before: beforeMemory,
        after: afterMemory,
        saved,
        savedPercent: ((saved / beforeMemory) * 100).toFixed(2),
      };
    } catch (error) {
      this._updateMetrics("error", { error, command: "MEMORY_OPTIMIZE" });
      return { error: error.message };
    }
  }

  /**
   * Extract memory usage from Redis INFO output
   */
  _extractMemoryUsage(infoOutput) {
    const match = infoOutput.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Health check endpoint for load balancers
   */
  async healthCheck() {
    const result = await this._performHealthCheck();
    const metrics = this.getMetrics();

    return {
      status:
        result.status === "healthy"
          ? "healthy"
          : result.status === "unhealthy"
          ? "unhealthy"
          : "degraded",
      responseTime: result.responseTime || 0,
      error: result.error,
      metrics: {
        requests: metrics.totalRequests,
        errors: metrics.errors,
        hitRate: metrics.hitRate,
        uptime: metrics.uptime,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get Redis configuration
   */
  async getConfig(parameter = null) {
    return this._executeCommand("CONFIG_GET", async () => {
      if (parameter) {
        const result = await this.client.configGet(parameter);
        return result;
      }
      // Get common configuration parameters
      const configs = await Promise.all([
        this.client.configGet("maxmemory"),
        this.client.configGet("maxmemory-policy"),
        this.client.configGet("timeout"),
        this.client.configGet("databases"),
      ]);

      return {
        maxmemory: configs[0],
        "maxmemory-policy": configs[1],
        timeout: configs[2],
        databases: configs[3],
      };
    });
  }

  /**
   * Get database size
   */
  async dbSize() {
    return this._executeCommand("DBSIZE", async () => {
      return await this.client.dbSize();
    });
  }

  /**
   * Get server time
   */
  async time() {
    return this._executeCommand("TIME", async () => {
      const result = await this.client.time();
      return {
        seconds: parseInt(result[0]),
        microseconds: parseInt(result[1]),
        timestamp: new Date(parseInt(result[0]) * 1000),
      };
    });
  }
}

// Export singleton instance
module.exports = new RedisClient();

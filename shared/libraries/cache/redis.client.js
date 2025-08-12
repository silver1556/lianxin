const { createClient, createCluster } = require("redis");
const logger = require("../logging/logger");
const redisConfig = require("./redis.config");

/**
 * Redis Client Manager
 * Handles Redis connections, caching, and session management
 */
class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;

    this.config = redisConfig;

    // Bind methods if needed (optional)
    this.connect = this.connect.bind(this);
    this.quit = this.quit.bind(this);
  }

  /**
   * Initialize Redis connection or cluster connection
   */
  async connect() {
    try {
      if (this.config.cluster.enabled) {
        // Setup cluster client
        const clusterNodes = this.config.cluster.nodes;
        const clusterOptions = {
          rootNodes: clusterNodes,
          defaults: {
            socket: {
              connectTimeout: this.config.connectTimeout,
              tls: this.config.enableTLS ? this.config.tls : undefined,
              keepAlive: this.config.keepAlive,
            },
            password: this.config.password,
            database: this.config.db,
            maxRetriesPerRequest: this.config.maxRetriesPerRequest,
            retryStrategy: (times) => {
              const delay =
                this.config.retryDelayOnFailover * Math.min(times, 10);
              logger.warn(
                `Redis cluster retry attempt #${times}, retrying in ${delay}ms`
              );
              return delay;
            },
          },
        };

        this.client = createCluster(clusterOptions);
      } else {
        // Single node Redis client
        this.client = createClient({
          socket: {
            host: this.config.host,
            port: this.config.port,
            connectTimeout: this.config.connectTimeout,
            tls: this.config.enableTLS ? this.config.tls : undefined,
            keepAlive: this.config.keepAlive,
            lazyConnect: this.config.lazyConnect,
          },
          password: this.config.password,
          database: this.config.db,
          maxRetriesPerRequest: this.config.maxRetriesPerRequest,
          retryStrategy: (times) => {
            const delay =
              this.config.retryDelayOnFailover * Math.min(times, 10);
            logger.warn(
              `Redis retry attempt #${times}, retrying in ${delay}ms`
            );
            return delay;
          },
        });
      }

      // Register event listeners
      this.client.on("connect", () => {
        this.isConnected = true;
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
        logger.error("Redis client error", { error: err.message });
      });

      this.client.on("end", () => {
        this.isConnected = false;
        if (this.config.enableLogging) {
          logger.info("Redis client disconnected");
        }
      });

      // Connect if not lazy
      if (!this.config.lazyConnect) {
        await this.client.connect();
      }

      // Test connection
      await this.ping();

      if (this.config.enableLogging) {
        logger.info("Redis connection established", {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db,
          cluster: this.config.cluster.enabled,
        });
      }

      return this.client;
    } catch (error) {
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
   * Test Redis connection
   */
  async ping() {
    try {
      const result = await this.client.ping();
      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis ping successful", { result });
      }
      return result;
    } catch (error) {
      logger.error("Redis ping failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Set key-value pair with optional TTL in seconds
   */
  async set(key, value, ttl = null) {
    try {
      const serializedValue = JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis SET operation", { key, ttl });
      }
    } catch (error) {
      logger.error("Redis SET failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Get value by key
   */
  async get(key) {
    try {
      const value = await this.client.get(key);

      if (value === null) {
        if (this.config.enableLogging && this.config.logLevel === "debug") {
          logger.debug("Redis GET cache miss", { key });
        }
        return null;
      }

      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis GET cache hit", { key });
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error("Redis GET failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Delete key
   */
  async del(key) {
    try {
      const result = await this.client.del(key);
      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis DEL operation", { key, deleted: result });
      }
      return result;
    } catch (error) {
      logger.error("Redis DEL failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXISTS failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Set expiration for key in seconds
   */
  async expire(key, ttl) {
    try {
      const result = await this.client.expire(key, ttl);
      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis EXPIRE operation", { key, ttl, success: result });
      }
      return result;
    } catch (error) {
      logger.error("Redis EXPIRE failed", { error: error.message, key, ttl });
      throw error;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      const values = await this.client.mGet(keys);
      return values.map((value) => (value ? JSON.parse(value) : null));
    } catch (error) {
      logger.error("Redis MGET failed", { error: error.message, keys });
      throw error;
    }
  }

  /**
   * Increment counter for key
   */
  async incr(key) {
    try {
      const result = await this.client.incr(key);
      if (this.config.enableLogging && this.config.logLevel === "debug") {
        logger.debug("Redis INCR operation", { key, value: result });
      }
      return result;
    } catch (error) {
      logger.error("Redis INCR failed", { error: error.message, key });
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async quit() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        if (this.config.enableLogging) {
          logger.info("Redis connection closed");
        }
      }
    } catch (error) {
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
      logger.error("Redis FLUSHDB failed", { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new RedisClient();

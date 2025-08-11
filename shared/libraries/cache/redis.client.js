const redis = require('redis');
const logger = require('../logging/logger');

/**
 * Redis Client Manager
 * Handles Redis connections, caching, and session management
 */
class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: parseInt(process.env.REDIS_DB) || 0,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
      lazyConnect: true,
      keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE) || 30000
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      this.client = redis.createClient(this.config);
      
      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });
      
      this.client.on('error', (error) => {
        logger.error('Redis client error', { error: error.message });
        this.isConnected = false;
      });
      
      this.client.on('end', () => {
        logger.info('Redis client disconnected');
        this.isConnected = false;
      });
      
      await this.client.connect();
      
      // Test connection
      await this.ping();
      
      logger.info('Redis connection established', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db
      });
      
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        error: error.message,
        config: {
          host: this.config.host,
          port: this.config.port
        }
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
      logger.debug('Redis ping successful', { result });
      return result;
    } catch (error) {
      logger.error('Redis ping failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Set key-value pair
   */
  async set(key, value, ttl = null) {
    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      
      logger.debug('Redis SET operation', { key, ttl });
    } catch (error) {
      logger.error('Redis SET failed', {
        error: error.message,
        key
      });
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
        logger.debug('Redis GET cache miss', { key });
        return null;
      }
      
      logger.debug('Redis GET cache hit', { key });
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis GET failed', {
        error: error.message,
        key
      });
      throw error;
    }
  }

  /**
   * Delete key
   */
  async del(key) {
    try {
      const result = await this.client.del(key);
      logger.debug('Redis DEL operation', { key, deleted: result });
      return result;
    } catch (error) {
      logger.error('Redis DEL failed', {
        error: error.message,
        key
      });
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
      logger.error('Redis EXISTS failed', {
        error: error.message,
        key
      });
      throw error;
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key, ttl) {
    try {
      const result = await this.client.expire(key, ttl);
      logger.debug('Redis EXPIRE operation', { key, ttl, success: result });
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE failed', {
        error: error.message,
        key,
        ttl
      });
      throw error;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Redis MGET failed', {
        error: error.message,
        keys
      });
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async incr(key) {
    try {
      const result = await this.client.incr(key);
      logger.debug('Redis INCR operation', { key, value: result });
      return result;
    } catch (error) {
      logger.error('Redis INCR failed', {
        error: error.message,
        key
      });
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
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection', {
        error: error.message
      });
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
      logger.warn('Redis database flushed');
    } catch (error) {
      logger.error('Redis FLUSHDB failed', {
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new RedisClient();
const CachePort = require('../../../core/domain/user/ports/CachePort');

/**
 * Redis Cache Adapter
 * Implements CachePort using Redis
 */
class RedisAdapter extends CachePort {
  constructor(redisClient, config) {
    super();
    this.client = redisClient;
    this.config = config;
    this.keyPrefix = config.cache.keyPrefix || 'lianxin:';
    this.defaultTtl = config.cache.ttl.userProfileHot || 3600;
  }

  async get(key) {
    try {
      const fullKey = this._buildKey(key);
      const result = await this.client.get(fullKey);
      
      if (!result) return null;
      
      return this._deserialize(result);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const fullKey = this._buildKey(key);
      const serializedValue = this._serialize(value);
      const expiry = ttl || this.defaultTtl;

      const result = await this.client.setex(fullKey, expiry, serializedValue);
      return result === 'OK';
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      const fullKey = this._buildKey(key);
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      const fullKey = this._buildKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async incr(key) {
    try {
      const fullKey = this._buildKey(key);
      return await this.client.incr(fullKey);
    } catch (error) {
      console.error('Redis incr error:', error);
      throw error;
    }
  }

  async expire(key, ttl) {
    try {
      const fullKey = this._buildKey(key);
      const result = await this.client.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  async ttl(key) {
    try {
      const fullKey = this._buildKey(key);
      return await this.client.ttl(fullKey);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -2;
    }
  }

  async ping() {
    try {
      return await this.client.ping();
    } catch (error) {
      console.error('Redis ping error:', error);
      return 'ERROR';
    }
  }

  async flushAll() {
    try {
      const result = await this.client.flushdb();
      return result === 'OK';
    } catch (error) {
      console.error('Redis flushAll error:', error);
      return false;
    }
  }

  async getStats() {
    try {
      const info = await this.client.info('memory');
      return this._parseRedisInfo(info);
    } catch (error) {
      console.error('Redis getStats error:', error);
      return {};
    }
  }

  async cacheUserProfile(userId, profileData, type = 'hot') {
    const key = `user:profile:${type}:${userId}`;
    const ttl = type === 'hot' 
      ? this.config.cache.ttl.userProfileHot 
      : this.config.cache.ttl.userProfileFull;

    return await this.set(key, profileData, ttl);
  }

  async getUserProfile(userId, type = 'hot') {
    const key = `user:profile:${type}:${userId}`;
    return await this.get(key);
  }

  async invalidateUserCache(userId) {
    const keys = [
      `user:profile:hot:${userId}`,
      `user:profile:full:${userId}`,
      `user:settings:${userId}`
    ];

    let success = true;
    for (const key of keys) {
      const result = await this.del(key);
      if (!result) success = false;
    }

    return success;
  }

  // Private helper methods
  _buildKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  _serialize(value) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  _deserialize(value) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  _parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const stats = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    }

    return stats;
  }
}

module.exports = RedisAdapter;
const CacheService = require('../../../core/domain/shared/contracts/CacheService');

/**
 * Redis Cache Adapter
 * Implements CacheService contract using Redis
 */
class RedisCacheAdapter extends CacheService {
  constructor(redisClient, config) {
    super();
    this.client = redisClient;
    this.config = config;
    this.keyPrefix = config.cache?.keyPrefix || 'lianxin:';
    this.defaultTtl = config.cache?.ttl?.userProfileHot || 3600;
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

  async delete(key) {
    try {
      const fullKey = this._buildKey(key);
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
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

  async increment(key) {
    try {
      const fullKey = this._buildKey(key);
      return await this.client.incr(fullKey);
    } catch (error) {
      console.error('Redis increment error:', error);
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

  async flush() {
    try {
      const result = await this.client.flushdb();
      return result === 'OK';
    } catch (error) {
      console.error('Redis flush error:', error);
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

  // User-specific cache methods
  async cacheUserProfile(userId, profileData, type = 'hot') {
    const key = `user:profile:${type}:${userId}`;
    const ttl = type === 'hot' 
      ? this.config.cache?.ttl?.userProfileHot 
      : this.config.cache?.ttl?.userProfileFull;

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
      const result = await this.delete(key);
      if (!result) success = false;
    }

    return success;
  }

  // Rate limiting methods
  async incrementRateLimit(key, windowSeconds) {
    const fullKey = this._buildKey(`rate_limit:${key}`);
    
    const current = await this.client.incr(fullKey);
    
    if (current === 1) {
      await this.client.expire(fullKey, windowSeconds);
    }
    
    return current;
  }

  async getRateLimitCount(key) {
    const fullKey = this._buildKey(`rate_limit:${key}`);
    const count = await this.client.get(fullKey);
    return parseInt(count) || 0;
  }

  async clearRateLimit(key) {
    const fullKey = this._buildKey(`rate_limit:${key}`);
    return await this.delete(fullKey);
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

module.exports = RedisCacheAdapter;
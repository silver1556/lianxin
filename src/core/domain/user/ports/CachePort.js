/**
 * Cache Port (Interface)
 * Defines the contract for caching operations
 */
class CachePort {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  async get(key) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 3600) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Exists status
   */
  async exists(key) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @returns {Promise<number>} New value
   */
  async incr(key) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Set expiration for key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, ttl) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Get TTL for key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Ping cache service
   * @returns {Promise<string>} Ping response
   */
  async ping() {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Flush all cache
   * @returns {Promise<boolean>} Success status
   */
  async flushAll() {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Cache user profile
   * @param {number} userId - User ID
   * @param {Object} profileData - Profile data
   * @param {string} type - Cache type ('hot' or 'full')
   * @returns {Promise<boolean>} Success status
   */
  async cacheUserProfile(userId, profileData, type = 'hot') {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Get cached user profile
   * @param {number} userId - User ID
   * @param {string} type - Cache type ('hot' or 'full')
   * @returns {Promise<Object|null>} Cached profile or null
   */
  async getUserProfile(userId, type = 'hot') {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Invalidate user cache
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async invalidateUserCache(userId) {
    throw new Error('Method must be implemented by adapter');
  }
}

module.exports = CachePort;
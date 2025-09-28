/**
 * Cache Service Contract
 * Defines caching operations interface
 */
class CacheService {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = 3600) {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @returns {Promise<number>}
   */
  async increment(key) {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Set expiration for key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>}
   */
  async expire(key, ttl) {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Flush all cache
   * @returns {Promise<boolean>}
   */
  async flush() {
    throw new Error('Method must be implemented by concrete cache service');
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('Method must be implemented by concrete cache service');
  }
}

module.exports = CacheService;
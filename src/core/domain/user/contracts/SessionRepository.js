const Repository = require('../../shared/contracts/Repository');

/**
 * Session Repository Contract
 * Defines session-specific repository operations
 */
class SessionRepository extends Repository {
  /**
   * Find session by session ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<UserSession|null>}
   */
  async findBySessionId(sessionId) {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Find session by refresh token
   * @param {string} refreshToken - Refresh token hash
   * @returns {Promise<UserSession|null>}
   */
  async findByRefreshToken(refreshToken) {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Find active sessions by user ID
   * @param {number} userId - User ID
   * @returns {Promise<UserSession[]>}
   */
  async findActiveByUserId(userId) {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Find sessions by device ID
   * @param {number} userId - User ID
   * @param {string} deviceId - Device ID
   * @returns {Promise<UserSession[]>}
   */
  async findByDeviceId(userId, deviceId) {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Revoke session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  async revoke(sessionId) {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Revoke all sessions for user
   * @param {number} userId - User ID
   * @param {string} excludeSessionId - Session ID to exclude
   * @returns {Promise<number>}
   */
  async revokeAllForUser(userId, excludeSessionId = null) {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>}
   */
  async cleanupExpired() {
    throw new Error('Method must be implemented by concrete session repository');
  }

  /**
   * Count active sessions for user
   * @param {number} userId - User ID
   * @returns {Promise<number>}
   */
  async countActiveForUser(userId) {
    throw new Error('Method must be implemented by concrete session repository');
  }
}

module.exports = SessionRepository;
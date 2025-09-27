/**
 * Session Repository Port (Interface)
 * Defines the contract for session data persistence
 */
class SessionRepositoryPort {
  /**
   * Find session by session ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<UserSession|null>}
   */
  async findBySessionId(sessionId) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find session by refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<UserSession|null>}
   */
  async findByRefreshToken(refreshToken) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find active sessions by user ID
   * @param {number} userId - User ID
   * @returns {Promise<UserSession[]>}
   */
  async findActiveByUserId(userId) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Find sessions by device ID
   * @param {number} userId - User ID
   * @param {string} deviceId - Device ID
   * @returns {Promise<UserSession[]>}
   */
  async findByDeviceId(userId, deviceId) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Save session
   * @param {UserSession} session - Session entity
   * @returns {Promise<UserSession>}
   */
  async save(session) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Create new session
   * @param {UserSession} session - Session entity
   * @returns {Promise<UserSession>}
   */
  async create(session) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Update session
   * @param {UserSession} session - Session entity
   * @returns {Promise<UserSession>}
   */
  async update(session) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Revoke session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  async revoke(sessionId) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Revoke all sessions for user
   * @param {number} userId - User ID
   * @param {string} excludeSessionId - Session ID to exclude
   * @returns {Promise<number>} Number of revoked sessions
   */
  async revokeAllForUser(userId, excludeSessionId = null) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of cleaned sessions
   */
  async cleanupExpired() {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Count active sessions for user
   * @param {number} userId - User ID
   * @returns {Promise<number>}
   */
  async countActiveForUser(userId) {
    throw new Error('Method must be implemented by adapter');
  }
}

module.exports = SessionRepositoryPort;
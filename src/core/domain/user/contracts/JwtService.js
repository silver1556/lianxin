/**
 * JWT Service Contract
 * Defines JWT operations interface
 */
class JwtService {
  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @param {Object} options - Token options
   * @returns {string}
   */
  generateAccessToken(payload, options = {}) {
    throw new Error('Method must be implemented by concrete JWT service');
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @param {Object} options - Token options
   * @returns {string}
   */
  generateRefreshToken(payload, options = {}) {
    throw new Error('Method must be implemented by concrete JWT service');
  }

  /**
   * Generate token pair
   * @param {Object} payload - Token payload
   * @param {Object} options - Token options
   * @returns {Object}
   */
  generateTokenPair(payload, options = {}) {
    throw new Error('Method must be implemented by concrete JWT service');
  }

  /**
   * Verify access token
   * @param {string} token - JWT token
   * @param {Object} options - Verification options
   * @returns {Object}
   */
  verifyAccessToken(token, options = {}) {
    throw new Error('Method must be implemented by concrete JWT service');
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT token
   * @param {Object} options - Verification options
   * @returns {Object}
   */
  verifyRefreshToken(token, options = {}) {
    throw new Error('Method must be implemented by concrete JWT service');
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header
   * @returns {string}
   */
  extractToken(authHeader) {
    throw new Error('Method must be implemented by concrete JWT service');
  }

  /**
   * Decode token without verification
   * @param {string} token - JWT token
   * @returns {Object}
   */
  decode(token) {
    throw new Error('Method must be implemented by concrete JWT service');
  }
}

module.exports = JwtService;
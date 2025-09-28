/**
 * Password Service Contract
 * Defines password operations interface
 */
class PasswordService {
  /**
   * Hash password
   * @param {string} password - Plain text password
   * @returns {Promise<string>}
   */
  async hashPassword(password) {
    throw new Error('Method must be implemented by concrete password service');
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Password hash
   * @returns {Promise<boolean>}
   */
  async comparePassword(password, hash) {
    throw new Error('Method must be implemented by concrete password service');
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {boolean}
   */
  validatePassword(password) {
    throw new Error('Method must be implemented by concrete password service');
  }

  /**
   * Generate secure password
   * @param {number} length - Password length
   * @returns {string}
   */
  generateSecurePassword(length = 12) {
    throw new Error('Method must be implemented by concrete password service');
  }

  /**
   * Check if password is in history
   * @param {string} password - Password to check
   * @param {Array} passwordHistory - Array of previous password hashes
   * @returns {Promise<boolean>}
   */
  async isPasswordInHistory(password, passwordHistory) {
    throw new Error('Method must be implemented by concrete password service');
  }
}

module.exports = PasswordService;
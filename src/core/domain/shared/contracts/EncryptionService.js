/**
 * Encryption Service Contract
 * Defines encryption/decryption operations interface
 */
class EncryptionService {
  /**
   * Encrypt sensitive data
   * @param {string} data - Data to encrypt
   * @param {string} keyVersion - Key version to use
   * @returns {Promise<string>}
   */
  async encrypt(data, keyVersion = 'primary') {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted data
   * @returns {Promise<string>}
   */
  async decrypt(encryptedData) {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Hash data (one-way)
   * @param {string} data - Data to hash
   * @param {string} algorithm - Hash algorithm
   * @returns {string}
   */
  hash(data, algorithm = 'sha256') {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Generate HMAC for data integrity
   * @param {string} data - Data to generate HMAC for
   * @param {string} secret - Secret key
   * @returns {string}
   */
  generateHMAC(data, secret = null) {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Verify HMAC
   * @param {string} data - Original data
   * @param {string} hmac - HMAC to verify
   * @param {string} secret - Secret key
   * @returns {boolean}
   */
  verifyHMAC(data, hmac, secret = null) {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length
   * @returns {string}
   */
  generateSecureToken(length = 32) {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Encrypt user data fields
   * @param {Object} userData - User data object
   * @returns {Promise<Object>}
   */
  async encryptUserData(userData) {
    throw new Error('Method must be implemented by concrete encryption service');
  }

  /**
   * Decrypt user data fields
   * @param {Object} encryptedUserData - Encrypted user data
   * @returns {Promise<Object>}
   */
  async decryptUserData(encryptedUserData) {
    throw new Error('Method must be implemented by concrete encryption service');
  }
}

module.exports = EncryptionService;
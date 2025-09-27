/**
 * Encryption Port (Interface)
 * Defines the contract for encryption/decryption operations
 */
class EncryptionPort {
  /**
   * Encrypt sensitive data
   * @param {string} data - Data to encrypt
   * @param {string} keyVersion - Key version to use
   * @returns {Promise<string>} Encrypted data
   */
  async encrypt(data, keyVersion = 'primary') {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted data
   * @returns {Promise<string>} Decrypted data
   */
  async decrypt(encryptedData) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Hash data (one-way)
   * @param {string} data - Data to hash
   * @param {string} algorithm - Hash algorithm
   * @returns {string} Hash
   */
  hash(data, algorithm = 'sha256') {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Generate HMAC for data integrity
   * @param {string} data - Data to generate HMAC for
   * @param {string} secret - Secret key
   * @returns {string} HMAC
   */
  generateHMAC(data, secret = null) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Verify HMAC
   * @param {string} data - Original data
   * @param {string} hmac - HMAC to verify
   * @param {string} secret - Secret key
   * @returns {boolean} Is valid
   */
  verifyHMAC(data, hmac, secret = null) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Encrypt user data fields
   * @param {Object} userData - User data object
   * @returns {Promise<Object>} Encrypted user data
   */
  async encryptUserData(userData) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Decrypt user data fields
   * @param {Object} encryptedUserData - Encrypted user data
   * @returns {Promise<Object>} Decrypted user data
   */
  async decryptUserData(encryptedUserData) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length
   * @returns {string} Random token
   */
  generateSecureToken(length = 32) {
    throw new Error('Method must be implemented by adapter');
  }
}

module.exports = EncryptionPort;
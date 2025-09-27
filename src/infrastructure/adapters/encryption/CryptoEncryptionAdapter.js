const crypto = require('crypto');
const EncryptionPort = require('../../../core/domain/user/ports/EncryptionPort');

/**
 * Crypto Encryption Adapter
 * Implements EncryptionPort using Node.js crypto module
 */
class CryptoEncryptionAdapter extends EncryptionPort {
  constructor(config) {
    super();
    this.algorithm = config.encryption.algorithm || 'aes-256-gcm';
    this.keyLength = config.encryption.keyLength || 32;
    this.ivLength = config.encryption.ivLength || 16;
    this.tagLength = config.encryption.tagLength || 16;
    this.primaryKey = Buffer.from(config.encryption.primaryKey, 'hex');
    this.secondaryKey = Buffer.from(config.encryption.secondaryKey, 'hex');
    this.encryptedFields = config.encryption.encryptedFields || ['phone'];
  }

  async encrypt(data, keyVersion = 'primary') {
    if (!data || typeof data !== 'string') {
      return data;
    }

    try {
      const key = keyVersion === 'primary' ? this.primaryKey : this.secondaryKey;
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
        authTagLength: this.tagLength
      });

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      const result = {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        version: keyVersion,
        algorithm: this.algorithm
      };

      return JSON.stringify(result);
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  async decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData;
    }

    try {
      let parsedData;
      try {
        parsedData = JSON.parse(encryptedData);
      } catch {
        return encryptedData; // Not encrypted
      }

      if (!parsedData.data || !parsedData.iv || !parsedData.tag) {
        return encryptedData;
      }

      const key = parsedData.version === 'primary' ? this.primaryKey : this.secondaryKey;
      const iv = Buffer.from(parsedData.iv, 'hex');
      const tag = Buffer.from(parsedData.tag, 'hex');

      const decipher = crypto.createDecipheriv(
        parsedData.algorithm || this.algorithm,
        key,
        iv,
        { authTagLength: this.tagLength }
      );
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(parsedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  hash(data, algorithm = 'sha256') {
    if (!data || typeof data !== 'string') {
      return data;
    }

    try {
      return crypto.createHash(algorithm).update(data).digest('hex');
    } catch (error) {
      throw new Error(`Hashing failed: ${error.message}`);
    }
  }

  generateHMAC(data, secret = null) {
    try {
      const key = secret || this.primaryKey;
      return crypto.createHmac('sha256', key).update(data).digest('hex');
    } catch (error) {
      throw new Error(`HMAC generation failed: ${error.message}`);
    }
  }

  verifyHMAC(data, hmac, secret = null) {
    try {
      const expectedHMAC = this.generateHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(hmac, 'hex'),
        Buffer.from(expectedHMAC, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  async encryptUserData(userData) {
    if (!userData || typeof userData !== 'object') {
      return userData;
    }

    const encryptedData = { ...userData };

    for (const field of this.encryptedFields) {
      if (encryptedData[field] && typeof encryptedData[field] === 'string') {
        encryptedData[field] = await this.encrypt(encryptedData[field]);
      }
    }

    return encryptedData;
  }

  async decryptUserData(encryptedUserData) {
    if (!encryptedUserData || typeof encryptedUserData !== 'object') {
      return encryptedUserData;
    }

    const decryptedData = { ...encryptedUserData };

    for (const field of this.encryptedFields) {
      if (decryptedData[field] && typeof decryptedData[field] === 'string') {
        try {
          decryptedData[field] = await this.decrypt(decryptedData[field]);
        } catch (error) {
          // Keep original value if decryption fails
          console.warn(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    }

    return decryptedData;
  }

  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Additional helper methods
  async encryptSessionData(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      return sessionData;
    }

    const encryptedSession = { ...sessionData };

    // Encrypt device info
    if (encryptedSession.device_info) {
      encryptedSession.device_info = await this.encrypt(
        JSON.stringify(encryptedSession.device_info)
      );
    }

    // Encrypt user agent
    if (encryptedSession.user_agent) {
      encryptedSession.user_agent = await this.encrypt(encryptedSession.user_agent);
    }

    return encryptedSession;
  }

  async decryptSessionData(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      return sessionData;
    }

    const decryptedSession = { ...sessionData };

    // Decrypt device info
    if (decryptedSession.device_info && typeof decryptedSession.device_info === 'string') {
      try {
        const decryptedDeviceInfo = await this.decrypt(decryptedSession.device_info);
        decryptedSession.device_info = JSON.parse(decryptedDeviceInfo);
      } catch (error) {
        console.warn('Failed to decrypt device info:', error.message);
      }
    }

    // Decrypt user agent
    if (decryptedSession.user_agent && typeof decryptedSession.user_agent === 'string') {
      try {
        decryptedSession.user_agent = await this.decrypt(decryptedSession.user_agent);
      } catch (error) {
        console.warn('Failed to decrypt user agent:', error.message);
      }
    }

    return decryptedSession;
  }
}

module.exports = CryptoEncryptionAdapter;
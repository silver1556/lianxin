const encryptionUtil = require('../utils/encryption.util');
const logger = require('../utils/logger.util');
const { AppError } = require('../errors/AppError');

/**
 * Encryption Service
 * Handles AES-256 field-level encryption for sensitive user data
 */
class EncryptionService {
  constructor() {
    this.encryptedFields = [
      'phone',
      'first_name',
      'last_name',
      'birth_date',
      'location',
      'verification_data'
    ];
  }

  /**
   * Encrypt user data before saving to database
   */
  async encryptUserData(userData) {
    try {
      if (!userData || typeof userData !== 'object') {
        return userData;
      }

      const encryptedData = { ...userData };

      // Encrypt specified fields
      for (const field of this.encryptedFields) {
        if (encryptedData[field] && typeof encryptedData[field] === 'string') {
          encryptedData[field] = encryptionUtil.encrypt(encryptedData[field]);
          
          logger.debug('Field encrypted', {
            field,
            userId: userData.id || 'new_user'
          });
        }
      }

      return encryptedData;
    } catch (error) {
      logger.error('Failed to encrypt user data', {
        userId: userData?.id,
        error: error.message,
        stack: error.stack
      });
      throw new AppError('Data encryption failed', 500, 'ENCRYPTION_ERROR');
    }
  }

  /**
   * Decrypt user data after retrieving from database
   */
  async decryptUserData(userData) {
    try {
      if (!userData || typeof userData !== 'object') {
        return userData;
      }

      const decryptedData = { ...userData };

      // Decrypt specified fields
      for (const field of this.encryptedFields) {
        if (decryptedData[field] && typeof decryptedData[field] === 'string') {
          try {
            decryptedData[field] = encryptionUtil.decrypt(decryptedData[field]);
          } catch (decryptError) {
            logger.warn('Failed to decrypt field', {
              field,
              userId: userData.id,
              error: decryptError.message
            });
            // Keep original value if decryption fails
          }
        }
      }

      return decryptedData;
    } catch (error) {
      logger.error('Failed to decrypt user data', {
        userId: userData?.id,
        error: error.message,
        stack: error.stack
      });
      throw new AppError('Data decryption failed', 500, 'DECRYPTION_ERROR');
    }
  }

  /**
   * Encrypt sensitive settings data
   */
  async encryptSettingsData(settingsData) {
    try {
      if (!settingsData || typeof settingsData !== 'object') {
        return settingsData;
      }

      const encryptedSettings = { ...settingsData };

      // Encrypt privacy settings if they contain sensitive data
      if (encryptedSettings.privacy_settings) {
        encryptedSettings.privacy_settings = encryptionUtil.encryptJSON(
          encryptedSettings.privacy_settings
        );
      }

      // Encrypt security settings
      if (encryptedSettings.security_settings) {
        encryptedSettings.security_settings = encryptionUtil.encryptJSON(
          encryptedSettings.security_settings
        );
      }

      return encryptedSettings;
    } catch (error) {
      logger.error('Failed to encrypt settings data', {
        userId: settingsData?.user_id,
        error: error.message
      });
      throw new AppError('Settings encryption failed', 500, 'ENCRYPTION_ERROR');
    }
  }

  /**
   * Decrypt sensitive settings data
   */
  async decryptSettingsData(settingsData) {
    try {
      if (!settingsData || typeof settingsData !== 'object') {
        return settingsData;
      }

      const decryptedSettings = { ...settingsData };

      // Decrypt privacy settings
      if (decryptedSettings.privacy_settings && typeof decryptedSettings.privacy_settings === 'string') {
        try {
          decryptedSettings.privacy_settings = encryptionUtil.decryptJSON(
            decryptedSettings.privacy_settings
          );
        } catch (decryptError) {
          logger.warn('Failed to decrypt privacy settings', {
            userId: settingsData.user_id,
            error: decryptError.message
          });
        }
      }

      // Decrypt security settings
      if (decryptedSettings.security_settings && typeof decryptedSettings.security_settings === 'string') {
        try {
          decryptedSettings.security_settings = encryptionUtil.decryptJSON(
            decryptedSettings.security_settings
          );
        } catch (decryptError) {
          logger.warn('Failed to decrypt security settings', {
            userId: settingsData.user_id,
            error: decryptError.message
          });
        }
      }

      return decryptedSettings;
    } catch (error) {
      logger.error('Failed to decrypt settings data', {
        userId: settingsData?.user_id,
        error: error.message
      });
      throw new AppError('Settings decryption failed', 500, 'DECRYPTION_ERROR');
    }
  }

  /**
   * Encrypt verification data
   */
  async encryptVerificationData(verificationData) {
    try {
      if (!verificationData) {
        return verificationData;
      }

      return encryptionUtil.encryptJSON(verificationData);
    } catch (error) {
      logger.error('Failed to encrypt verification data', {
        error: error.message
      });
      throw new AppError('Verification data encryption failed', 500, 'ENCRYPTION_ERROR');
    }
  }

  /**
   * Decrypt verification data
   */
  async decryptVerificationData(encryptedVerificationData) {
    try {
      if (!encryptedVerificationData) {
        return encryptedVerificationData;
      }

      return encryptionUtil.decryptJSON(encryptedVerificationData);
    } catch (error) {
      logger.error('Failed to decrypt verification data', {
        error: error.message
      });
      throw new AppError('Verification data decryption failed', 500, 'DECRYPTION_ERROR');
    }
  }

  /**
   * Encrypt session data
   */
  async encryptSessionData(sessionData) {
    try {
      if (!sessionData || typeof sessionData !== 'object') {
        return sessionData;
      }

      const encryptedSession = { ...sessionData };

      // Encrypt device info
      if (encryptedSession.device_info) {
        encryptedSession.device_info = encryptionUtil.encryptJSON(
          encryptedSession.device_info
        );
      }

      // Encrypt user agent
      if (encryptedSession.user_agent) {
        encryptedSession.user_agent = encryptionUtil.encrypt(
          encryptedSession.user_agent
        );
      }

      return encryptedSession;
    } catch (error) {
      logger.error('Failed to encrypt session data', {
        sessionId: sessionData?.session_id,
        error: error.message
      });
      throw new AppError('Session data encryption failed', 500, 'ENCRYPTION_ERROR');
    }
  }

  /**
   * Decrypt session data
   */
  async decryptSessionData(sessionData) {
    try {
      if (!sessionData || typeof sessionData !== 'object') {
        return sessionData;
      }

      const decryptedSession = { ...sessionData };

      // Decrypt device info
      if (decryptedSession.device_info && typeof decryptedSession.device_info === 'string') {
        try {
          decryptedSession.device_info = encryptionUtil.decryptJSON(
            decryptedSession.device_info
          );
        } catch (decryptError) {
          logger.warn('Failed to decrypt device info', {
            sessionId: sessionData.session_id,
            error: decryptError.message
          });
        }
      }

      // Decrypt user agent
      if (decryptedSession.user_agent && typeof decryptedSession.user_agent === 'string') {
        try {
          decryptedSession.user_agent = encryptionUtil.decrypt(
            decryptedSession.user_agent
          );
        } catch (decryptError) {
          logger.warn('Failed to decrypt user agent', {
            sessionId: sessionData.session_id,
            error: decryptError.message
          });
        }
      }

      return decryptedSession;
    } catch (error) {
      logger.error('Failed to decrypt session data', {
        sessionId: sessionData?.session_id,
        error: error.message
      });
      throw new AppError('Session data decryption failed', 500, 'DECRYPTION_ERROR');
    }
  }

  /**
   * Hash sensitive data for searching
   */
  async hashForSearch(data) {
    try {
      if (!data || typeof data !== 'string') {
        return data;
      }

      return encryptionUtil.hash(data);
    } catch (error) {
      logger.error('Failed to hash data for search', {
        error: error.message
      });
      throw new AppError('Data hashing failed', 500, 'HASHING_ERROR');
    }
  }

  /**
   * Generate secure token
   */
  async generateSecureToken(length = 32) {
    try {
      return encryptionUtil.generateSecureRandom(length);
    } catch (error) {
      logger.error('Failed to generate secure token', {
        length,
        error: error.message
      });
      throw new AppError('Token generation failed', 500, 'TOKEN_GENERATION_ERROR');
    }
  }

  /**
   * Verify data integrity using HMAC
   */
  async verifyDataIntegrity(data, hmac) {
    try {
      return encryptionUtil.verifyHMAC(data, hmac);
    } catch (error) {
      logger.error('Failed to verify data integrity', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate HMAC for data integrity
   */
  async generateDataIntegrity(data) {
    try {
      return encryptionUtil.generateHMAC(data);
    } catch (error) {
      logger.error('Failed to generate data integrity HMAC', {
        error: error.message
      });
      throw new AppError('HMAC generation failed', 500, 'HMAC_ERROR');
    }
  }

  /**
   * Check if field should be encrypted
   */
  shouldEncryptField(fieldName) {
    return this.encryptedFields.includes(fieldName);
  }

  /**
   * Bulk encrypt user records
   */
  async bulkEncryptUsers(users) {
    try {
      const encryptedUsers = [];
      
      for (const user of users) {
        const encryptedUser = await this.encryptUserData(user);
        encryptedUsers.push(encryptedUser);
      }

      return encryptedUsers;
    } catch (error) {
      logger.error('Failed to bulk encrypt users', {
        userCount: users?.length,
        error: error.message
      });
      throw new AppError('Bulk encryption failed', 500, 'BULK_ENCRYPTION_ERROR');
    }
  }

  /**
   * Bulk decrypt user records
   */
  async bulkDecryptUsers(users) {
    try {
      const decryptedUsers = [];
      
      for (const user of users) {
        const decryptedUser = await this.decryptUserData(user);
        decryptedUsers.push(decryptedUser);
      }

      return decryptedUsers;
    } catch (error) {
      logger.error('Failed to bulk decrypt users', {
        userCount: users?.length,
        error: error.message
      });
      throw new AppError('Bulk decryption failed', 500, 'BULK_DECRYPTION_ERROR');
    }
  }
}

module.exports = new EncryptionService();
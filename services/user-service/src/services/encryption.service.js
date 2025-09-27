const encryptionUtil = require("../utils/encryption.util");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * Encryption Service
 * Handles AES-256 field-level encryption for sensitive user data
 */
class EncryptionService {
  constructor() {
    this.encryptedFields = ["phone", "verification_data"];
  }

  /**
   * Encrypt user data before saving to database
   */
  async encryptUserData(userData, user_id = null) {
    try {
      if (!userData || typeof userData !== "object") {
        return userData;
      }

      let userId = user_id;
      if (!userId) {
        if (userData.id) {
          userId = userData.id;
        } else {
          userId = "new_user";
        }
      }

      const encryptedData = { ...userData };

      // Encrypt specified fields
      for (const field of this.encryptedFields) {
        if (encryptedData[field] && typeof encryptedData[field] === "string") {
          encryptedData[field] = encryptionUtil.encrypt(encryptedData[field]);

          logger.debug("Field encrypted", {
            field,
            userId: userId,
          });
        }
      }

      return encryptedData;
    } catch (error) {
      logger.error("Failed to encrypt user data", {
        userId: userData?.id,
        error: error.message,
        stack: error.stack,
        keyVersion: "primary",
        keyLength: this.primaryKey?.length,
      });
      throw new AppError("Data encryption failed", 500, "ENCRYPTION_ERROR");
    }
  }

  /**
   * Decrypt user data after retrieving from database
   */
  async decryptUserData(userData) {
    try {
      if (!userData || typeof userData !== "object") {
        return userData;
      }

      const decryptedData = { ...userData };

      // Decrypt specified fields
      for (const field of this.encryptedFields) {
        if (decryptedData[field] && typeof decryptedData[field] === "string") {
          try {
            decryptedData[field] = encryptionUtil.decrypt(decryptedData[field]);
          } catch (decryptError) {
            logger.warn("Failed to decrypt field", {
              field,
              userId: userData.id,
              error: decryptError.message,
            });
            // Keep original value if decryption fails
          }
        }
      }

      return decryptedData;
    } catch (error) {
      logger.error("Failed to decrypt user data", {
        userId: userData?.id,
        error: error.message,
        stack: error.stack,
      });
      throw new AppError("Data decryption failed", 500, "DECRYPTION_ERROR");
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
      logger.error("Failed to encrypt verification data", {
        error: error.message,
      });
      throw new AppError(
        "Verification data encryption failed",
        500,
        "ENCRYPTION_ERROR"
      );
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
      logger.error("Failed to decrypt verification data", {
        error: error.message,
      });
      throw new AppError(
        "Verification data decryption failed",
        500,
        "DECRYPTION_ERROR"
      );
    }
  }

  /**
   * Encrypt session data
   */
  async encryptSessionData(sessionData) {
    try {
      if (!sessionData || typeof sessionData !== "object") {
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
      logger.error("Failed to encrypt session data", {
        sessionId: sessionData?.session_id,
        error: error.message,
      });
      throw new AppError(
        "Session data encryption failed",
        500,
        "ENCRYPTION_ERROR"
      );
    }
  }

  /**
   * Decrypt session data
   */
  async decryptSessionData(sessionData) {
    try {
      if (!sessionData || typeof sessionData !== "object") {
        return sessionData;
      }

      const decryptedSession = { ...sessionData };

      // Decrypt device info
      if (
        decryptedSession.device_info &&
        typeof decryptedSession.device_info === "string"
      ) {
        try {
          decryptedSession.device_info = encryptionUtil.decryptJSON(
            decryptedSession.device_info
          );
        } catch (decryptError) {
          logger.warn("Failed to decrypt device info", {
            sessionId: sessionData.session_id,
            error: decryptError.message,
          });
        }
      }

      // Decrypt user agent
      if (
        decryptedSession.user_agent &&
        typeof decryptedSession.user_agent === "string"
      ) {
        try {
          decryptedSession.user_agent = encryptionUtil.decrypt(
            decryptedSession.user_agent
          );
        } catch (decryptError) {
          logger.warn("Failed to decrypt user agent", {
            sessionId: sessionData.session_id,
            error: decryptError.message,
          });
        }
      }

      return decryptedSession;
    } catch (error) {
      logger.error("Failed to decrypt session data", {
        sessionId: sessionData?.session_id,
        error: error.message,
      });
      throw new AppError(
        "Session data decryption failed",
        500,
        "DECRYPTION_ERROR"
      );
    }
  }

  /**
   * Generate a one-way cryptographic hash of the given data.
   *
   * Uses Node.js `crypto` to hash a string with the specified algorithm
   * (default: `"sha256"`). If the input is not a non-empty string.
   *
   * ⚠️ Security Note:
   * - This method is not suitable for password storage — use a key-derivation
   *   function such as bcrypt, scrypt, or Argon2 instead.
   *
   * @param {string} data - The sensitive data to be hashed.
   * @param {string} [algorithm="sha256"] - The hashing algorithm (e.g., "sha256", "sha512").
   *
   * @throws {AppError} If hashing fails due to invalid algorithm or crypto error.
   *
   * @returns {string} The hexadecimal hash string of the input data, or the input itself if invalid.
   */
  hashData(data) {
    return encryptionUtil.hash(data);
  }

  /**
   * Encrypt single string
   */
  async encryptSingleString(value) {
    try {
      if (!value || typeof value !== "string") {
        return value; // only encrypt strings
      }

      const encrypted = encryptionUtil.encrypt(value);

      logger.debug("String encrypted successfully", { length: value.length });

      return encrypted;
    } catch (error) {
      logger.error("Failed to encrypt string", {
        error: error.message,
        stack: error.stack,
        keyVersion: "primary",
        keyLength: this.primaryKey?.length,
      });
      throw new AppError("String encryption failed", 500, "ENCRYPTION_ERROR");
    }
  }

  /**
   * Decrypt single string
   */
  async decryptSingleString(value) {
    try {
      if (!value || typeof value !== "string") {
        return value; // only decrypt strings
      }

      const decrypted = encryptionUtil.decrypt(value);

      logger.debug("String decrypted successfully", { length: value.length });

      return decrypted;
    } catch (error) {
      logger.error("Failed to decrypt string", {
        error: error.message,
        stack: error.stack,
        keyVersion: "primary",
        keyLength: this.primaryKey?.length,
      });
      throw new AppError("String decryption failed", 500, "DECRYPTION_ERROR");
    }
  }

  /**
   * Generate secure token
   */
  async generateSecureToken(length = 32) {
    try {
      return encryptionUtil.generateSecureRandom(length);
    } catch (error) {
      logger.error("Failed to generate secure token", {
        length,
        error: error.message,
      });
      throw new AppError(
        "Token generation failed",
        500,
        "TOKEN_GENERATION_ERROR"
      );
    }
  }

  /**
   * Verify data integrity using HMAC
   */
  async verifyDataIntegrity(data, hmac) {
    try {
      return encryptionUtil.verifyHMAC(data, hmac);
    } catch (error) {
      logger.error("Failed to verify data integrity", {
        error: error.message,
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
      logger.error("Failed to generate data integrity HMAC", {
        error: error.message,
      });
      throw new AppError("HMAC generation failed", 500, "HMAC_ERROR");
    }
  }

  /**
   * Bulk encrypt users(many users) records
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
      logger.error("Failed to bulk encrypt users", {
        userCount: users?.length,
        error: error.message,
      });
      throw new AppError(
        "Bulk encryption failed",
        500,
        "BULK_ENCRYPTION_ERROR"
      );
    }
  }

  /**
   * Bulk decrypt users records
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
      logger.error("Failed to bulk decrypt users", {
        userCount: users?.length,
        error: error.message,
      });
      throw new AppError(
        "Bulk decryption failed",
        500,
        "BULK_DECRYPTION_ERROR"
      );
    }
  }
}

module.exports = new EncryptionService();

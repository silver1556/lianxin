const crypto = require("crypto");
const securityConfig = require("../config/security.config");
const logger = require("../../../../shared/utils/logger.util");
const AppError = require("../../../../shared/errors/appError");

/**
 * Encryption Utility Class
 * Handles field-level encryption for sensitive user data
 */
class EncryptionUtil {
  constructor() {
    this.algorithm = securityConfig.encryption.algorithm;
    this.keyLength = securityConfig.encryption.keyLength;
    this.ivLength = securityConfig.encryption.ivLength;
    this.tagLength = securityConfig.encryption.tagLength;
    this.primaryKey = Buffer.from(securityConfig.encryption.primaryKey, "hex");
    this.secondaryKey = Buffer.from(
      securityConfig.encryption.secondaryKey,
      "hex"
    );
    this.encryptedFields = securityConfig.encryption.encryptedFields;

    this.validateConfiguration();
  }

  /**
   * Validate encryption configuration
   */
  validateConfiguration() {
    if (!this.primaryKey || this.primaryKey.length !== this.keyLength) {
      throw AppError.configurationError("Invalid primary key configuration");
    }

    if (!this.algorithm || !crypto.getCiphers().includes(this.algorithm)) {
      throw AppError.invalidAlgorithmError(
        `Unsupported algorithm: ${this.algorithm}`
      );
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data, keyVersion = "primary") {
    try {
      if (!data || typeof data !== "string") {
        return data;
      }

      const key =
        keyVersion === "primary" ? this.primaryKey : this.secondaryKey;
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
        authTagLength: this.tagLength,
      });

      let encrypted = cipher.update(data, "utf8", "hex");
      encrypted += cipher.final("hex");

      const tag = cipher.getAuthTag();

      // Combine IV, tag, and encrypted data
      const result = {
        data: encrypted,
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        version: keyVersion,
        algorithm: this.algorithm,
      };

      return JSON.stringify(result);
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw AppError.encryptionError(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== "string") {
        return encryptedData;
      }

      let parsedData;
      try {
        parsedData = JSON.parse(encryptedData);
      } catch {
        // If not JSON, assume it's plain text
        return encryptedData;
      }

      if (!parsedData.data || !parsedData.iv || !parsedData.tag) {
        return encryptedData;
      }

      const key =
        parsedData.version === "primary" ? this.primaryKey : this.secondaryKey;
      const iv = Buffer.from(parsedData.iv, "hex");
      const tag = Buffer.from(parsedData.tag, "hex");

      const decipher = crypto.createDecipheriv(
        parsedData.algorithm || this.algorithm,
        key,
        iv,
        { authTagLength: this.tagLength }
      );
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(parsedData.data, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw AppError.decryptionError(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt user object fields
   */
  encryptUserFields(user) {
    if (!user || typeof user !== "object") {
      return user;
    }

    const encryptedUser = { ...user };

    this.encryptedFields.forEach((field) => {
      if (encryptedUser[field] && typeof encryptedUser[field] === "string") {
        encryptedUser[field] = this.encrypt(encryptedUser[field]);
      }
    });

    return encryptedUser;
  }

  /**
   * Decrypt user object fields
   */
  decryptUserFields(user) {
    if (!user || typeof user !== "object") {
      return user;
    }

    const decryptedUser = { ...user };

    this.encryptedFields.forEach((field) => {
      if (decryptedUser[field] && typeof decryptedUser[field] === "string") {
        try {
          decryptedUser[field] = this.decrypt(decryptedUser[field]);
        } catch (error) {
          logger.warn("Failed to decrypt field", {
            field,
            userId: user.id,
            error: error.message,
          });
          // Keep original value if decryption fails, don't throw
        }
      }
    });

    return decryptedUser;
  }

  /**
   * Generate encryption key
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength).toString("hex");
  }

  /**
   * Generate initialization vector
   */
  generateIV() {
    return crypto.randomBytes(this.ivLength).toString("hex");
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

  hash(data, algorithm = "sha256") {
    try {
      if (!data || typeof data !== "string") {
        return data;
      }

      return crypto.createHash(algorithm).update(data).digest("hex");
    } catch (error) {
      throw AppError.hashingError(`Hashing failed: ${error.message}`);
    }
  }

  /**
   * Generate HMAC for data integrity
   */
  generateHMAC(data, secret = null) {
    try {
      const key = secret || this.primaryKey;
      return crypto.createHmac("sha256", key).update(data).digest("hex");
    } catch (error) {
      throw AppError.hmacGenerationError(
        `HMAC generation failed: ${error.message}`
      );
    }
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data, hmac, secret = null) {
    try {
      const expectedHMAC = this.generateHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(hmac, "hex"),
        Buffer.from(expectedHMAC, "hex")
      );
    } catch (error) {
      logger.error("HMAC verification failed", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Encrypt JSON data
   */
  encryptJSON(data, keyVersion = "primary") {
    try {
      const jsonString = JSON.stringify(data);
      return this.encrypt(jsonString, keyVersion);
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw AppError.jsonEncryptionError(
        `JSON encryption failed: ${error.message}`
      );
    }
  }

  /**
   * Decrypt JSON data
   */
  decryptJSON(encryptedData, keyVersion = "primary") {
    try {
      const decryptedString = this.decrypt(encryptedData, keyVersion);
      return JSON.parse(decryptedString);
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw AppError.jsonDecryptionError(
        `JSON decryption failed: ${error.message}`
      );
    }
  }

  /**
   * Secure random string generation
   */
  generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Constant time string comparison
   */
  constantTimeCompare(a, b) {
    if (typeof a !== "string" || typeof b !== "string") {
      return false;
    }

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Key derivation function
   */
  deriveKey(password, salt, iterations = 100000, keyLength = 32) {
    try {
      return crypto.pbkdf2Sync(password, salt, iterations, keyLength, "sha256");
    } catch (error) {
      throw AppError.keyDerivationError(
        `Key derivation failed: ${error.message}`
      );
    }
  }

  /**
   * Encrypt file data
   */
  encryptFile(fileBuffer, keyVersion = "primary") {
    try {
      const key =
        keyVersion === "primary" ? this.primaryKey : this.secondaryKey;
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
        authTagLength: this.tagLength,
      });

      const encrypted = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final(),
      ]);

      const tag = cipher.getAuthTag();

      return {
        data: encrypted,
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        version: keyVersion,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw AppError.fileEncryptionError(
        `File encryption failed: ${error.message}`
      );
    }
  }

  /**
   * Decrypt file data
   */
  decryptFile(encryptedFile) {
    try {
      const key =
        encryptedFile.version === "primary"
          ? this.primaryKey
          : this.secondaryKey;
      const iv = Buffer.from(encryptedFile.iv, "hex");
      const tag = Buffer.from(encryptedFile.tag, "hex");

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv, {
        authTagLength: this.tagLength,
      });
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedFile.data),
        decipher.final(),
      ]);

      return decrypted;
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw AppError.fileDecryptionError(
        `File decryption failed: ${error.message}`
      );
    }
  }

  /**
   * Check if field should be encrypted
   */
  shouldEncryptField(fieldName) {
    return this.encryptedFields.includes(fieldName);
  }

  /**
   * Rotate encryption keys
   */
  rotateKeys() {
    logger.info("Key rotation initiated");
    // Implementation would depend on HSM integration
    // This is a placeholder for the key rotation process
    return {
      rotated: true,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new EncryptionUtil();

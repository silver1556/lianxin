const encryptionService = require("../services/encryption.service");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * Encryption Middleware
 * Handles automatic field encryption/decryption for sensitive data
 */
class EncryptionMiddleware {
  /**
   * Encrypt request data before processing
   */
  async encryptRequestData(req, res, next) {
    try {
      if (req.body && typeof req.body === "object") {
        // Encrypt sensitive fields in request body
        req.body = await encryptionService.encryptUserData(req.body);

        logger.debug("Request data encrypted", {
          fields: Object.keys(req.body),
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("Request data encryption failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(new AppError("Data encryption failed", 500, "ENCRYPTION_ERROR"));
    }
  }

  /**
   * Decrypt response data before sending
   */
  async decryptResponseData(req, res, next) {
    try {
      // Store original json method
      const originalJson = res.json;

      // Override json method to decrypt data
      res.json = async function (data) {
        try {
          if (data && data.data) {
            // Decrypt user data if present
            if (data.data.user) {
              data.data.user = await encryptionService.decryptUserData(
                data.data.user
              );
            }

            // Decrypt users array if present
            if (data.data.users && Array.isArray(data.data.users)) {
              data.data.users = await encryptionService.bulkDecryptUsers(
                data.data.users
              );
            }

            // Decrypt settings if present
            if (data.data.settings) {
              data.data.settings = await encryptionService.decryptSettingsData(
                data.data.settings
              );
            }
          }

          logger.debug("Response data decrypted", {
            hasUser: !!data?.data?.user,
            hasUsers: !!data?.data?.users,
            hasSettings: !!data?.data?.settings,
            requestId: req.requestId,
          });

          // Call original json method
          return originalJson.call(this, data);
        } catch (decryptError) {
          logger.error("Response data decryption failed", {
            error: decryptError.message,
            requestId: req.requestId,
          });

          // Return original data if decryption fails
          return originalJson.call(this, data);
        }
      };

      next();
    } catch (error) {
      logger.error("Response encryption middleware setup failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Encrypt specific fields in request
   */
  encryptFields(fields) {
    return async (req, res, next) => {
      try {
        if (req.body && typeof req.body === "object") {
          for (const field of fields) {
            if (req.body[field] && typeof req.body[field] === "string") {
              req.body[field] = await encryptionService.encrypt(
                req.body[field]
              );
            }
          }

          logger.debug("Specific fields encrypted", {
            fields,
            requestId: req.requestId,
          });
        }

        next();
      } catch (error) {
        logger.error("Field encryption failed", {
          fields,
          error: error.message,
          requestId: req.requestId,
        });

        next(
          new AppError("Field encryption failed", 500, "FIELD_ENCRYPTION_ERROR")
        );
      }
    };
  }

  /**
   * Decrypt specific fields in response
   */
  decryptFields(fields) {
    return async (req, res, next) => {
      try {
        // Store original json method
        const originalJson = res.json;

        // Override json method to decrypt specific fields
        res.json = async function (data) {
          try {
            if (data && data.data) {
              for (const field of fields) {
                if (data.data[field] && typeof data.data[field] === "string") {
                  data.data[field] = await encryptionService.decrypt(
                    data.data[field]
                  );
                }
              }
            }

            logger.debug("Specific fields decrypted", {
              fields,
              requestId: req.requestId,
            });

            return originalJson.call(this, data);
          } catch (decryptError) {
            logger.error("Field decryption failed", {
              fields,
              error: decryptError.message,
              requestId: req.requestId,
            });

            return originalJson.call(this, data);
          }
        };

        next();
      } catch (error) {
        logger.error("Field decryption middleware setup failed", {
          fields,
          error: error.message,
          requestId: req.requestId,
        });

        next(error);
      }
    };
  }

  /**
   * Encrypt user profile data
   */
  async encryptUserProfile(req, res, next) {
    try {
      if (req.body && typeof req.body === "object") {
        // Encrypt user profile fields
        const encryptedData = await encryptionService.encryptUserData(req.body);
        req.body = encryptedData;

        logger.debug("User profile data encrypted", {
          fields: Object.keys(req.body),
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("User profile encryption failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(
        new AppError(
          "Profile encryption failed",
          500,
          "PROFILE_ENCRYPTION_ERROR"
        )
      );
    }
  }

  /**
   * Encrypt settings data
   */
  async encryptSettings(req, res, next) {
    try {
      if (req.body && typeof req.body === "object") {
        // Encrypt settings data
        const encryptedSettings = await encryptionService.encryptSettingsData(
          req.body
        );
        req.body = encryptedSettings;

        logger.debug("Settings data encrypted", {
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("Settings encryption failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(
        new AppError(
          "Settings encryption failed",
          500,
          "SETTINGS_ENCRYPTION_ERROR"
        )
      );
    }
  }

  /**
   * Generate data integrity hash
   */
  async generateIntegrityHash(req, res, next) {
    try {
      if (req.body && typeof req.body === "object") {
        // Generate HMAC for data integrity
        const dataString = JSON.stringify(req.body);
        const integrityHash = await encryptionService.generateDataIntegrity(
          dataString
        );

        // Add integrity hash to headers
        res.set("X-Data-Integrity", integrityHash);

        logger.debug("Data integrity hash generated", {
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("Integrity hash generation failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Verify data integrity hash
   */
  async verifyIntegrityHash(req, res, next) {
    try {
      const integrityHash = req.get("X-Data-Integrity");

      if (integrityHash && req.body && typeof req.body === "object") {
        const dataString = JSON.stringify(req.body);
        const isValid = await encryptionService.verifyDataIntegrity(
          dataString,
          integrityHash
        );

        if (!isValid) {
          throw new AppError(
            "Data integrity verification failed",
            400,
            "INTEGRITY_VERIFICATION_FAILED"
          );
        }

        logger.debug("Data integrity verified", {
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("Integrity verification failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }

  /**
   * Encrypt file data
   */
  async encryptFileData(req, res, next) {
    try {
      if (req.file && req.file.buffer) {
        // Encrypt file buffer
        const encryptedFile = await encryptionService.encryptFile(
          req.file.buffer
        );

        // Store encrypted data
        req.file.encryptedData = encryptedFile;
        req.file.isEncrypted = true;

        logger.debug("File data encrypted", {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("File encryption failed", {
        fileName: req.file?.originalname,
        error: error.message,
        requestId: req.requestId,
      });

      next(
        new AppError("File encryption failed", 500, "FILE_ENCRYPTION_ERROR")
      );
    }
  }

  /**
   * Decrypt file data
   */
  async decryptFileData(req, res, next) {
    try {
      if (req.file && req.file.encryptedData) {
        // Decrypt file data
        const decryptedBuffer = await encryptionService.decryptFile(
          req.file.encryptedData
        );

        // Replace buffer with decrypted data
        req.file.buffer = decryptedBuffer;
        req.file.isEncrypted = false;

        logger.debug("File data decrypted", {
          fileName: req.file.originalname,
          requestId: req.requestId,
        });
      }

      next();
    } catch (error) {
      logger.error("File decryption failed", {
        fileName: req.file?.originalname,
        error: error.message,
        requestId: req.requestId,
      });

      next(
        new AppError("File decryption failed", 500, "FILE_DECRYPTION_ERROR")
      );
    }
  }

  /**
   * Secure token generation
   */
  async generateSecureToken(req, res, next) {
    try {
      // Generate secure token for the request
      const secureToken = await encryptionService.generateSecureToken();

      // Add token to request for use in controllers
      req.secureToken = secureToken;

      // Add token to response headers
      res.set("X-Secure-Token", secureToken);

      logger.debug("Secure token generated", {
        tokenLength: secureToken.length,
        requestId: req.requestId,
      });

      next();
    } catch (error) {
      logger.error("Secure token generation failed", {
        error: error.message,
        requestId: req.requestId,
      });

      next(error);
    }
  }
}

module.exports = new EncryptionMiddleware();

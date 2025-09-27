const ValidationError = require("../../../../shared/errors/validationError");
const phoneUtil = require("./phone.util");
const passwordUtil = require("./password.util");
const logger = require("../../../../shared/utils/logger.util");
const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

// Import schemas
const baseSchemas = require("../schemas/base.schema");
const authSchemas = require("../schemas/auth.schema");
const userSchemas = require("../schemas/user.schema");
const settingsSchemas = require("../schemas/settings.schema");

// Initialize DOMPurify for server-side HTML sanitization
const window = new JSDOM("").window;
const purify = DOMPurify(window);

/**
 * Validation Utility Class
 * Provides validation functions using centralized schemas
 * Only contains business logic validation, not schema definitions
 */
class ValidationUtil {
  /**
   * Validate a phone number against schema rules and business logic.
   *
   * @param {string} phoneNumber - Phone number provided by the user (without country code).
   *   Example: `"15680026773"`.
   * @param {string} countryCode - Country dialing code in E.164 format.
   *   Example: `"+86"`.
   * @returns {Object} Parsed and validated phone number details:
   *   - {boolean} isValid - `true` if validation passes.
   *   - {string} formatted - Formatted in international style (e.g., `"+86 138 0013 8000"`).
   *   - {string} e164 - E.164 format for storage/communication (e.g., `"+8613800138000"`).
   *   - {string} national - Local/national format (e.g., `"138 0013 8000"`).
   *   - {string} countryCode - Country dialing code (e.g., `"+86"`).
   *   - {string} country - ISO 2-letter country code (e.g., `"CN"`).
   *   - {string} type - Phone type (e.g., `"MOBILE"`, `"FIXED_LINE"`).
   *   - {string|null} carrier - Carrier info if available, otherwise `null`.
   * @throws {ValidationError}
   *   - If `phoneNumber` or `countryCode` is missing.
   *   - If the country code is unsupported.
   *   - If parsing or validation fails.
   *   - If country code is "+86", but invalid chinese number
   */

  validatePhoneNumber(phoneNumber, countryCode) {
    try {
      // validate with phone utility for business logic
      return phoneUtil.validatePhoneNumber(phoneNumber, countryCode);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw ValidationError.invalidPhoneNumber(phoneNumber, error.message);
    }
  }

  /**
   * Validate password using password schema and password utility
   */
  validatePassword(password) {
    try {
      // First validate with schema
      const { error } = baseSchemas.passwordSchema.validate(password);
      if (error) {
        const messages = error.details.map((d) => d.message);

        throw ValidationError.invalidPassword(
          messages,
          "Password validation failed"
        );
      }

      // Then validate with password utility for business logic
      return passwordUtil.validatePassword(password);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw ValidationError.invalidPassword(
        [error.message],
        "Password validation failed"
      );
    }
  }

  /**
   * Validate OTP code using base schema
   */
  validateOTP(otpCode) {
    const { error } = baseSchemas.otpCodeSchema.validate(otpCode, {
      abortEarly: false,
    });
    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "OTP validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return true;
  }

  /**
   * Validate user registration data using auth schema
   */
  validateRegistration(data) {
    const { error, value } = authSchemas.userRegistrationSchema.validate(data, {
      abortEarly: false, // collect all errors
    });

    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "Registration validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }

  /**
   * Validate user login data using auth schemas
   */
  validateLogin(data) {
    let schemaResult;

    if (data.password) {
      // Password login
      schemaResult = authSchemas.userLoginPasswordSchema.validate(data, {
        abortEarly: false,
      });
    } else {
      // OTP login
      schemaResult = authSchemas.userLoginOtpSchema.validate(data, {
        abortEarly: false,
      });
    }

    const { error, value } = schemaResult;
    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "Login validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }

  /**
   * Validate profile update data using user schema
   */
  validateProfileUpdate(data, schema) {
    let validationResult;

    switch (schema) {
      case "profileUpdateSchema":
        validationResult = userSchemas.profileUpdateSchema.validate(data, {
          abortEarly: false, // optional: collect all errors
        });
        break;

      case "educationFieldsSchema":
        validationResult = userSchemas.educationFieldsSchema.validate(data, {
          abortEarly: false,
        });
        break;

      case "privacyFieldsSchema":
        validationResult = userSchemas.privacyFieldsSchema.validate(data, {
          abortEarly: false,
        });
        break;

      default:
        throw ValidationError.custom(
          "schema",
          `Unknown schema: ${schema}`,
          schema,
          "unknown_schema"
        );
    }

    const { error, value } = validationResult;

    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "Profile validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }

    return value;
  }

  /**
   * Validate single setting value
   */
  validateSettingValue(category, field, value) {
    let schema;

    switch (category) {
      case "privacy":
        schema = settingsSchemas.privacySettingsSchema;
        break;
      case "notification":
        schema = settingsSchemas.notificationSettingsSchema;
        break;
      case "display":
        schema = settingsSchemas.displaySettingsSchema;
        break;
      case "security":
        schema = settingsSchemas.securitySettingsSchema;
        break;
      default:
        throw ValidationError.custom(
          "category",
          "Invalid settings category",
          category,
          "invalid_category"
        );
    }

    // Create a schema for just this field
    const fieldSchema = settingsSchemas.createFieldSchema(schema, field);

    const { error } = fieldSchema.validate({ [field]: value });
    if (error) {
      throw ValidationError.custom(
        field,
        error.details[0].message,
        value,
        error.details[0].type
      );
    }
    return true;
  }

  /**
   * Validate password change data using auth schema
   */
  validatePasswordChange(data) {
    const { error, value } = authSchemas.passwordChangeSchema.validate(data, {
      abortEarly: false,
    });
    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "Password change validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }

  /**
   * Validate phone number change data using auth schema
   */
  validatePhoneChange(data) {
    const { error, value } = authSchemas.phoneNumberChangeSchema.validate(data);
    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "Phone change validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }

  /**
   * Validate password reset using auth schema
   */
  validatePasswordReset(data) {
    const { error, value } = authSchemas.passwordResetSchema.validate(data);
    if (error) {
      // Initialize ValidationError with message and empty errors array
      const validationError = new ValidationError(
        "Password reset validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }

  /**
   * Validate file upload using base schema with business logic
   */
  validateFileUpload(file, type = "avatar") {
    if (!file) {
      throw ValidationError.requiredField("file", "File is required");
    }

    // Use base schema for file structure validation
    const { error } = baseSchemas.fileUploadSchema.validate(file);
    if (error) {
      throw ValidationError.custom(
        "file",
        error.details[0].message,
        file.originalname,
        error.details[0].type
      );
    }

    // Business logic for different file types
    const allowedTypes = {
      avatar: ["image/jpeg", "image/png", "image/webp"],
      cover_photo: ["image/jpeg", "image/png", "image/webp"],
      midia: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ],
      document: ["application/pdf", "application/msword"],
    };

    const maxSizes = {
      avatar: 10 * 1024 * 1024, // 10MB
      cover: 10 * 1024 * 1024, // 10MB
      document: 20 * 1024 * 1024, // 20MB
    };

    if (!allowedTypes[type]?.includes(file.mimetype)) {
      throw ValidationError.invalidFileType(
        "file",
        file.mimetype,
        allowedTypes[type],
        `Invalid file type for ${type}. Allowed types: ${allowedTypes[
          type
        ]?.join(", ")}`
      );
    }

    if (file.size > maxSizes[type]) {
      throw ValidationError.fileSizeTooLarge(
        "file",
        file.size,
        maxSizes[type],
        `File size too large for ${type}. Maximum size: ${
          maxSizes[type] / (1024 * 1024)
        }MB`
      );
    }

    return true;
  }

  /**
   * Validate pagination using base schema
   */
  validatePagination(limit = 20, offset = 0) {
    const { error, value } = baseSchemas.paginationSchema.validate({
      limit,
      offset,
    });
    if (error) {
      throw ValidationError.custom(
        "pagination",
        error.details[0].message,
        { limit, offset },
        "pagination_format"
      );
    }

    return value;
  }

  /**
   * Validate OTP request type using auth schema
   */
  validateOTPRequest(data, type = "login") {
    let schema;
    let countryCode = "+86"; // Default country code

    switch (type) {
      case "registration":
        schema = authSchemas.registrationOtpRequestSchema;
        break;
      case "login":
        schema = authSchemas.loginOtpRequestSchema;
        break;
      case "password_reset":
        schema = authSchemas.passwordResetOtpRequestSchema;
        break;
      case "phone_change":
        schema = authSchemas.phoneChangeOtpRequestSchema;
        break;
      default:
        throw ValidationError.custom(
          "type",
          "Invalid OTP request type",
          type,
          "invalid_otp_type"
        );
    }

    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
      const validationError = new ValidationError(
        "OTP request validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }

    // Extract country code if available in the data
    if (value.country_code) {
      countryCode = value.country_code;
    }

    // Validate with country code
    if (value.phone) {
      this.validatePhoneNumber(value.phone, countryCode);
    }

    if (value.new_phone) {
      this.validatePhoneNumber(value.new_phone, countryCode);
    }

    return value;
  }

  /**
   * Sanitize HTML content using DOMpurify(business logic)
   */
  sanitizeHtml(content) {
    if (!content) return content;

    try {
      // Use DOMPurify for robust HTML sanitization
      return purify.sanitize(content, {
        ALLOWED_TAGS: ["b", "i", "em", "strong", "u", "br", "p"],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        RETURN_DOM_IMPORT: false,
      });
    } catch (error) {
      logger.error("HTML sanitization failed, falling back to basic cleaning", {
        error: error.message,
        stack: error.stack,
      });

      // Fallback to basic sanitization
      return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\s*javascript\s*:/gi, "");
    }
  }

  /**
   * Validate token refresh using auth schema
   */
  validateTokenRefresh(data) {
    const { error, value } = authSchemas.tokenRefreshSchema.validate(data);
    if (error) {
      throw ValidationError.custom(
        "token",
        error.details[0].message,
        data,
        "token_refresh_format"
      );
    }
    return value;
  }

  /**
   * Validate login attempt payload
   */
  validateLoginAttempt(data) {
    return this.validateWithSchema(
      authSchemas.loginAttemptSchema,
      data,
      "Login attempt validation failed"
    );
  }

  /**
   * Validate account lockout payload
   */
  validateAccountLockout(data) {
    return this.validateWithSchema(
      authSchemas.accountLockoutSchema,
      data,
      "Account lockout validation failed"
    );
  }

  /**
   * Validate authentication event
   */
  validateAuthEvent(data) {
    return this.validateWithSchema(
      authSchemas.authEventSchema,
      data,
      "Auth event validation failed"
    );
  }

  /**
   * Validate rate limit check
   */
  validateRateLimit(data) {
    return this.validateWithSchema(
      authSchemas.rateLimitSchema,
      data,
      "Rate limit validation failed"
    );
  }

  /**
   * Validate security headers
   */
  validateSecurityHeaders(headers) {
    return this.validateWithSchema(
      authSchemas.securityHeadersSchema,
      headers,
      "Security headers validation failed"
    );
  }

  /**
   * Validate session validation payload
   */
  validateSessionValidation(data) {
    return this.validateWithSchema(
      authSchemas.sessionValidationSchema,
      data,
      "Session validation failed"
    );
  }

  /**
   * Validate session revocation data
   */
  validateSessionRevocation(data) {
    return this.validateWithSchema(
      userSchemas.sessionRevocationSchema,
      data,
      "Session revocation validation failed"
    );
  }

  /**
   * Validate account deactivation data
   */
  validateAccountDeactivation(data) {
    return this.validateWithSchema(
      userSchemas.accountDeactivationSchema,
      data,
      "Account deactivation validation failed"
    );
  }

  /**
   * Validate account deletion data
   */
  validateAccountDeletion(data) {
    return this.validateWithSchema(
      userSchemas.accountDeletionSchema,
      data,
      "Account deletion validation failed"
    );
  }

  /**
   * Validate export settings input
   */
  validateSettingsExport(data) {
    return this.validateWithSchema(
      settingsSchemas.settingsExportSchema,
      data,
      "Settings export validation failed"
    );
  }

  /**
   * Validate settings import
   */
  validateSettingsImport(data) {
    return this.validateWithSchema(
      settingsSchemas.settingsImportSchema,
      data,
      "Settings import validation failed"
    );
  }

  /**
   * Validate settings backup creation
   */
  validateSettingsBackup(data) {
    return this.validateWithSchema(
      settingsSchemas.settingsBackupSchema,
      data,
      "Settings backup validation failed"
    );
  }

  /**
   * Validate UUID format using base schema
   */
  validateUUID(uuid) {
    const { error } = baseSchemas.uuidSchema.validate(uuid);
    if (error) {
      throw ValidationError.custom(
        "uuid",
        error.details[0].message,
        uuid,
        "uuid_format"
      );
    }
    return true;
  }

  /**
   * Validate device information using base schema
   */
  validateDeviceInfo(deviceInfo) {
    const { error, value } = baseSchemas.deviceSchema.validate(deviceInfo, {
      abortEarly: false,
    });
    if (error) {
      const validationError = new ValidationError(
        "Device validation failed",
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          detail.path.join("."),
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }

  /**
   * Validate JWT token format using base schema
   */
  validateJWTToken(token) {
    const { error } = baseSchemas.jwtTokenSchema.validate(token);
    if (error) {
      throw ValidationError.custom(
        "token",
        error.details[0].message,
        token,
        "jwt_format"
      );
    }
    return true;
  }

  /**
   * Generic schema validation wrapper
   */
  validateWithSchema(schema, data, errorMessage = "Validation failed") {
    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
      const validationError = new ValidationError(
        errorMessage,
        400, // optional status code
        [], // initialize errors array
        "VALIDATION_ERROR" // optional error code
      );

      // Add each Joi error to ValidationError
      error.details.forEach((detail) => {
        validationError.addError(
          Array.isArray(detail.path) ? detail.path.join(".") : detail.path,
          detail.message,
          detail.context?.value ?? null,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }
}

module.exports = new ValidationUtil();

const { ValidationError } = require('../errors/validationError');
const phoneUtil = require('./phone.util');
const passwordUtil = require('./password.util');
const logger = require('./logger.util');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Import schemas
const baseSchemas = require('../schemas/base.schema');
const authSchemas = require('../schemas/auth.schema');
const userSchemas = require('../schemas/user.schema');
const settingsSchemas = require('../schemas/settings.schema');

// Initialize DOMPurify for server-side HTML sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window);

/**
 * Validation Utility Class
 * Provides validation functions using centralized schemas
 * Only contains business logic validation, not schema definitions
 */
class ValidationUtil {
  constructor() {
    this.supportedCountryCodes = ['+86', '+852', '+853', '+886'];
  }

  /**
     * Validate phone number using phone schema and phone utility
     */
  validatePhoneNumber(phone, countryCode = null) {
    try {
      // First validate with schema
      const { error } = baseSchemas.phoneSchema.validate(phone);
      if (error) {
        throw ValidationError.invalidPhoneNumber(phone, error.details[0].message);
      }

      // Then validate with phone utility for business logic
      return phoneUtil.validatePhoneNumber(phone, countryCode);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw ValidationError.invalidPhoneNumber(phone, error.message);
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
        throw ValidationError.invalidPassword(error.details[0].message);
      }

      // Then validate with password utility for business logic
      return passwordUtil.validatePassword(password);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw ValidationError.invalidPassword(error.message);
    }
  }

  /**
   * Validate OTP code using base schema
   */
  validateOTP(otpCode) {
    const { error } = baseSchemas.otpCodeSchema.validate(otpCode);
    if (error) {
      throw ValidationError.invalidOTP(error.details[0].message);
    }
    return true;
  }

  /**
     * Validate user registration data using auth schema
     */
  validateRegistration(data) {
    const { error, value } = authSchemas.userRegistrationSchema.validate(data);
    if (error) {
      const validationError = new ValidationError('Registration validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
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
      schemaResult = authSchemas.userLoginPasswordSchema.validate(data);
    } else {
      // OTP login
      schemaResult = authSchemas.userLoginOtpSchema.validate(data);
    }

    const { error, value } = schemaResult;
    if (error) {
      const validationError = new ValidationError('Login validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
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
  validateProfileUpdate(data) {
    const { error, value } = userSchemas.profileUpdateSchema.validate(data);
    if (error) {
      const validationError = new ValidationError('Profile validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
          detail.type
        );
      });
      throw validationError;
    }

    // Additional bio content validation (business logic)
    if (value.bio) {
      this.validateBioContent(value.bio);
    }

    return value;
  }

  /**
     * Validate bio content for inappropriate content (business logic)
     */
  validateBioContent(bio) {
    // Remove HTML tags
    const cleanBio = bio.replace(/<[^>]*>/g, '');

    // Check for prohibited content patterns
    const prohibitedPatterns = [
      /\b(fuck|shit|damn|bitch)\b/gi,
      /\b(政治|政府|共产党)\b/g, // Political content
      /\b(色情|黄色|成人)\b/g, // Adult content
      /\b(赌博|博彩|彩票)\b/g, // Gambling content
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(cleanBio)) {
        throw ValidationError.custom(
          'bio',
          'Bio contains prohibited content',
          bio,
          'content_moderation'
        );
      }
    }

    return true;
  }

  /**
     * Validate settings update data using settings schema
     */
  validateSettingsUpdate(data) {
    const { error, value } = settingsSchemas.settingsUpdateSchema.validate(data);
    if (error) {
      const validationError = new ValidationError('Settings validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path.join('.'),
          detail.message,
          detail.context.value,
          detail.type
        );
      });
      throw validationError;
    }

    return value;
  }

  /**
     * Validate password change data using auth schema
     */
  validatePasswordChange(data) {
    const { error, value } = authSchemas.passwordChangeSchema.validate(data);
    if (error) {
      const validationError = new ValidationError('Password change validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
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
      const validationError = new ValidationError('Phone change validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
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
      const validationError = new ValidationError('Password reset validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
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
  validateFileUpload(file, type = 'avatar') {
    if (!file) {
      throw ValidationError.requiredField('file', 'File is required');
    }

    // Use base schema for file structure validation
    const { error } = baseSchemas.fileUploadSchema.validate(file);
    if (error) {
      throw ValidationError.invalidFile(
        'file',
        error.details[0].message,
        file.originalname,
        error.details[0].type
      );
    }

    // Business logic for different file types
    const allowedTypes = {
      avatar: ['image/jpeg', 'image/png', 'image/webp'],
      cover: ['image/jpeg', 'image/png', 'image/webp'],
      document: ['application/pdf', 'application/msword']
    };

    const maxSizes = {
      avatar: 5 * 1024 * 1024, // 5MB
      cover: 10 * 1024 * 1024,  // 10MB
      document: 20 * 1024 * 1024 // 20MB
    };

    if (!allowedTypes[type]?.includes(file.mimetype)) {
      throw ValidationError.invalidFile(
        'file',
        `Invalid file type for ${type}. Allowed types: ${allowedTypes[type]?.join(', ')}`,
        file.originalname,
        'file_type'
      );
    }

    if (file.size > maxSizes[type]) {
      throw ValidationError.invalidFile(
        'file',
        `File size too large for ${type}. Maximum size: ${maxSizes[type] / (1024 * 1024)}MB`,
        file.originalname,
        'file_size'
      );
    }

    return true;
  }

  /**
     * Validate pagination using base schema
     */
  validatePagination(limit = 20, offset = 0) {
    const { error, value } = baseSchemas.paginationSchema.validate({ limit, offset });
    if (error) {
      throw ValidationError.custom('pagination', error.details[0].message);
    }

    return value;
  }

  /**
     * Validate OTP request type using auth schema
     */
  validateOTPRequest(data, type = 'login') {
    let schema;

    switch (type) {
      case 'registration':
        schema = authSchemas.registrationOtpRequestSchema;
        break;
      case 'login':
        schema = authSchemas.loginOtpRequestSchema;
        break;
      case 'password_reset':
        schema = authSchemas.passwordResetOtpRequestSchema;
        break;
      case 'phone_change':
        schema = authSchemas.phoneChangeOtpRequestSchema;
        break;
      default:
        throw ValidationError.custom('type', 'Invalid OTP request type');
    }

    const { error, value } = schema.validate(data);
    if (error) {
      const validationError = new ValidationError('OTP request validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
          detail.type
        );
      });
      throw validationError;
    }

    // Additional phone validation (business logic)
    if (value.phone || value.new_phone) {
      this.validatePhoneNumber(value.phone || value.new_phone);
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
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        RETURN_DOM_IMPORT: false
      });
    } catch (error) {
      logger.warn('HTML sanitization failed, falling back to basic cleaning', {
        error: error.message
      });

      // Fallback to basic sanitization
      return content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\s*javascript\s*:/gi, '');
    }
  }

  /**
     * Validate token refresh using auth schema
     */
  validateTokenRefresh(data) {
    const { error, value } = authSchemas.tokenRefreshSchema.validate(data);
    if (error) {
      throw ValidationError.custom('token', error.details[0].message);
    }
    return value;
  }

  /**
     * Validate login attempt payload
     */
  validateLoginAttempt(data) {
    return this.validateWithSchema(authSchemas.loginAttemptSchema, data, 'Login attempt validation failed');
  }

  /**
     * Validate account lockout payload
     */
  validateAccountLockout(data) {
    return this.validateWithSchema(authSchemas.accountLockoutSchema, data, 'Account lockout validation failed');
  }

  /**
     * Validate authentication event
     */
  validateAuthEvent(data) {
    return this.validateWithSchema(authSchemas.authEventSchema, data, 'Auth event validation failed');
  }

  /**
     * Validate rate limit check
     */
  validateRateLimit(data) {
    return this.validateWithSchema(authSchemas.rateLimitSchema, data, 'Rate limit validation failed');
  }

  /**
     * Validate security headers
     */
  validateSecurityHeaders(headers) {
    return this.validateWithSchema(authSchemas.securityHeadersSchema, headers, 'Security headers validation failed');
  }

  /**
     * Validate session validation payload
     */
  validateSessionValidation(data) {
    return this.validateWithSchema(authSchemas.sessionValidationSchema, data, 'Session validation failed');
  }

  /**
     * Validate session revocation data
     */
  validateSessionRevocation(data) {
    return this.validateWithSchema(userSchemas.sessionRevocationSchema, data, 'Session revocation validation failed');
  }

  /**
     * Validate account deactivation data
     */
  validateAccountDeactivation(data) {
    return this.validateWithSchema(userSchemas.accountDeactivationSchema, data, 'Account deactivation validation failed');
  }

  /**
      * Validate account deletion data
      */
  validateAccountDeletion(data) {
    return this.validateWithSchema(userSchemas.accountDeletionSchema, data, 'Account deletion validation failed');
  }

  /**
     * Validate export settings input
     */
  validateSettingsExport(data) {
    return this.validateWithSchema(settingsSchemas.settingsExportSchema, data, 'Settings export validation failed');
  }

  /**
     * Validate settings import
     */
  validateSettingsImport(data) {
    return this.validateWithSchema(settingsSchemas.settingsImportSchema, data, 'Settings import validation failed');
  }

  /**
     * Validate settings backup creation
     */
  validateSettingsBackup(data) {
    return this.validateWithSchema(settingsSchemas.settingsBackupSchema, data, 'Settings backup validation failed');
  }

  /**
     * Validate UUID format using base schema
     */
  validateUUID(uuid) {
    const { error } = baseSchemas.uuidSchema.validate(uuid);
    if (error) {
      throw ValidationError.custom('uuid', error.details[0].message, uuid, 'uuid_format');
    }
    return true;
  }

  /**
     * Validate device information using base schema
     */
  validateDeviceInfo(deviceInfo) {
    const { error, value } = baseSchemas.deviceSchema.validate(deviceInfo);
    if (error) {
      const validationError = new ValidationError('Device validation failed');
      error.details.forEach(detail => {
        validationError.addFieldError(
          detail.path[0],
          detail.message,
          detail.context.value,
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
      throw ValidationError.custom('token', error.details[0].message, token, 'jwt_format');
    }
    return true;
  }

  /**
     * Generic schema validation wrapper
     */
  validateWithSchema(schema, data, errorMessage = 'Validation failed') {
    const { error, value } = schema.validate(data);
    if (error) {
      const validationError = new ValidationError(errorMessage);
      error.details.forEach(detail => {
        validationError.addFieldError(
          Array.isArray(detail.path) ? detail.path.join('.') : detail.path,
          detail.message,
          detail.context.value,
          detail.type
        );
      });
      throw validationError;
    }
    return value;
  }
}

module.exports = new ValidationUtil();
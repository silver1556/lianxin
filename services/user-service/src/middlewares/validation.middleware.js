const { validationResult } = require("express-validator");
const { ValidationError } = require("../errors/validationError");
const logger = require("../../../../shared/utils/logger.util");
const validationUtil = require("../utils/validation.util");

/**
 * Validation Middleware
 * Handles request validation using express-validator and custom validation rules
 */
class ValidationMiddleware {
  /**
   * Handle validation results
   */
  handleValidationErrors(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map((error) => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value,
          constraint: error.type || "validation",
        }));

        logger.warn("Validation failed", {
          errors: validationErrors,
          path: req.path,
          method: req.method,
          requestId: req.requestId,
        });

        throw ValidationError.multipleFields(
          "Validation failed",
          validationErrors
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sanitize request body
   */
  sanitizeBody(req, res, next) {
    try {
      if (req.body && typeof req.body === "object") {
        // Remove null and undefined values
        Object.keys(req.body).forEach((key) => {
          if (req.body[key] === null || req.body[key] === undefined) {
            delete req.body[key];
          }
        });

        // Trim string values
        Object.keys(req.body).forEach((key) => {
          if (typeof req.body[key] === "string") {
            req.body[key] = req.body[key].trim();
          }
        });

        // Sanitize HTML content
        if (req.body.bio) {
          req.body.bio = validationUtil.sanitizeHtml(req.body.bio);
        }
      }

      next();
    } catch (error) {
      logger.error("Body sanitization failed", {
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(req, res, next) {
    try {
      const phone = req.body.phone || req.body.new_phone;

      if (phone) {
        const validation = validationUtil.validatePhoneNumber(phone);

        // Replace with formatted phone number
        if (req.body.phone) {
          req.body.phone = validation.formatted;
        }
        if (req.body.new_phone) {
          req.body.new_phone = validation.formatted;
        }
      }

      next();
    } catch (error) {
      logger.warn("Phone number validation failed", {
        phone: req.body.phone || req.body.new_phone,
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(req, res, next) {
    try {
      const password = req.body.password || req.body.new_password;

      if (password) {
        validationUtil.validatePassword(password);
      }

      next();
    } catch (error) {
      logger.warn("Password validation failed", {
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }

  /**
   * Validate OTP format
   */
  validateOTP(req, res, next) {
    try {
      const otpCode = req.body.otp_code;

      if (otpCode) {
        validationUtil.validateOTP(otpCode);
      }

      next();
    } catch (error) {
      logger.warn("OTP validation failed", {
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }

  /**
   * Validate file upload
   */
  validateFileUpload(fileType = "avatar") {
    return (req, res, next) => {
      try {
        if (req.file) {
          validationUtil.validateFileUpload(req.file, fileType);
        }

        next();
      } catch (error) {
        logger.warn("File upload validation failed", {
          fileType,
          fileName: req.file?.originalname,
          fileSize: req.file?.size,
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate pagination parameters
   */
  validatePagination(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const validation = validationUtil.validatePagination(limit, offset);

      req.query.limit = validation.limit;
      req.query.offset = validation.offset;

      next();
    } catch (error) {
      logger.warn("Pagination validation failed", {
        limit: req.query.limit,
        offset: req.query.offset,
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }

  /**
   * Validate JSON fields
   */
  validateJSONFields(fields) {
    return (req, res, next) => {
      try {
        fields.forEach((field) => {
          if (req.body[field] && typeof req.body[field] === "string") {
            try {
              req.body[field] = JSON.parse(req.body[field]);
            } catch (parseError) {
              throw ValidationError.invalidJSON(
                field,
                `Invalid JSON format for ${field}`
              );
            }
          }
        });

        next();
      } catch (error) {
        logger.warn("JSON field validation failed", {
          fields,
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate required fields
   */
  validateRequiredFields(fields) {
    return (req, res, next) => {
      try {
        const missingFields = [];

        fields.forEach((field) => {
          if (!req.body[field] || req.body[field] === "") {
            missingFields.push(field);
          }
        });

        if (missingFields.length > 0) {
          const errors = missingFields.map((field) => ({
            field,
            message: `${field} is required`,
            constraint: "required",
          }));

          throw ValidationError.multipleFields(
            "Required fields missing",
            errors
          );
        }

        next();
      } catch (error) {
        logger.warn("Required fields validation failed", {
          fields,
          missingFields: error.validationErrors?.map((e) => e.field),
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate enum values
   */
  validateEnumFields(fieldEnums) {
    return (req, res, next) => {
      try {
        Object.keys(fieldEnums).forEach((field) => {
          const value = req.body[field];
          const allowedValues = fieldEnums[field];

          if (value && !allowedValues.includes(value)) {
            throw ValidationError.invalidEnum(
              field,
              `${field} must be one of: ${allowedValues.join(", ")}`,
              value,
              allowedValues.join(",")
            );
          }
        });

        next();
      } catch (error) {
        logger.warn("Enum validation failed", {
          fieldEnums,
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate date fields
   */
  validateDateFields(fields) {
    return (req, res, next) => {
      try {
        fields.forEach((field) => {
          const value = req.body[field];

          if (value) {
            const date = new Date(value);

            if (isNaN(date.getTime())) {
              throw ValidationError.invalidDate(
                field,
                `${field} must be a valid date`
              );
            }

            // Convert to ISO string for consistency
            req.body[field] = date.toISOString().split("T")[0];
          }
        });

        next();
      } catch (error) {
        logger.warn("Date validation failed", {
          fields,
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate string length
   */
  validateStringLength(fieldLimits) {
    return (req, res, next) => {
      try {
        Object.keys(fieldLimits).forEach((field) => {
          const value = req.body[field];
          const limits = fieldLimits[field];

          if (value && typeof value === "string") {
            if (limits.min && value.length < limits.min) {
              throw ValidationError.invalidLength(
                field,
                `${field} must be at least ${limits.min} characters`,
                value,
                `min_length:${limits.min}`
              );
            }

            if (limits.max && value.length > limits.max) {
              throw ValidationError.invalidLength(
                field,
                `${field} must not exceed ${limits.max} characters`,
                value,
                `max_length:${limits.max}`
              );
            }
          }
        });

        next();
      } catch (error) {
        logger.warn("String length validation failed", {
          fieldLimits,
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate UUID fields
   */
  validateUUID(fields) {
    return (req, res, next) => {
      try {
        fields.forEach((field) => {
          const value =
            req.body[field] || req.params[field] || req.query[field];
          if (value) {
            validationUtil.validateUUID(value);
          }
        });

        next();
      } catch (error) {
        logger.warn("UUID validation failed", {
          fields,
          error: error.message,
          requestId: req.requestId,
        });
        next(error);
      }
    };
  }

  /**
   * Validate JWT token format
   */
  validateJWTToken(req, res, next) {
    try {
      const authHeader = req.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        validationUtil.validateJWTToken(token);
      }

      next();
    } catch (error) {
      logger.warn("JWT token validation failed", {
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }

  /**
   * Content moderation validation
   */
  validateContent(req, res, next) {
    try {
      const contentFields = ["bio", "display_name", "first_name", "last_name"];

      contentFields.forEach((field) => {
        const value = req.body[field];

        if (value && typeof value === "string") {
          // Basic content filtering
          const prohibitedPatterns = [
            /\b(fuck|shit|damn|bitch)\b/gi,
            /\b(政治|政府|共产党)\b/g,
            /\b(色情|黄色|成人)\b/g,
            /\b(赌博|博彩|彩票)\b/g,
          ];

          for (const pattern of prohibitedPatterns) {
            if (pattern.test(value)) {
              throw ValidationError.custom(
                field,
                `${field} contains prohibited content`,
                value,
                "content_moderation"
              );
            }
          }
        }
      });

      next();
    } catch (error) {
      logger.warn("Content moderation failed", {
        error: error.message,
        requestId: req.requestId,
      });
      next(error);
    }
  }
}

module.exports = new ValidationMiddleware();

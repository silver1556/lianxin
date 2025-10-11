const Joi = require("joi");
const { IANAZone } = require("luxon");
/**
 * Base Validation Schemas
 * Common schemas used across the application
 */

// phoneSchema definition
const phoneSchema = Joi.string()
  .pattern(/^\d{6,15}$/)
  .required()
  .messages({
    "string.pattern.base": "Phone number must be between 6 and 15 digits",
    "any.required": "Phone number is required",
  });

// COuntry code schema
const countryCodeSchema = Joi.string()
  .pattern(/^\+?\d{1,4}$/)
  .required()
  .messages({
    "string.pattern.base":
      "Country code must be 1-4 digits with optional + prefix",
  });

// Password schema with comprehensive validation
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/
  )
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must not exceed 128 characters",
    "string.pattern.base":
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    "any.required": "Password is required",
  });

// OTP code schema
const otpCodeSchema = Joi.string()
  .length(6)
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.length": "OTP must be exactly 6 digits",
    "string.pattern.base": "OTP must contain only numbers",
    "any.required": "OTP code is required",
  });

// UUID schema
const uuidSchema = Joi.string().uuid().required().messages({
  "string.uuid": "Must be a valid UUID",
  "any.required": "UUID is required",
});

// Device information schema
const deviceSchema = Joi.object({
  device_id: Joi.string().required().messages({
    "any.required": "Device ID is required",
  }),
  device_type: Joi.string()
    .valid("mobile", "desktop", "tablet")
    .required()
    .messages({
      "any.only": "Device type must be mobile, desktop, or tablet",
      "any.required": "Device type is required",
    }),
  device_name: Joi.string().max(100).required().messages({
    "string.max": "Device name must not exceed 100 characters",
    "any.required": "Device name is required",
  }),
});

// Pagination schema
const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    "number.min": "Limit must be at least 1",
    "number.max": "Limit must not exceed 100",
  }),
  offset: Joi.number().integer().min(0).default(0).messages({
    "number.min": "Offset must be at least 0",
  }),
});

// JWT token schema
const jwtTokenSchema = Joi.string()
  .pattern(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
  .required()
  .messages({
    "string.pattern.base": "Invalid JWT token format",
    "any.required": "JWT token is required",
  });

// Common file upload schema
const fileUploadSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  encoding: Joi.string().required(),
});

// Language schema (not for user known languages)
const languageSchema = Joi.string()
  .valid("zh-CN", "en-US", "ja-JP", "ko-KR")
  .messages({
    "any.only": "Language must be zh-CN, en-US, ja-JP, or ko-KR",
  });

// User known Languages schema
const userLanguageSchema = Joi.string()
  .custom((value, helpers) => {
    try {
      // Canonicalizes and validates
      Intl.getCanonicalLocales(value);
      return value;
    } catch {
      return helpers.error("any.invalid");
    }
  }, "Language tag validation")
  .messages({
    "any.invalid":
      "Language must be a valid BCP 47 language tag like en, en-US, zh-CN, etc.",
  });

// Timezone schema
const timezoneSchema = Joi.string()
  .custom((value, helpers) => {
    if (!IANAZone.isValidZone(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  }, "IANA timezone validation")
  .messages({
    "any.invalid":
      'Invalid timezone. Must be a valid IANA timezone like "Asia/Tokyo" or "America/New_York".',
  });

// IP address schema
const ipAddressSchema = Joi.string().ip().messages({
  "string.ip": "Invalid IP address format",
});

// User agent schema
const userAgentSchema = Joi.string().max(500).messages({
  "string.max": "User agent must not exceed 500 characters",
});

module.exports = {
  phoneSchema,
  countryCodeSchema,
  passwordSchema,
  otpCodeSchema,
  uuidSchema,
  deviceSchema,
  paginationSchema,
  jwtTokenSchema,
  fileUploadSchema,
  languageSchema,
  userLanguageSchema,
  timezoneSchema,
  ipAddressSchema,
  userAgentSchema,
};

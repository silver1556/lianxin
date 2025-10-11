const Joi = require("joi");
const {
  phoneSchema,
  countryCodeSchema,
  passwordSchema,
  otpCodeSchema,
  uuidSchema,
  deviceSchema,
  jwtTokenSchema,
  ipAddressSchema,
  userAgentSchema,
} = require("./base.schema");

/**
 * Authentication Validation Schemas
 * Uses base schemas to avoid duplication
 */

// Registration OTP request schema
const registrationOtpRequestSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
});

// Login OTP request schema
const loginOtpRequestSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
});

// Password reset OTP request schema
const passwordResetOtpRequestSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
});

// Phone change OTP request schema
const phoneChangeOtpRequestSchema = Joi.object({
  newPhone: phoneSchema,
  country_code: countryCodeSchema,
});

// User registration schema
const userRegistrationSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
  password: passwordSchema,
  verification_id: uuidSchema,
  otp_code: otpCodeSchema,
  agree_terms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must agree to the terms and conditions",
    "any.required": "Terms agreement is required",
  }),
  device_id: Joi.string().required(),
  device_type: Joi.string().valid("mobile", "desktop", "tablet").required(),
  device_name: Joi.string().max(100).required(),
});

// User login with password schema
const userLoginPasswordSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
  password: passwordSchema,
  device_id: Joi.string().required(),
  device_type: Joi.string().valid("mobile", "desktop", "tablet").required(),
  device_name: Joi.string().max(100).required(),
});

// User login with OTP schema
const userLoginOtpSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
  verification_id: uuidSchema,
  otp_code: otpCodeSchema,
  device_id: Joi.string().required(),
  device_type: Joi.string().valid("mobile", "desktop", "tablet").required(),
  device_name: Joi.string().max(100).required(),
});

// Token refresh schema
const tokenRefreshSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});

// Password change schema
const passwordChangeSchema = Joi.object({
  current_password: passwordSchema.messages({
    "any.required": "Current password is required",
  }),
  new_password: passwordSchema.messages({
    "any.required": "New password is required",
  }),
  confirm_password: Joi.string()
    .valid(Joi.ref("new_password"))
    .required()
    .messages({
      "any.only": "Password confirmation does not match",
      "any.required": "Password confirmation is required",
    }),
});

// Phone number change schema
const phoneNumberChangeSchema = Joi.object({
  new_phone: phoneSchema,
  country_code: countryCodeSchema,
  verification_id: uuidSchema,
  otp_code: otpCodeSchema,
  password: Joi.string().required().messages({
    "any.required": "Password is required for phone number change",
  }),
});

// Session validation schema
const sessionValidationSchema = Joi.object({
  session_id: uuidSchema.messages({
    "string.uuid": "Session ID must be a valid UUID",
    "any.required": "Session ID is required",
  }),
  user_id: Joi.number().integer().positive().required().messages({
    "number.positive": "User ID must be a positive number",
    "any.required": "User ID is required",
  }),
});

// Login attempt validation schema
const loginAttemptSchema = Joi.object({
  phone: phoneSchema,
  country_code: countryCodeSchema,
  ip_address: ipAddressSchema.optional(),
  user_agent: userAgentSchema.optional(),
  success: Joi.boolean().required(),
  failure_reason: Joi.string()
    .when("success", {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "any.required": "Failure reason is required when login fails",
    }),
});

// Account lockout schema
const accountLockoutSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  lockout_until: Joi.date().greater("now").required().messages({
    "date.greater": "Lockout time must be in the future",
  }),
  reason: Joi.string().max(255).required().messages({
    "string.max": "Lockout reason must not exceed 255 characters",
    "any.required": "Lockout reason is required",
  }),
});

// Authentication event schema
const authEventSchema = Joi.object({
  user_id: Joi.number().integer().positive(),
  event_type: Joi.string()
    .valid(
      "login",
      "logout",
      "register",
      "password_reset",
      "password_change",
      "phone_change"
    )
    .required()
    .messages({
      "any.only": "Invalid authentication event type",
    }),
  ip_address: ipAddressSchema.optional(),
  user_agent: userAgentSchema.optional(),
  device_info: deviceSchema.optional(),
  success: Joi.boolean().required(),
  failure_reason: Joi.string().when("success", {
    is: false,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  metadata: Joi.object().optional(),
});

// Rate limiting schema
const rateLimitSchema = Joi.object({
  identifier: Joi.string().required().messages({
    "any.required": "Rate limit identifier is required",
  }),
  limit: Joi.number().integer().positive().required().messages({
    "number.positive": "Rate limit must be a positive number",
    "any.required": "Rate limit is required",
  }),
  window_ms: Joi.number().integer().positive().required().messages({
    "number.positive": "Rate limit window must be a positive number",
    "any.required": "Rate limit window is required",
  }),
  current_count: Joi.number().integer().min(0).required().messages({
    "number.min": "Current count cannot be negative",
    "any.required": "Current count is required",
  }),
});

// Security headers validation schema
const securityHeadersSchema = Joi.object({
  "x-forwarded-for": Joi.string().optional(),
  "x-real-ip": ipAddressSchema.optional(),
  "user-agent": userAgentSchema.optional(),
  "x-device-id": Joi.string().optional(),
  "x-app-version": Joi.string().optional(),
  authorization: Joi.string()
    .pattern(/^Bearer [A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)
    .optional()
    .messages({
      "string.pattern.base":
        "Authorization header must be in Bearer token format",
    }),
});

module.exports = {
  // Base schemas (re-exported for convenience)
  phoneSchema,
  countryCodeSchema,
  passwordSchema,
  otpCodeSchema,
  uuidSchema,
  deviceSchema,

  // Auth-specific schemas
  registrationOtpRequestSchema,
  loginOtpRequestSchema,
  passwordResetOtpRequestSchema,
  phoneChangeOtpRequestSchema,
  userRegistrationSchema,
  userLoginPasswordSchema,
  userLoginOtpSchema,
  tokenRefreshSchema,
  passwordChangeSchema,
  phoneNumberChangeSchema,
  jwtTokenSchema,
  sessionValidationSchema,
  loginAttemptSchema,
  accountLockoutSchema,
  authEventSchema,
  rateLimitSchema,
  securityHeadersSchema,
};

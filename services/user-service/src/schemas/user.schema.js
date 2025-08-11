const Joi = require('joi');
const {
  phoneSchema,
  passwordSchema,
  otpCodeSchema,
  uuidSchema,
  fileUploadSchema,
  userLanguageSchema
} = require('./base.schema');

/**
 * User Validation Schemas
 * Uses base schemas to avoid duplication
 */

// Profile update schema
const profileUpdateSchema = Joi.object({
  first_name: Joi.string()
    .min(1)
    .max(10)
    .pattern(/^[a-zA-Z\u4e00-\u9fff\s'-]+$/)
    .messages({
      'string.min': 'First name must be at least 1 character',
      'string.max': 'First name must not exceed 10 characters',
      'string.pattern.base': 'First name contains invalid characters'
    }),

  last_name: Joi.string()
    .min(1)
    .max(10)
    .pattern(/^[a-zA-Z\u4e00-\u9fff\s'-]+$/)
    .messages({
      'string.min': 'Last name must be at least 1 character',
      'string.max': 'Last name must not exceed 10 characters',
      'string.pattern.base': 'Last name contains invalid characters'
    }),

  display_name: Joi.string()
    .min(1)
    .max(20)
    .pattern(/^[a-zA-Z0-9\u4e00-\u9fff\s._-]+$/)
    .messages({
      'string.min': 'Display name must be at least 1 character',
      'string.max': 'Display name must not exceed 20 characters',
      'string.pattern.base': 'Display name contains invalid characters'
    }),

  bio: Joi.string()
    .max(500)
    .messages({
      'string.max': 'Bio must not exceed 500 characters'
    }),

  location: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Location must not exceed 100 characters'
    }),

  website: Joi.string()
    .uri()
    .messages({
      'string.uri': 'Website must be a valid URL'
    }),

  occupation: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Occupation must not exceed 100 characters'
    }),

  education: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Education must not exceed 100 characters'
    }),

  relationship_status: Joi.string()
    .valid('single', 'in_relationship', 'married', 'complicated')
    .messages({
      'any.only': 'Invalid relationship status'
    }),

  birth_date: Joi.date()
    .max('now')
    .min('1900-01-01')
    .messages({
      'date.max': 'Birth date cannot be in the future',
      'date.min': 'Birth date is too old'
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other')
    .messages({
      'any.only': 'Gender must be male, female, or other'
    }),

  languages: Joi.array()
    .items(userLanguageSchema)
    .messages({
      'array.includes': 'Invalid language code'
    })
});

// Account deactivation schema
const accountDeactivationSchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .messages({
      'string.max': 'Reason must not exceed 500 characters'
    }),
  password: passwordSchema.messages({
    'any.required': 'Password is required for account deactivation'
  })
});

// Account deletion schema
const accountDeletionSchema = Joi.object({
  password: passwordSchema.messages({
    'any.required': 'Password is required for account deletion'
  }),
  confirmation: Joi.string()
    .valid('DELETE_MY_ACCOUNT')
    .required()
    .messages({
      'any.only': 'You must type "DELETE_MY_ACCOUNT" to confirm',
      'any.required': 'Confirmation is required'
    })
});

// Session revocation schema
const sessionRevocationSchema = Joi.object({
  password: passwordSchema.messages({
    'any.required': 'Password is required to revoke session'
  })
});

module.exports = {
  // Base schemas (re-exported for convenience)
  phoneSchema,
  passwordSchema,
  otpCodeSchema,
  uuidSchema,

  // User-specific schemas
  profileUpdateSchema,
  accountDeactivationSchema,
  accountDeletionSchema,
  fileUploadSchema,
  sessionRevocationSchema
};
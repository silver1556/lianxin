const Joi = require("joi");
const {
  phoneSchema,
  passwordSchema,
  otpCodeSchema,
  uuidSchema,
  fileUploadSchema,
  userLanguageSchema,
} = require("./base.schema");

/**
 * User Validation Schemas
 * Uses base schemas to avoid duplication
 */

// Profile update schema
const profileUpdateSchema = Joi.object({
  first_name: Joi.string()
    .min(1)
    .max(10)
    .pattern(/^[a-zA-Z\u4e00-\u9fff ']+$/)
    .optional()
    .messages({
      "string.min": "First name must be at least 1 character",
      "string.max": "First name must not exceed 10 characters",
      "string.pattern.base": "First name contains invalid characters",
    }),

  last_name: Joi.string()
    .min(1)
    .max(10)
    .pattern(/^[a-zA-Z\u4e00-\u9fff ']+$/)
    .optional()
    .messages({
      "string.min": "Last name must be at least 1 character",
      "string.max": "Last name must not exceed 10 characters",
      "string.pattern.base": "Last name contains invalid characters",
    }),

  display_name: Joi.string()
    .min(1)
    .max(20)
    .pattern(/^[a-zA-Z0-9\u4e00-\u9fff ._-]+$/)
    .optional()
    .messages({
      "string.min": "Display name must be at least 1 character",
      "string.max": "Display name must not exceed 20 characters",
      "string.pattern.base": "Display name contains invalid characters",
    }),

  bio: Joi.string().max(500).optional().messages({
    "string.max": "Bio must not exceed 500 characters",
  }),

  birth_date: Joi.date().max("now").min("1900-01-01").optional().messages({
    "date.max": "Birth date cannot be in the future",
    "date.min": "Birth date is too old",
  }),

  gender: Joi.string().valid("male", "female", "other").optional().messages({
    "any.only": "Gender must be male, female, or other",
  }),

  interested_in: Joi.string()
    .valid("men", "women", "both")
    .optional()
    .messages({
      "any.only": "Interested_In must be men, women, or both",
    }),

  lives_in_location: Joi.string().max(100).optional().messages({
    "string.max": "Lives_In_Location must not exceed 100 characters",
  }),

  hometown: Joi.string().max(100).optional().messages({
    "string.max": "Hometown must not exceed 100 characters",
  }),

  occupation: Joi.string().max(100).optional().messages({
    "string.max": "Occupation must not exceed 100 characters",
  }),

  salary: Joi.number().integer().min(0).optional().messages({
    "number.base": "Salary must be a positive integer",
    "number.min": "Salary must not negative integer",
    "number.integer": "Salary must be a positive integer",
  }),

  relationship_status: Joi.string()
    .valid("single", "in_relationship", "married", "divorced")
    .optional()
    .messages({
      "any.only": "Invalid relationship status",
    }),

  languages: Joi.array()
    .items(userLanguageSchema)
    .unique()
    .optional()
    .messages({
      "array.includes": "Invalid language code",
      "array.unique": "Languages must not contain duplicate values",
    }),

  hobbies: Joi.array()
    .items(Joi.string().max(50).trim())
    .unique() // ensures no duplicates
    .optional()
    .messages({
      "array.base": "Hobbies must be an array",
      "array.unique": "Hobbies must not contain duplicate values",
    }),

  skills: Joi.array()
    .items(Joi.string().max(50).trim())
    .unique()
    .optional()
    .messages({
      "array.base": "Skills must be an array",
      "array.unique": "Skills must not contain duplicate values",
    }),
});

// Account deactivation schema
const accountDeactivationSchema = Joi.object({
  reason: Joi.string().max(500).messages({
    "string.max": "Reason must not exceed 500 characters",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

// Account deletion schema
const accountDeletionSchema = Joi.object({
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
  confirmation: Joi.string().valid("CONFIRM").required().messages({
    "any.only": 'You must type "CONFIRM" to confirm account deletion',
    "any.required": "Confirmation is required",
  }),
});

// Session revocation schema
const sessionRevocationSchema = Joi.object({
  password: passwordSchema.optional(),
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
  sessionRevocationSchema,
};

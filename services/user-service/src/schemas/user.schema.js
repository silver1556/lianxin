const Joi = require("joi");
const sanitizeHtml = require("sanitize-html");

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
  first_name: Joi.object({
    value: Joi.string()
      .trim()
      .min(1)
      .max(10)
      .pattern(/^[a-zA-Z\u4e00-\u9fff ']+$/)
      .messages({
        "string.min": "First name must be at least 1 character",
        "string.max": "First name must not exceed 10 characters",
        "string.pattern.base": "First name contains invalid characters",
      }),
  }).optional(),

  last_name: Joi.object({
    value: Joi.string()
      .trim()
      .min(1)
      .max(10)
      .pattern(/^[a-zA-Z\u4e00-\u9fff ']+$/)
      .messages({
        "string.min": "Last name must be at least 1 character",
        "string.max": "Last name must not exceed 10 characters",
        "string.pattern.base": "Last name contains invalid characters",
      }),
  }).optional(),

  display_name: Joi.object({
    value: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .pattern(/^[a-zA-Z0-9\u4e00-\u9fff ._-]+$/)
      .messages({
        "string.min": "Display name must be at least 1 character",
        "string.max": "Display name must not exceed 20 characters",
        "string.pattern.base": "Display name contains invalid characters",
      }),
  }).optional(),

  bio: Joi.object({
    value: Joi.string()
      .max(500)
      .custom((bio, helpers) => {
        // Remove HTML tags
        const cleanBio = sanitizeHtml(bio, {
          allowedTags: [], // remove all tags
          allowedAttributes: {}, // remove all attributes
        }).trim();

        // Prohibited content patterns
        const prohibitedPatterns = [
          /\b(fuck|shit|damn|bitch)\b/gi,
          /\b(政治|政府|共产党)\b/g, // Political content
          /\b(色情|黄色|成人)\b/g, // Adult content
          /\b(赌博|博彩|彩票)\b/g, // Gambling content
        ];

        for (const pattern of prohibitedPatterns) {
          if (pattern.test(cleanBio)) {
            return helpers.error("bio.prohibited", { value: bio });
          }
        }

        return bio; // valid
      }, "Bio content moderation")
      .messages({
        "string.max": "Bio must not exceed 500 characters",
        "string.base": "Bio must be a string",
        "bio.prohibited": "Bio contains prohibited content",
      }),
  }).optional(),

  birth_date: Joi.object({
    value: Joi.date().max("now").min("1900-01-01").messages({
      "date.max": "Birth date cannot be in the future",
      "date.min": "Birth date is too old",
    }),
  }).optional(),

  gender: Joi.object({
    value: Joi.string().valid("male", "female", "other").messages({
      "any.only": "Gender must be male, female, or other",
    }),
  }).optional(),

  interested_in: Joi.object({
    value: Joi.string().valid("men", "women", "both").messages({
      "any.only": "Interested_In must be men, women, or both",
    }),
  }).optional(),

  occupation: Joi.object({
    value: Joi.string().max(100).messages({
      "string.max": "Occupation must not exceed 100 characters",
    }),
  }).optional(),

  salary: Joi.object({
    value: Joi.number().integer().min(0).allow(null).messages({
      "number.base": "Salary must be a positive integer",
      "number.min": "Salary must not negative integer",
      "number.integer": "Salary must be a positive integer",
    }),
  }).optional(),

  relationship_status: Joi.object({
    value: Joi.string()
      .valid("single", "in_relationship", "married", "divorced")
      .messages({
        "any.only": "Invalid relationship status",
      }),
  }).optional(),

  languages: Joi.object({
    value: Joi.array().items(userLanguageSchema).unique().messages({
      "array.includes": "Invalid language code",
      "array.unique": "Languages must not contain duplicate values",
    }),
  }).optional(),

  hobbies: Joi.object({
    value: Joi.array()
      .items(Joi.string().max(50).trim())
      .unique() // ensures no duplicates
      .messages({
        "array.base": "Hobbies must be an array",
        "array.unique": "Hobbies must not contain duplicate values",
      }),
  }).optional(),

  skills: Joi.object({
    value: Joi.array()
      .items(Joi.string().max(50).trim())
      .unique()
      .optional()
      .messages({
        "array.base": "Skills must be an array",
        "array.unique": "Skills must not contain duplicate values",
      }),
  }).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "Invalid field: {#label}",
  });

// ========================
// Education Fields Schema
// ========================
const educationFieldsSchema = Joi.array()
  .items(
    Joi.object({
      school_name: Joi.string().max(50).optional().messages({
        "string.base": "School name must be a string",
        "string.max": "School name must not exceed 50 characters",
      }),
      degree: Joi.string().max(50).optional().messages({
        "string.base": "Degree must be a string",
        "string.max": "Degree must not exceed 50 characters",
      }),
      field_of_study: Joi.string().max(50).optional().messages({
        "string.base": "Field of study must be a string",
        "string.max": "Field of study must not exceed 50 characters",
      }),
      start_year: Joi.number()
        .integer()
        .min(1900)
        .max(new Date().getFullYear())
        .allow(null)
        .optional()
        .messages({
          "number.base": "Start year must be a number",
          "number.integer": "Start year must be an integer",
          "number.min": "Start year must be 1900 or later",
          "number.max": `Start year cannot be in the future`,
        }),
      end_year: Joi.number()
        .integer()
        .min(1900)
        .max(new Date().getFullYear())
        .allow(null)
        .optional()
        .messages({
          "number.base": "End year must be a number",
          "number.integer": "End year must be an integer",
          "number.min": "End year must be 1900 or later",
          "number.max": `End year cannot be in the future`,
        }),
      is_current: Joi.number()
        .integer()
        .valid(0, 1)
        .allow(null)
        .optional()
        .messages({
          "number.integer": "Is current must be an integer",
          "any.only": "Is current must be 0 (false), 1 (true), or null",
        }),
    })
  )
  .messages({
    "array.base": "Educations must be an array of objects",
  });

// ========================
// Privacy Fields Schema
// ========================
const privacyFieldsSchema = Joi.object({
  birth_date: Joi.object({
    birth_date: Joi.string()
      .valid("public", "friends", "private")
      .optional()
      .messages({
        "any.only": "Invalid privacy setting for birth_date",
        "string.base": "Birth date privacy must be a string",
      }),
    birth_year: Joi.string()
      .valid("public", "friends", "private")
      .optional()
      .messages({
        "any.only": "Invalid privacy setting for birth_year",
        "string.base": "Birth year privacy must be a string",
      }),
  }).optional(),

  occupation: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for occupation",
      "string.base": "Occupation privacy must be a string",
    }),

  salary: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for salary",
      "string.base": "Salary privacy must be a string",
    }),

  relationship_status: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for relationship_status",
      "string.base": "Relationship status privacy must be a string",
    }),

  languages: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for languages",
      "string.base": "Languages privacy must be a string",
    }),

  hobbies: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for hobbies",
      "string.base": "Hobbies privacy must be a string",
    }),

  skills: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for skills",
      "string.base": "Skills privacy must be a string",
    }),

  educations: Joi.string()
    .valid("public", "friends", "private")
    .optional()
    .messages({
      "any.only": "Invalid privacy setting for educations",
      "string.base": "Educations privacy must be a string",
    }),
}).messages({
  "object.base": "Privacy fields must be an object",
});

// ========================
// Account deactivation schema
// ========================
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
  educationFieldsSchema,
  privacyFieldsSchema,
  accountDeactivationSchema,
  accountDeletionSchema,
  fileUploadSchema,
  sessionRevocationSchema,
};

const Joi = require("joi");
const { languageSchema, timezoneSchema } = require("./base.schema");

/**
 * Settings Validation Schemas
 * Uses base schemas to avoid duplication
 */

// Privacy settings schema
const privacySettingsSchema = Joi.object({
  profile_visibility: Joi.string()
    .valid("public", "friends", "private")
    .default("public")
    .messages({
      "any.only": "Profile visibility must be public, friends, or private",
    }),

  search_visibility: Joi.boolean().strict().messages({
    "boolean.base": "Search visibility must be true or false",
  }),

  show_online_status: Joi.boolean().strict().messages({
    "boolean.base": "Show online status must be true or false",
  }),

  allow_friend_requests: Joi.boolean().strict().messages({
    "boolean.base": "Allow friend requests must be true or false",
  }),

  message_permissions: Joi.string()
    .valid("everyone", "friends", "none")
    .default("friends")
    .messages({
      "any.only": "Message permissions must be everyone, friends, or none",
    }),

  allow_tagging: Joi.string()
    .valid("everyone", "friends", "none")
    .default("friends")
    .messages({
      "any.only": "Tagging permissions must be everyone, friends, or none",
    }),
});

// Notification settings schema
const notificationSettingsSchema = Joi.object({
  push_notifications: Joi.boolean().strict().messages({
    "boolean.base": "Push notifications must be true or false",
  }),

  friend_requests: Joi.boolean().strict().messages({
    "boolean.base": "Friend request notifications must be true or false",
  }),

  messages: Joi.boolean().strict().messages({
    "boolean.base": "Message notifications must be true or false",
  }),

  likes: Joi.boolean().strict().messages({
    "boolean.base": "Like notifications must be true or false",
  }),

  comments: Joi.boolean().strict().messages({
    "boolean.base": "Comment notifications must be true or false",
  }),

  shares: Joi.boolean().strict().messages({
    "boolean.base": "Share notifications must be true or false",
  }),

  mentions: Joi.boolean().strict().messages({
    "boolean.base": "Mention notifications must be true or false",
  }),

  group_activities: Joi.boolean().strict().messages({
    "boolean.base": "Group activity notifications must be true or false",
  }),

  event_reminders: Joi.boolean().strict().messages({
    "boolean.base": "Event reminder notifications must be true or false",
  }),

  security_alerts: Joi.boolean().strict().messages({
    "boolean.base": "Security alert notifications must be true or false",
  }),
});

// Display settings schema - using base language and timezone schemas
const displaySettingsSchema = Joi.object({
  theme: Joi.string().valid("light", "dark", "auto").default("light").messages({
    "any.only": "Theme must be light, dark, or auto",
  }),

  language: languageSchema.default("zh-CN"),

  timezone: timezoneSchema.default("Asia/Shanghai"),

  font_size: Joi.string()
    .valid("small", "medium", "large", "extra-large")
    .default("medium")
    .messages({
      "any.only": "Font size must be small, medium, large, or extra-large",
    }),

  date_format: Joi.string()
    .valid("YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY")
    .default("YYYY-MM-DD")
    .messages({
      "any.only": "Invalid date format",
    }),

  time_format: Joi.string().valid("24h", "12h").default("24h").messages({
    "any.only": "Time format must be 24h or 12h",
  }),

  posts_per_page: Joi.number().integer().min(10).max(50).default(20).messages({
    "number.min": "Posts per page must be at least 10",
    "number.max": "Posts per page must not exceed 50",
  }),
});

// Security settings schema
const securitySettingsSchema = Joi.object({
  login_alerts: Joi.boolean().strict().messages({
    "boolean.base": "Login alerts must be true or false",
  }),
});

// Complete user settings schema
const userSettingsSchema = Joi.object({
  privacy: privacySettingsSchema.optional(),
  notifications: notificationSettingsSchema.optional(),
  display: displaySettingsSchema.optional(),
  security: securitySettingsSchema.optional(),
});

// Update schemas
const privacyUpdateSchema = privacySettingsSchema;
const notificationUpdateSchema = notificationSettingsSchema;
const displayUpdateSchema = displaySettingsSchema;
const securityUpdateSchema = securitySettingsSchema;

// Settings export schema
const settingsExportSchema = Joi.object({
  format: Joi.string().valid("json", "csv").default("json").messages({
    "any.only": "Export format must be json or csv",
  }),

  categories: Joi.array()
    .items(
      Joi.string().valid("privacy", "notifications", "display", "security")
    )
    .min(1)
    .default(["privacy", "notifications", "display", "security"])
    .messages({
      "array.min": "At least one category must be selected",
      "any.only": "Invalid settings category",
    }),

  include_metadata: Joi.boolean().strict().default(false).messages({
    "boolean.base": "Include metadata must be true or false",
  }),
});

// Settings import schema
const settingsImportSchema = Joi.object({
  settings: userSettingsSchema.required(),

  overwrite_existing: Joi.boolean().strict().default(false).messages({
    "boolean.base": "Overwrite existing must be true or false",
  }),

  validate_only: Joi.boolean().strict().default(false).messages({
    "boolean.base": "Validate only must be true or false",
  }),
});

// Settings backup schema
const settingsBackupSchema = Joi.object({
  backup_name: Joi.string()
    .max(100)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .messages({
      "string.max": "Backup name must not exceed 100 characters",
      "string.pattern.base":
        "Backup name can only contain letters, numbers, underscores, and hyphens",
    }),

  description: Joi.string().max(500).messages({
    "string.max": "Description must not exceed 500 characters",
  }),

  categories: Joi.array()
    .items(
      Joi.string().valid("privacy", "notifications", "display", "security")
    )
    .min(1)
    .default(["privacy", "notifications", "display", "security"])
    .messages({
      "array.min": "At least one category must be selected",
    }),
});

const createFieldSchema = (schema, field) =>
  Joi.object({
    [field]: schema.extract(field),
  });

module.exports = {
  // Base schemas (re-exported for convenience)
  languageSchema,
  timezoneSchema,

  // Settings schemas
  privacySettingsSchema,
  notificationSettingsSchema,
  displaySettingsSchema,
  securitySettingsSchema,
  userSettingsSchema,
  privacyUpdateSchema,
  notificationUpdateSchema,
  displayUpdateSchema,
  securityUpdateSchema,
  settingsExportSchema,
  settingsImportSchema,
  settingsBackupSchema,
  createFieldSchema,
};

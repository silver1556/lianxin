const dotenv = require("dotenv");

// Load environment variables
dotenv.config();
module.exports = {
  // JWT Configuration
  jwt: {
    // JWT secrets with rotation support
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
    passwordResetTokenSecret: process.env.JWT_PASSWORD_RESET_TOKEN_SECRET,

    // Token expiration times
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || "30m",
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d",

    // Token configuration
    algorithm: process.env.JWT_ALGORITHM || "HS256",
    issuer: process.env.JWT_ISSUER || "lianxin-user-service",
    audience: process.env.JWT_AUDIENCE || "lianxin-app",

    // Token rotation
    enableRotation: process.env.JWT_ENABLE_ROTATION !== "false",
    rotationInterval: parseInt(process.env.JWT_ROTATION_INTERVAL) || 86400000, // 24 hours

    // Token blacklisting
    enableBlacklist: process.env.JWT_ENABLE_BLACKLIST !== "false",
    blacklistCleanupInterval:
      parseInt(process.env.JWT_BLACKLIST_CLEANUP_INTERVAL) || 3600000, // 1 hour

    // Token validation
    clockTolerance: parseInt(process.env.JWT_CLOCK_TOLERANCE) || 30, // seconds
    maxTokenAge: parseInt(process.env.JWT_MAX_TOKEN_AGE) || 86400000, // 24 hours

    // Payload encryption
    enablePayloadEncryption:
      process.env.JWT_ENABLE_PAYLOAD_ENCRYPTION === "true",
    payloadEncryptionKey: process.env.JWT_PAYLOAD_ENCRYPTION_KEY,
  },

  // Password Security
  password: {
    // Bcrypt configuration
    saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS) || 12,

    // Password policy
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH) || 128,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== "false",
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== "false",

    // Password history
    historyCount: parseInt(process.env.PASSWORD_HISTORY_COUNT) || 5,

    // Password strength
    entropyMinimum: parseInt(process.env.PASSWORD_ENTROPY_MINIMUM) || 40,

    // Password reset
    resetTokenExpiry:
      parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY) || 300000, // 5 minutes
    resetMaxAttempts: parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS) || 3,
  },

  // Encryption Configuration
  encryption: {
    // Field-level encryption
    algorithm: process.env.ENCRYPTION_ALGORITHM || "aes-256-gcm",
    keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH) || 32,
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH) || 16,
    tagLength: parseInt(process.env.ENCRYPTION_TAG_LENGTH) || 16,

    // Encryption keys
    primaryKey: process.env.ENCRYPTION_PRIMARY_KEY,
    secondaryKey: process.env.ENCRYPTION_SECONDARY_KEY,

    // Key rotation
    enableKeyRotation: process.env.ENCRYPTION_ENABLE_KEY_ROTATION === "true",
    keyRotationInterval:
      parseInt(process.env.ENCRYPTION_KEY_ROTATION_INTERVAL) || 2592000000, // 30 days

    // HSM Integration
    enableHSM: process.env.ENCRYPTION_ENABLE_HSM === "true",
    hsmConfig: {
      endpoint: process.env.HSM_ENDPOINT,
      keyId: process.env.HSM_KEY_ID,
      region: process.env.HSM_REGION || "cn-hangzhou",
    },

    // Encryption scope
    encryptedFields: process.env.ENCRYPTION_FIELDS
      ? process.env.ENCRYPTION_FIELDS.split(",")
      : [
          "phone",
          "first_name",
          "last_name",
          "birth_date",
          "location",
          "verification_data",
        ],
  },

  // Session Security
  session: {
    // Session configuration
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 1800000, // 30 minutes
    maxActiveSessionsPerUser:
      parseInt(process.env.MAX_ACTIVE_SESSIONS_PER_USER) || 5,

    // Session validation
    validateIP: process.env.SESSION_VALIDATE_IP === "true",
    validateUserAgent: process.env.SESSION_VALIDATE_USER_AGENT === "true",

    // Session storage
    storageType: process.env.SESSION_STORAGE_TYPE || "redis",
    encryptSession: process.env.SESSION_ENCRYPT !== "false",

    // Device fingerprinting
    enableDeviceFingerprinting:
      process.env.SESSION_ENABLE_DEVICE_FINGERPRINTING === "true",
    deviceTrustDuration:
      parseInt(process.env.SESSION_DEVICE_TRUST_DURATION) || 2592000000, // 30 days

    // Session security
    regenerateOnLogin: process.env.SESSION_REGENERATE_ON_LOGIN !== "false",
    invalidateOnLogout: process.env.SESSION_INVALIDATE_ON_LOGOUT !== "false",

    // Concurrent session handling
    allowConcurrentSessions: process.env.SESSION_ALLOW_CONCURRENT !== "false",
    sessionConflictResolution: process.env.SESSION_CONFLICT_RESOLUTION || "lru", // lru, newest, oldest
  },

  // OTP Security
  otp: {
    // OTP configuration
    algorithm: process.env.OTP_ALGORITHM || "sha256",

    // OTP generation
    secret: process.env.OTP_SECRET,
    window: parseInt(process.env.OTP_WINDOW) || 1,

    // OTP storage
    storageType: process.env.OTP_STORAGE_TYPE || "redis",
    encryptOTP: process.env.OTP_ENCRYPT === "true",

    // OTP cleanup
    cleanupInterval: parseInt(process.env.OTP_CLEANUP_INTERVAL) || 600000, // 10 minutes

    // SMS security
    enableSMSThrottling: process.env.OTP_ENABLE_SMS_THROTTLING !== "false",
    smsThrottleWindow: parseInt(process.env.OTP_SMS_THROTTLE_WINDOW) || 60000, // 1 minute
    smsThrottleMaxRequests:
      parseInt(process.env.OTP_SMS_THROTTLE_MAX_REQUESTS) || 3,
  },

  // Rate Limiting
  rateLimit: {
    // Global rate limiting
    enabled: process.env.RATE_LIMIT_ENABLED !== "false",
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,

    // Rate limit storage
    storageType: process.env.RATE_LIMIT_STORAGE_TYPE || "redis",

    // Rate limit rules
    rules: {
      auth: {
        windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10,
      },
      register: {
        windowMs:
          parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS) || 3600000, // 1 hour
        max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX) || 5,
      },
      login: {
        windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 10,
      },
      otp: {
        windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS) || 300000, // 5 minutes
        max: parseInt(process.env.RATE_LIMIT_OTP_MAX) || 5,
      },
      passwordReset: {
        windowMs:
          parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS) || 3600000, // 1 hour
        max: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_MAX) || 3,
      },
    },
  },

  // CORS Configuration
  cors: {
    enabled: process.env.CORS_ENABLED !== "false",
    origin: process.env.CORS_ORIGIN || "*",
    methods: process.env.CORS_METHODS
      ? process.env.CORS_METHODS.split(",")
      : ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS
      ? process.env.CORS_ALLOWED_HEADERS.split(",")
      : [
          "Content-Type",
          "Authorization",
          "X-API-Key",
          "X-Device-ID",
          "X-App-Version",
        ],
    credentials: process.env.CORS_CREDENTIALS === "true",
    maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400,
  },

  // Content Security Policy
  csp: {
    enabled: process.env.CSP_ENABLED !== "false",
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
    reportUri: process.env.CSP_REPORT_URI,
    reportOnly: process.env.CSP_REPORT_ONLY === "true",
  },

  // Security Headers
  headers: {
    enableHSTS: process.env.SECURITY_ENABLE_HSTS !== "false",
    hstsMaxAge: parseInt(process.env.SECURITY_HSTS_MAX_AGE) || 31536000, // 1 year
    hstsIncludeSubdomains:
      process.env.SECURITY_HSTS_INCLUDE_SUBDOMAINS !== "false",
    hstsPreload: process.env.SECURITY_HSTS_PRELOAD === "true",

    enableXSSProtection: process.env.SECURITY_ENABLE_XSS_PROTECTION !== "false",
    enableNoSniff: process.env.SECURITY_ENABLE_NO_SNIFF !== "false",
    enableFrameGuard: process.env.SECURITY_ENABLE_FRAME_GUARD !== "false",
    frameGuardAction: process.env.SECURITY_FRAME_GUARD_ACTION || "deny",

    referrerPolicy:
      process.env.SECURITY_REFERRER_POLICY || "strict-origin-when-cross-origin",
    permissionsPolicy:
      process.env.SECURITY_PERMISSIONS_POLICY ||
      "camera=(), microphone=(), geolocation=()",
  },

  // Audit Configuration
  audit: {
    enabled: process.env.AUDIT_ENABLED !== "false",
    storageType: process.env.AUDIT_STORAGE_TYPE || "database",
    encryptAuditLogs: process.env.AUDIT_ENCRYPT_LOGS === "true",
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 2555, // 7 years

    // Audit events
    events: {
      authentication: process.env.AUDIT_AUTHENTICATION !== "false",
      authorization: process.env.AUDIT_AUTHORIZATION !== "false",
      dataAccess: process.env.AUDIT_DATA_ACCESS !== "false",
      dataModification: process.env.AUDIT_DATA_MODIFICATION !== "false",
      adminActions: process.env.AUDIT_ADMIN_ACTIONS !== "false",
      securityEvents: process.env.AUDIT_SECURITY_EVENTS !== "false",
    },
  },

  // Compliance Configuration
  compliance: {
    // China compliance
    enablePIPLCompliance: process.env.COMPLIANCE_ENABLE_PIPL !== "false",
    enableCybersecurityLaw:
      process.env.COMPLIANCE_ENABLE_CYBERSECURITY_LAW !== "false",
    enableDataSecurityLaw:
      process.env.COMPLIANCE_ENABLE_DATA_SECURITY_LAW !== "false",

    // Data residency
    dataResidencyRegion:
      process.env.COMPLIANCE_DATA_RESIDENCY_REGION || "cn-hangzhou",

    // Real-name verification
    enableRealNameVerification:
      process.env.COMPLIANCE_ENABLE_REAL_NAME_VERIFICATION === "true",

    // Content moderation
    enableContentModeration:
      process.env.COMPLIANCE_ENABLE_CONTENT_MODERATION !== "false",

    // Government integration
    enableGovernmentReporting:
      process.env.COMPLIANCE_ENABLE_GOVERNMENT_REPORTING === "true",
    governmentReportingEndpoint:
      process.env.COMPLIANCE_GOVERNMENT_REPORTING_ENDPOINT,
  },

  // Application Configuration
  app: {
    // Server configuration
    port: process.env.APP_PORT || 3000,
    nodeEnv: process.env.NODE_ENV || "development",

    // Service information
    serviceName: "user-service",
    serviceVersion: process.env.npm_package_version || "1.0.0",

    // API configuration
    apiPrefix: process.env.API_PREFIX || "/api/v1",
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["*"],

    // Pagination defaults
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 20,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 100,

    // OTP settings (consolidated from app.config.js)
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
    otpLength: parseInt(process.env.OTP_LENGTH) || 6,

    // Account settings
    accountLockoutMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES) || 30,
    maxFailedLoginAttempts:
      parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS) || 5,
    accountDeletionGracePeriodDays:
      parseInt(process.env.ACCOUNT_DELETION_GRACE_PERIOD_DAYS) || 15,

    // Logging configuration
    logLevel: process.env.LOG_LEVEL || "info",
    logFormat: process.env.LOG_FORMAT || "json",
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== "false",

    // Health check settings
    healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED !== "false",
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds

    // Feature flags
    features: {
      advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS === "true",
    },

    // External service endpoints
    mediaServiceUrl: process.env.MEDIA_SERVICE_URL || "http://localhost:3007",
    notificationServiceUrl:
      process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006",

    // Timezone and localization
    defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Shanghai",
    supportedLanguages: process.env.SUPPORTED_LANGUAGES
      ? process.env.SUPPORTED_LANGUAGES.split(",")
      : ["zh-CN", "en-US"],

    // Performance settings
    compressionEnabled: process.env.COMPRESSION_ENABLED !== "false",
    compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,

    // Development settings
    enableSwagger: process.env.ENABLE_SWAGGER === "true",
    enableDebugMode: process.env.ENABLE_DEBUG_MODE === "true",

    // Monitoring settings
    enableMetrics: process.env.ENABLE_METRICS !== "false",
    metricsPort: parseInt(process.env.METRICS_PORT) || 9090,

    // Database settings
    enableDatabaseLogging: process.env.ENABLE_DATABASE_LOGGING === "true",
    databaseConnectionPoolSize:
      parseInt(process.env.DATABASE_CONNECTION_POOL_SIZE) || 10,

    // Cache settings
    enableCaching: process.env.ENABLE_CACHING !== "false",
    cacheDefaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600, // 1 hour
  },
};

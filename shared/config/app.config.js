const dotenv = require("dotenv");
const securityConfig = require("./security.config");

// Load environment variables
dotenv.config();

// Re-export consolidated configuration from security.config.js
module.exports = {
  // Basic app settings (non-security related)
  serviceName: securityConfig.app.serviceName,
  serviceVersion: securityConfig.app.serviceVersion,
  port: securityConfig.app.port,
  nodeEnv: securityConfig.app.nodeEnv,

  // API configuration
  apiPrefix: securityConfig.app.apiPrefix,
  allowedOrigins: securityConfig.app.allowedOrigins,

  // Pagination defaults
  defaultPageSize: securityConfig.app.defaultPageSize,
  maxPageSize: securityConfig.app.maxPageSize,

  // Session settings
  maxActiveSessionsPerUser: securityConfig.session.maxActiveSessionsPerUser,

  // OTP settings
  otpExpiryMinutes: securityConfig.app.otpExpiryMinutes,
  otpLength: securityConfig.app.otpLength,

  // Account settings
  accountLockoutMinutes: securityConfig.app.accountLockoutMinutes,
  maxFailedLoginAttempts: securityConfig.app.maxFailedLoginAttempts,
  accountDeletionGracePeriodDays:
    securityConfig.app.accountDeletionGracePeriodDays,

  // China compliance settings
  enableRealNameVerification:
    securityConfig.compliance.enableRealNameVerification,
  enableContentModeration: securityConfig.compliance.enableContentModeration,
  dataResidencyRegion: securityConfig.compliance.dataResidencyRegion,

  // Logging configuration
  logLevel: securityConfig.app.logLevel,
  logFormat: securityConfig.app.logFormat,
  enableAuditLogging: securityConfig.app.enableAuditLogging,

  // Health check settings
  healthCheckEnabled: securityConfig.app.healthCheckEnabled,
  healthCheckInterval: securityConfig.app.healthCheckInterval,

  // Feature flags
  features: securityConfig.app.features,

  // External service endpoints
  mediaServiceUrl: securityConfig.app.mediaServiceUrl,
  notificationServiceUrl: securityConfig.app.notificationServiceUrl,

  // Timezone and localization
  defaultTimezone: securityConfig.app.defaultTimezone,
  supportedLanguages: securityConfig.app.supportedLanguages,

  // Performance settings
  compressionEnabled: securityConfig.app.compressionEnabled,
  compressionThreshold: securityConfig.app.compressionThreshold,

  // Development settings
  enableSwagger: securityConfig.app.enableSwagger,
  enableDebugMode: securityConfig.app.enableDebugMode,

  // Monitoring settings
  enableMetrics: securityConfig.app.enableMetrics,
  metricsPort: securityConfig.app.metricsPort,

  // Database settings
  enableDatabaseLogging: securityConfig.app.enableDatabaseLogging,
  databaseConnectionPoolSize: securityConfig.app.databaseConnectionPoolSize,

  // Cache settings
  enableCaching: securityConfig.app.enableCaching,
  cacheDefaultTtl: securityConfig.app.cacheDefaultTtl,

  // Security settings (reference to security config)
  security: securityConfig,

  // Rate limiting (reference to security config)
  rateLimit: securityConfig.rateLimit,

  // CORS (reference to security config)
  cors: securityConfig.cors,

  // Headers (reference to security config)
  headers: securityConfig.headers,
};

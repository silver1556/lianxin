const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

module.exports = {
  // Alibaba Cloud SMS Configuration
  sms: {
    // Access credentials
    accessKeyId: process.env.ALIBABA_SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_SMS_ACCESS_KEY_SECRET,
    
    // Service configuration
    endpoint: process.env.ALIBABA_SMS_ENDPOINT || 'https://dysmsapi.aliyuncs.com',
    apiVersion: process.env.ALIBABA_SMS_API_VERSION || '2017-05-25',
    regionId: process.env.ALIBABA_SMS_REGION_ID || 'cn-hangzhou',
    
    // SMS settings
    signName: process.env.ALIBABA_SMS_SIGN_NAME || 'Lianxin',
    
    // Template IDs for different SMS types
    templates: {
      registration: process.env.ALIBABA_SMS_TEMPLATE_REGISTRATION || 'SMS_001',
      login: process.env.ALIBABA_SMS_TEMPLATE_LOGIN || 'SMS_002',
      passwordReset: process.env.ALIBABA_SMS_TEMPLATE_PASSWORD_RESET || 'SMS_003',
      phoneChange: process.env.ALIBABA_SMS_TEMPLATE_PHONE_CHANGE || 'SMS_004',
      securityAlert: process.env.ALIBABA_SMS_TEMPLATE_SECURITY_ALERT || 'SMS_005',
      accountDeactivation: process.env.ALIBABA_SMS_TEMPLATE_ACCOUNT_DEACTIVATION || 'SMS_006',
      verification: process.env.ALIBABA_SMS_TEMPLATE_VERIFICATION || 'SMS_007'
    },
    
    // Rate limiting
    rateLimiting: {
      enabled: process.env.ALIBABA_SMS_RATE_LIMITING_ENABLED !== 'false',
      maxPerMinute: parseInt(process.env.ALIBABA_SMS_MAX_PER_MINUTE) || 1,
      maxPerHour: parseInt(process.env.ALIBABA_SMS_MAX_PER_HOUR) || 5,
      maxPerDay: parseInt(process.env.ALIBABA_SMS_MAX_PER_DAY) || 20
    },
    
    // Retry configuration
    retry: {
      enabled: process.env.ALIBABA_SMS_RETRY_ENABLED !== 'false',
      maxAttempts: parseInt(process.env.ALIBABA_SMS_MAX_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.ALIBABA_SMS_RETRY_DELAY) || 1000,
      backoffMultiplier: parseFloat(process.env.ALIBABA_SMS_BACKOFF_MULTIPLIER) || 2.0
    },
    
    // Timeout configuration
    timeout: {
      connect: parseInt(process.env.ALIBABA_SMS_CONNECT_TIMEOUT) || 5000,
      request: parseInt(process.env.ALIBABA_SMS_REQUEST_TIMEOUT) || 10000
    },
    
    // Logging
    logging: {
      enabled: process.env.ALIBABA_SMS_LOGGING_ENABLED !== 'false',
      logLevel: process.env.ALIBABA_SMS_LOG_LEVEL || 'info',
      logRequests: process.env.ALIBABA_SMS_LOG_REQUESTS === 'true',
      logResponses: process.env.ALIBABA_SMS_LOG_RESPONSES === 'true'
    },
    
    // Security
    security: {
      enableSignatureValidation: process.env.ALIBABA_SMS_ENABLE_SIGNATURE_VALIDATION !== 'false',
      enableTimestampValidation: process.env.ALIBABA_SMS_ENABLE_TIMESTAMP_VALIDATION !== 'false',
      timestampTolerance: parseInt(process.env.ALIBABA_SMS_TIMESTAMP_TOLERANCE) || 300000, // 5 minutes
      enableEncryption: process.env.ALIBABA_SMS_ENABLE_ENCRYPTION === 'true'
    },
    
    // Monitoring
    monitoring: {
      enabled: process.env.ALIBABA_SMS_MONITORING_ENABLED === 'true',
      metricsCollection: process.env.ALIBABA_SMS_METRICS_COLLECTION === 'true',
      alerting: {
        enabled: process.env.ALIBABA_SMS_ALERTING_ENABLED === 'true',
        failureThreshold: parseInt(process.env.ALIBABA_SMS_FAILURE_THRESHOLD) || 5,
        timeWindow: parseInt(process.env.ALIBABA_SMS_ALERT_TIME_WINDOW) || 300000 // 5 minutes
      }
    }
  },
  
  // OTP Configuration
  otp: {
    // OTP settings
    length: parseInt(process.env.OTP_LENGTH) || 6,
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
    numbersOnly: process.env.OTP_NUMBERS_ONLY !== 'false',
    
    // OTP generation
    algorithm: process.env.OTP_ALGORITHM || 'numeric',
    charset: process.env.OTP_CHARSET || '0123456789',
    
    // OTP validation
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
    lockoutDuration: parseInt(process.env.OTP_LOCKOUT_DURATION) || 300000, // 5 minutes
    
    // OTP storage
    storageType: process.env.OTP_STORAGE_TYPE || 'redis',
    keyPrefix: process.env.OTP_KEY_PREFIX || 'otp:',
    
    // OTP security
    enableEncryption: process.env.OTP_ENABLE_ENCRYPTION === 'true',
    encryptionKey: process.env.OTP_ENCRYPTION_KEY,
    
    // OTP cleanup
    cleanupInterval: parseInt(process.env.OTP_CLEANUP_INTERVAL) || 600000, // 10 minutes
    cleanupBatchSize: parseInt(process.env.OTP_CLEANUP_BATCH_SIZE) || 100
  },
  
  // Phone number configuration
  phone: {
    // Default country code
    defaultCountryCode: process.env.PHONE_DEFAULT_COUNTRY_CODE || '+86',
    
    // Supported country codes
    supportedCountryCodes: process.env.PHONE_SUPPORTED_COUNTRY_CODES ? 
      process.env.PHONE_SUPPORTED_COUNTRY_CODES.split(',') : ['+86', '+852', '+853', '+886'],
    
    // Phone validation
    enableValidation: process.env.PHONE_ENABLE_VALIDATION !== 'false',
    strictValidation: process.env.PHONE_STRICT_VALIDATION === 'true',
    
    // Phone formatting
    enableFormatting: process.env.PHONE_ENABLE_FORMATTING !== 'false',
    formatStyle: process.env.PHONE_FORMAT_STYLE || 'international',
    
    // Phone number patterns (regex)
    patterns: {
      china: process.env.PHONE_PATTERN_CHINA || '^\\+86[1][3-9]\\d{9}$',
      hongkong: process.env.PHONE_PATTERN_HONGKONG || '^\\+852[2-9]\\d{7}$',
      macau: process.env.PHONE_PATTERN_MACAU || '^\\+853[2-9]\\d{7}$',
      taiwan: process.env.PHONE_PATTERN_TAIWAN || '^\\+886[2-9]\\d{8}$'
    }
  },
  
  // Compliance settings
  compliance: {
    // China Cybersecurity Law compliance
    enableContentFiltering: process.env.SMS_ENABLE_CONTENT_FILTERING !== 'false',
    contentFilteringAPI: process.env.SMS_CONTENT_FILTERING_API,
    
    // Data residency
    dataResidencyRegion: process.env.SMS_DATA_RESIDENCY_REGION || 'cn-hangzhou',
    
    // Audit logging
    enableAuditLogging: process.env.SMS_ENABLE_AUDIT_LOGGING !== 'false',
    auditLogRetentionDays: parseInt(process.env.SMS_AUDIT_LOG_RETENTION_DAYS) || 2555, // 7 years
    
    // Government reporting
    enableGovernmentReporting: process.env.SMS_ENABLE_GOVERNMENT_REPORTING === 'true',
    governmentReportingEndpoint: process.env.SMS_GOVERNMENT_REPORTING_ENDPOINT,
    
    // PIPL compliance
    enablePIPLCompliance: process.env.SMS_ENABLE_PIPL_COMPLIANCE !== 'false',
    
    // Real-name verification
    enableRealNameVerification: process.env.SMS_ENABLE_REAL_NAME_VERIFICATION === 'true',
    realNameVerificationAPI: process.env.SMS_REAL_NAME_VERIFICATION_API
  },
  
  // Fallback configuration
  fallback: {
    // Enable fallback to alternative SMS providers
    enabled: process.env.SMS_FALLBACK_ENABLED === 'true',
    
    // Fallback providers
    providers: process.env.SMS_FALLBACK_PROVIDERS ? 
      process.env.SMS_FALLBACK_PROVIDERS.split(',') : ['alibaba', 'tencent'],
    
    // Fallback triggers
    triggers: {
      enableOnFailure: process.env.SMS_FALLBACK_ON_FAILURE !== 'false',
      enableOnTimeout: process.env.SMS_FALLBACK_ON_TIMEOUT !== 'false',
      enableOnRateLimit: process.env.SMS_FALLBACK_ON_RATE_LIMIT !== 'false'
    },
    
    // Fallback thresholds
    thresholds: {
      failureRate: parseFloat(process.env.SMS_FALLBACK_FAILURE_RATE) || 0.1, // 10%
      timeoutRate: parseFloat(process.env.SMS_FALLBACK_TIMEOUT_RATE) || 0.05, // 5%
      timeWindow: parseInt(process.env.SMS_FALLBACK_TIME_WINDOW) || 300000 // 5 minutes
    }
  },
  
  // Development/Testing configuration
  development: {
    // Enable mock SMS for development
    enableMockSMS: process.env.SMS_ENABLE_MOCK === 'true',
    mockResponseDelay: parseInt(process.env.SMS_MOCK_RESPONSE_DELAY) || 1000,
    mockSuccessRate: parseFloat(process.env.SMS_MOCK_SUCCESS_RATE) || 0.95, // 95%
    
    // Test phone numbers
    testPhoneNumbers: process.env.SMS_TEST_PHONE_NUMBERS ? 
      process.env.SMS_TEST_PHONE_NUMBERS.split(',') : ['+86-138-0013-8000'],
    
    // Development logging
    enableVerboseLogging: process.env.SMS_ENABLE_VERBOSE_LOGGING === 'true',
    logSMSContent: process.env.SMS_LOG_CONTENT === 'true'
  },
  
  // Performance optimization
  performance: {
    // Connection pooling
    enableConnectionPooling: process.env.SMS_ENABLE_CONNECTION_POOLING !== 'false',
    maxConnections: parseInt(process.env.SMS_MAX_CONNECTIONS) || 10,
    
    // Request batching
    enableBatching: process.env.SMS_ENABLE_BATCHING === 'true',
    batchSize: parseInt(process.env.SMS_BATCH_SIZE) || 100,
    batchTimeout: parseInt(process.env.SMS_BATCH_TIMEOUT) || 5000,
    
    // Caching
    enableCaching: process.env.SMS_ENABLE_CACHING === 'true',
    cacheType: process.env.SMS_CACHE_TYPE || 'redis',
    cacheTTL: parseInt(process.env.SMS_CACHE_TTL) || 300000, // 5 minutes
    
    // Async processing
    enableAsyncProcessing: process.env.SMS_ENABLE_ASYNC_PROCESSING === 'true',
    queueType: process.env.SMS_QUEUE_TYPE || 'redis',
    maxQueueSize: parseInt(process.env.SMS_MAX_QUEUE_SIZE) || 1000
  }
};
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

module.exports = {
  // Basic app settings
  serviceName: "media-service",
  serviceVersion: process.env.npm_package_version || "1.0.0",
  nodeEnv: process.env.NODE_ENV || "development",

  // API configuration
  apiPrefix: "/api/v1",
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["*"],

  // File upload settings
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  tempDir: process.env.TEMP_DIR || "./temp",

  // Supported file types
  supportedImageTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/bmp",
    "image/svg+xml",
  ],
  supportedVideoTypes: [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "video/3gp",
    "video/m4v",
  ],

  // Image processing settings
  imageProcessing: {
    quality: {
      high: 95,
      medium: 85,
      low: 75,
      thumbnail: 60,
    },
    formats: ["jpeg", "webp", "png"],
    maxDimensions: {
      profile: 2048,
      cover: 1920,
      post: 4096,
      thumbnail: 500,
    },
  },

  // Video processing settings
  videoProcessing: {
    required: true, // If true, fails app if initialization failed
    maxDuration: 600, // 10 minutes
    maxDimension: 4096,
    minThumbnailInterval: 1, //1 sec
    resolutions: [
      { name: "360p", width: 640, height: 360, bitrate: "800k" },
      { name: "480p", width: 854, height: 480, bitrate: "1200k" },
      { name: "720p", width: 1280, height: 720, bitrate: "2500k" },
      { name: "1080p", width: 1920, height: 1080, bitrate: "5000k" },
    ],
    thumbnailCount: 3,
    previewWidth: 720,
    previewHeight: 720,
    thumbnailWidth: 640,
    thumbnailHeight: 360,
  },

  // processing configurations
  standardImageConfig: {
    profile: {
      sizes: [
        { name: "thumbnail", width: 50, height: 50 },
        { name: "small", width: 100, height: 100 },
        { name: "medium", width: 200, height: 200 },
        { name: "large", width: 500, height: 500 },
        { name: "original", width: 2048, height: 2048 },
      ],
      quality: 90,
      format: "jpeg",
    },
    cover: {
      sizes: [
        { name: "mobile", width: 640, height: 360 },
        { name: "desktop", width: 1200, height: 675 },
        { name: "original", width: 1920, height: 1080 },
      ],
      quality: 85,
      format: "jpeg",
    },
    post: {
      sizes: [
        { name: "thumbnail", width: 200, height: 200 },
        { name: "small", width: 500, height: 500 },
        { name: "medium", width: 1080, height: 1080 },
        { name: "large", width: 2048, height: 2048 },
        { name: "original", width: 4096, height: 4096 },
      ],
      quality: 85,
      format: "jpeg",
    },
  },

  // Alibaba Cloud OSS configuration
  alibabaCloud: {
    region: process.env.ALIBABA_CLOUD_REGION || "oss-cn-hangzhou",
    accessKeyId: process.env.ALIBABA_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_ACCESS_KEY_SECRET,
    bucket: process.env.ALIBABA_BUCKET_NAME || "lianxin-media",
    endpoint: process.env.ALIBABA_OSS_ENDPOINT,
    cdnDomain: process.env.ALIBABA_CDN_DOMAIN,
    enableHttps: process.env.ALIBABA_ENABLE_HTTPS !== "false",
  },

  // ClamAV daemon configuration
  clamav: {
    required: process.env.CLAMAV_REQUIRED === "true", // If true, fails app if initialization failed
    enabled: process.env.CLAMAV_ENABLED !== "false",

    host: process.env.CLAMAV_HOST || "clamav",
    port: parseInt(process.env.CLAMAV_PORT) || 3310,
    timeout: parseInt(process.env.CLAMAV_TIMEOUT) || 30000,
    scanTimeout: parseInt(process.env.CLAMAV_SCAN_TIMEOUT) || 60000,
    maxFileSize:
      parseInt(process.env.CLAMAV_MAX_FILE_SIZE) || 100 * 1024 * 1024,
    connectionPoolSize: parseInt(process.env.CLAMAV_CONNECTION_POOL_SIZE) || 3,
    maxRetries: parseInt(process.env.CLAMAV_MAX_RETRIES) || 15,
    retryDelay: parseInt(process.env.CLAMAV_RETRY_DELAY) || 2000,
    enableConnectionPool: process.env.CLAMAV_ENABLE_CONNECTION_POOL !== "false",
    enableQueuedScanning: process.env.CLAMAV_ENABLE_QUEUED_SCANNING === "true",
    quarantineInfected: process.env.CLAMAV_QUARANTINE_INFECTED === "true",
    deleteInfected: process.env.CLAMAV_DELETE_INFECTED === "true",
    logScans: process.env.CLAMAV_LOG_SCANS !== "false",
    logCleanFiles: process.env.CLAMAV_LOG_CLEAN_FILES === "true",
    allowEicarTest: process.env.ALLOW_EICAR_TEST === "true",
  },

  // Queue configuration
  queue: {
    redis: {
      host: process.env.REDIS_HOST || "redis",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_QUEUE_DB) || 2,
    },
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
    removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE) || 100,
    removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL) || 50,

    // Job priorities
    priorities: {
      malwareScan: 10, // Highest priority for security
      storageUpload: 7,
      imageProcessing: 5,
      videoProcessing: 3,
      cleanup: 1, // Lowest priority
    },

    // Timeouts
    jobTimeouts: {
      malwareScan: 120000, // 2 minutes
      imageProcessing: 300000, // 5 minutes
      videoProcessing: 1800000, // 30 minutes
      storageUpload: 600000, // 10 minutes
      cleanup: 60000, // 1 minute
    },
  },

  // Rate limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== "false",
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
    upload: {
      windowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
      max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 10,
    },
    malwareScan: {
      windowMs:
        parseInt(process.env.MALWARE_SCAN_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
      max: parseInt(process.env.MALWARE_SCAN_RATE_LIMIT_MAX) || 20, // 20 scans per minute per IP
    },
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Device-ID",
      "X-App-Version",
      "X-Request-ID",
    ],
  },

  // External services
  userServiceUrl: process.env.USER_SERVICE_URL || "http://user-service:3001",

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || "info",
  enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== "false",

  // Feature flags
  features: {
    livePhotos: process.env.FEATURE_LIVE_PHOTOS !== "false",
    videoProcessing: process.env.FEATURE_VIDEO_PROCESSING !== "false",
    aiContentAnalysis: process.env.FEATURE_AI_CONTENT_ANALYSIS === "true",
    watermarking: process.env.FEATURE_WATERMARKING === "true",
    advancedMalwareScanning:
      process.env.FEATURE_ADVANCED_MALWARE_SCANNING !== "false",
    contentModeration: process.env.FEATURE_CONTENT_MODERATION === "true",
  },

  // Performance settings
  compressionEnabled: process.env.COMPRESSION_ENABLED !== "false",
  compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,

  // File processing settings
  processing: {
    // Concurrent file processing limits
    maxConcurrentUploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS) || 100,
    maxConcurrentScans: parseInt(process.env.MAX_CONCURRENT_SCANS) || 10,
    maxConcurrentProcessing:
      parseInt(process.env.MAX_CONCURRENT_PROCESSING) || 5,

    // Cleanup settings
    cleanupDelay: parseInt(process.env.CLEANUP_DELAY) || 600000, // 10 minutes
    tempFileRetention: parseInt(process.env.TEMP_FILE_RETENTION) || 3600000, // 1 hour

    // Processing timeouts
    uploadTimeout: parseInt(process.env.UPLOAD_TIMEOUT) || 600000, // 10 minutes
    processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT) || 600000, // 10 minutes
  },

  // Security settings
  security: {
    // File validation
    strictFileValidation: process.env.STRICT_FILE_VALIDATION !== "false",
    validateFileSignatures: process.env.VALIDATE_FILE_SIGNATURES !== "false",
    blockExecutableFiles: process.env.BLOCK_EXECUTABLE_FILES !== "false",

    // Malware scanning
    scanAllFiles: process.env.SCAN_ALL_FILES !== "false",
    quarantineInfectedFiles: process.env.QUARANTINE_INFECTED_FILES === "true",

    // Content filtering
    enableContentFiltering: process.env.ENABLE_CONTENT_FILTERING === "true",
    blockSuspiciousContent: process.env.BLOCK_SUSPICIOUS_CONTENT === "true",
  },

  // Development settings
  enableSwagger: process.env.ENABLE_SWAGGER === "true",
  enableDebugMode: process.env.ENABLE_DEBUG_MODE === "true",

  // Mock settings for development
  enableMockStorage: process.env.ENABLE_MOCK_STORAGE === "true",
  enableMockMalwareScanner: process.env.ENABLE_MOCK_MALWARE_SCANNER === "true",

  // Health check settings
  healthCheck: {
    enableDetailedHealth: process.env.ENABLE_DETAILED_HEALTH !== "false",
    includeSystemInfo: process.env.INCLUDE_SYSTEM_INFO !== "false",
    checkExternalServices: process.env.CHECK_EXTERNAL_SERVICES !== "false",
  },

  // Monitoring and metrics
  metrics: {
    enabled: process.env.METRICS_ENABLED === "true",
    port: parseInt(process.env.METRICS_PORT) || 9090,
    path: process.env.METRICS_PATH || "/metrics",
  },
};

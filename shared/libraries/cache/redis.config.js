const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Helper function to parse boolean values
const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return defaultValue;
};

// Validate required environment variables for production
const validateProductionConfig = () => {
  const requiredVars = ["REDIS_HOST"];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for Redis: ${missingVars.join(
        ", "
      )}`
    );
  }
};

const config = {
  development: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0,

    // Connection options
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    enableOfflineQueue: parseBoolean(
      process.env.REDIS_ENABLE_OFFLINE_QUEUE,
      false
    ), //Disable offline queue to fail fast

    // Connection pool
    lazyConnect: parseBoolean(process.env.REDIS_LAZY_CONNECT, false),
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE) || 30000,

    // Logging
    enableLogging: parseBoolean(process.env.REDIS_LOGGING_ENABLED, true),
    logLevel: process.env.REDIS_LOG_LEVEL || "info",

    // Security
    enableTLS: parseBoolean(process.env.REDIS_TLS_ENABLED, false),
    tls: parseBoolean(process.env.REDIS_TLS_ENABLED, false)
      ? {
          ca: process.env.REDIS_TLS_CA || null,
          cert: process.env.REDIS_TLS_CERT || null,
          key: process.env.REDIS_TLS_KEY || null,
          rejectUnauthorized: parseBoolean(
            process.env.REDIS_TLS_REJECT_UNAUTHORIZED,
            true
          ),
        }
      : null,

    // Family for IP resolution (4 = IPv4, 6 = IPv6)
    family: parseInt(process.env.REDIS_IP_FAMILY) || 4,
  },

  test: {
    host: process.env.REDIS_HOST_TEST || "localhost",
    port: parseInt(process.env.REDIS_PORT_TEST) || 6379,
    password: process.env.REDIS_PASSWORD_TEST || null,
    db: parseInt(process.env.REDIS_DB_TEST) || 1,

    // Faster timeouts for tests
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,

    lazyConnect: true,
    keepAlive: 10000,

    enableLogging: false,
    logLevel: "error",

    enableTLS: false,
    tls: null,

    family: 4,
  },

  production: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD, // Should be set in production
    db: parseInt(process.env.REDIS_DB) || 0,

    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    enableOfflineQueue: parseBoolean(
      process.env.REDIS_ENABLE_OFFLINE_QUEUE,
      false
    ), // disable offline queue to fail fast

    lazyConnect: parseBoolean(process.env.REDIS_LAZY_CONNECT, false),
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE) || 30000,

    enableLogging: parseBoolean(process.env.REDIS_LOGGING_ENABLED, true),
    logLevel: process.env.REDIS_LOG_LEVEL || "warn",

    // TLS typically enabled in production
    enableTLS: parseBoolean(process.env.REDIS_TLS_ENABLED, false),
    tls: parseBoolean(process.env.REDIS_TLS_ENABLED, false)
      ? {
          ca: process.env.REDIS_TLS_CA || null,
          cert: process.env.REDIS_TLS_CERT || null,
          key: process.env.REDIS_TLS_KEY || null,
          rejectUnauthorized: parseBoolean(
            process.env.REDIS_TLS_REJECT_UNAUTHORIZED,
            true
          ),
          servername: process.env.REDIS_TLS_SERVERNAME || null, // For SNI
        }
      : null,

    family: parseInt(process.env.REDIS_IP_FAMILY) || 4,
  },
};

// Cluster configuration
const clusterConfig = {
  enabled: parseBoolean(process.env.REDIS_CLUSTER_ENABLED, false),
  nodes: process.env.REDIS_CLUSTER_NODES
    ? process.env.REDIS_CLUSTER_NODES.split(",").map((node) => {
        const [host, port] = node.trim().split(":");
        if (!host) throw new Error(`Invalid cluster node format: ${node}`);
        return {
          host: host.trim(),
          port: parseInt(port) || 6379,
        };
      })
    : [],

  // Cluster options
  enableReadyCheck: parseBoolean(process.env.REDIS_CLUSTER_READY_CHECK, true),
  redisOptions: {
    password: process.env.REDIS_PASSWORD || null,
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    family: parseInt(process.env.REDIS_IP_FAMILY) || 4,
  },

  // Cluster scaling
  scaleReads: process.env.REDIS_CLUSTER_SCALE_READS || "master", // "master" | "slave" | "all"
  maxRedirections: parseInt(process.env.REDIS_CLUSTER_MAX_REDIRECTIONS) || 16,

  // Failover
  enableOfflineQueue: parseBoolean(
    process.env.REDIS_CLUSTER_OFFLINE_QUEUE,
    false
  ),
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,

  // Natural failover delay
  natMap: process.env.REDIS_CLUSTER_NAT_MAP || null,
};

// Cache configuration
const cacheConfig = {
  // Key prefixes (should be different for different services in microservice)
  keyPrefix: process.env.REDIS_KEY_PREFIX || "lianxin:",

  // TTL settings (in seconds)
  ttl: {
    session: parseInt(process.env.REDIS_SESSION_TTL) || 604800, // 7 days
    otp: parseInt(process.env.REDIS_OTP_TTL) || 600, // 10 minutes
    userProfileHot: parseInt(process.env.REDIS_USER_PROFILE_TTL) || 21600, // 6 hours
    userProfileFull: parseInt(process.env.REDIS_USER_PROFILE_FULL_TTL) || 3600, // 1 hour
    settings: parseInt(process.env.REDIS_SETTINGS_TTL) || 86400, // 24 hours
    tokenBlacklist: parseInt(process.env.REDIS_TOKEN_BLACKLIST_TTL) || 86400, // 24 hours
    rateLimiting: parseInt(process.env.REDIS_RATE_LIMIT_TTL) || 3600, // 1 hour
    friendList: parseInt(process.env.REDIS_FRIEND_LIST_TTL) || 1800, // 30 minutes
    avatar: parseInt(process.env.REDIS_AVATAR_TTL) || 604800, // 7 days
  },

  // Cache strategies
  strategies: {
    writeThrough: parseBoolean(process.env.REDIS_WRITE_THROUGH_ENABLED, true),
    cacheAside: parseBoolean(process.env.REDIS_CACHE_ASIDE_ENABLED, true),
    refreshAhead: parseBoolean(process.env.REDIS_REFRESH_AHEAD_ENABLED, false),
  },

  // Compression
  compression: {
    enabled: parseBoolean(process.env.REDIS_COMPRESSION_ENABLED, true),
    threshold: parseInt(process.env.REDIS_COMPRESSION_THRESHOLD) || 1024, // 1KB threshold
    algorithm: process.env.REDIS_COMPRESSION_ALGORITHM || "gzip", // "gzip" | "deflate" | "br"
  },

  // Serialization
  serialization: {
    format: process.env.REDIS_SERIALIZATION_FORMAT || "json", // "json" | "msgpack" | "cbor"
    enableEncryption: parseBoolean(
      process.env.REDIS_SERIALIZATION_ENCRYPTION,
      false
    ), // Encryption adds overhead
  },

  // Cache size limits
  maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || "allkeys-lru", // LRU eviction
};

// Health check configuration
const healthConfig = {
  enabled: parseBoolean(process.env.REDIS_HEALTH_CHECK_ENABLED, true),
  interval: parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL) || 30000,
  timeout: parseInt(process.env.REDIS_HEALTH_CHECK_TIMEOUT) || 5000,
  retryCount: parseInt(process.env.REDIS_HEALTH_CHECK_RETRIES) || 3,

  // Health check commands
  commands: {
    ping: true,
    info: parseBoolean(process.env.REDIS_HEALTH_CHECK_INFO, false), // More detailed but slower
    memory: parseBoolean(process.env.REDIS_HEALTH_CHECK_MEMORY, false),
  },
};

// Monitoring configuration
const monitoringConfig = {
  enabled: parseBoolean(process.env.REDIS_MONITORING_ENABLED, true),
  metricsCollection: parseBoolean(process.env.REDIS_METRICS_COLLECTION, true),
  slowLogEnabled: parseBoolean(process.env.REDIS_SLOW_LOG_ENABLED, true),
  slowLogThreshold: parseInt(process.env.REDIS_SLOW_LOG_THRESHOLD) || 100, // 100ms

  // Performance alerts
  alerts: {
    enabled: parseBoolean(process.env.REDIS_ALERTS_ENABLED, true),
    connectionThreshold:
      parseInt(process.env.REDIS_CONNECTION_ALERT_THRESHOLD) || 100,
    memoryThreshold: parseInt(process.env.REDIS_MEMORY_ALERT_THRESHOLD) || 90, // 90%
    latencyThreshold:
      parseInt(process.env.REDIS_LATENCY_ALERT_THRESHOLD) || 200, // 200ms
  },

  // Metrics retention
  metricsRetention: parseInt(process.env.REDIS_METRICS_RETENTION) || 86400, // 24 hours
};

// Get environment and validate
const environment = process.env.NODE_ENV || "development";

// Validate production configuration
if (environment === "production") {
  validateProductionConfig();
}

// Get base configuration for environment
const redisConfig = { ...config[environment] };

// Validate cluster configuration
if (clusterConfig.enabled && clusterConfig.nodes.length === 0) {
  throw new Error("Redis cluster is enabled but no nodes are configured");
}

// Add environment info
redisConfig.environment = environment;
redisConfig.configVersion = "1.0.0";
redisConfig.loadTime = new Date().toISOString();

// Merge additional configurations
redisConfig.cluster = clusterConfig;
redisConfig.cache = cacheConfig;
redisConfig.health = healthConfig;
redisConfig.monitoring = monitoringConfig;

// Validate final configuration
const validateConfig = (config) => {
  const errors = [];

  // Basic validation
  if (!config.host) errors.push("Redis host is required");
  if (config.port < 1 || config.port > 65535) errors.push("Invalid Redis port");
  if (config.db < 0 || config.db > 15)
    errors.push("Invalid Redis database number");

  // Timeout validation
  if (config.connectTimeout < 1000)
    errors.push("Connect timeout too low (minimum 1000ms)");
  if (config.commandTimeout < 1000)
    errors.push("Command timeout too low (minimum 1000ms)");

  // Cluster validation
  if (config.cluster.enabled) {
    if (config.cluster.nodes.length < 3)
      errors.push("Redis cluster requires at least 3 nodes");
    if (!["master", "slave", "all"].includes(config.cluster.scaleReads)) {
      errors.push("Invalid cluster scaleReads option");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Redis configuration validation failed:\n${errors.join("\n")}`
    );
  }
};

// Validate the configuration
validateConfig(redisConfig);

module.exports = redisConfig;

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: parseInt(process.env.REDIS_DB) || 0,
    
    // Connection options
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    
    // Connection pool
    lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE) || 30000,
    
    // Logging
    enableLogging: process.env.REDIS_LOGGING_ENABLED === 'true',
    logLevel: process.env.REDIS_LOG_LEVEL || 'info',
    
    // Security
    enableTLS: process.env.REDIS_TLS_ENABLED === 'true',
    tls: process.env.REDIS_TLS_ENABLED === 'true' ? {
      ca: process.env.REDIS_TLS_CA,
      cert: process.env.REDIS_TLS_CERT,
      key: process.env.REDIS_TLS_KEY,
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
    } : null
  },
  
  test: {
    host: process.env.REDIS_HOST_TEST || 'localhost',
    port: parseInt(process.env.REDIS_PORT_TEST) || 6379,
    password: process.env.REDIS_PASSWORD_TEST || null,
    db: parseInt(process.env.REDIS_DB_TEST) || 1,
    
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 2,
    
    lazyConnect: true,
    keepAlive: 10000,
    
    enableLogging: false,
    logLevel: 'error',
    
    enableTLS: false,
    tls: null
  },
  
  production: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    
    lazyConnect: false,
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE) || 30000,
    
    enableLogging: process.env.REDIS_LOGGING_ENABLED === 'true',
    logLevel: process.env.REDIS_LOG_LEVEL || 'warn',
    
    enableTLS: process.env.REDIS_TLS_ENABLED === 'true',
    tls: process.env.REDIS_TLS_ENABLED === 'true' ? {
      ca: process.env.REDIS_TLS_CA,
      cert: process.env.REDIS_TLS_CERT,
      key: process.env.REDIS_TLS_KEY,
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
    } : null
  }
};

// Cluster configuration
const clusterConfig = {
  enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
  nodes: process.env.REDIS_CLUSTER_NODES ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
    const [host, port] = node.split(':');
    return { host, port: parseInt(port) || 6379 };
  }) : [],
  
  // Cluster options
  enableReadyCheck: process.env.REDIS_CLUSTER_READY_CHECK !== 'false',
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000
  },
  
  // Cluster scaling
  scaleReads: process.env.REDIS_CLUSTER_SCALE_READS || 'slave',
  maxRedirections: parseInt(process.env.REDIS_CLUSTER_MAX_REDIRECTIONS) || 16,
  
  // Failover
  enableOfflineQueue: process.env.REDIS_CLUSTER_OFFLINE_QUEUE !== 'false',
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3
};

// Cache configuration
const cacheConfig = {
  // Key prefixes
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'lianxin:user:',
  
  // TTL settings (in seconds)
  ttl: {
    session: parseInt(process.env.REDIS_SESSION_TTL) || 604800, // 7 days
    otp: parseInt(process.env.REDIS_OTP_TTL) || 300, // 5 minutes
    userProfile: parseInt(process.env.REDIS_USER_PROFILE_TTL) || 3600, // 1 hour
    settings: parseInt(process.env.REDIS_SETTINGS_TTL) || 86400, // 24 hours
    tokenBlacklist: parseInt(process.env.REDIS_TOKEN_BLACKLIST_TTL) || 86400, // 24 hours
    rateLimiting: parseInt(process.env.REDIS_RATE_LIMIT_TTL) || 3600, // 1 hour
    friendList: parseInt(process.env.REDIS_FRIEND_LIST_TTL) || 1800, // 30 minutes
    avatar: parseInt(process.env.REDIS_AVATAR_TTL) || 604800 // 7 days
  },
  
  // Cache strategies
  strategies: {
    writeThrough: process.env.REDIS_WRITE_THROUGH_ENABLED !== 'false',
    cacheAside: process.env.REDIS_CACHE_ASIDE_ENABLED !== 'false',
    refreshAhead: process.env.REDIS_REFRESH_AHEAD_ENABLED === 'true'
  },
  
  // Compression
  compression: {
    enabled: process.env.REDIS_COMPRESSION_ENABLED === 'true',
    threshold: parseInt(process.env.REDIS_COMPRESSION_THRESHOLD) || 1024,
    algorithm: process.env.REDIS_COMPRESSION_ALGORITHM || 'gzip'
  },
  
  // Serialization
  serialization: {
    format: process.env.REDIS_SERIALIZATION_FORMAT || 'json',
    enableEncryption: process.env.REDIS_SERIALIZATION_ENCRYPTION === 'true'
  }
};

// Health check configuration
const healthConfig = {
  enabled: process.env.REDIS_HEALTH_CHECK_ENABLED !== 'false',
  interval: parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL) || 30000,
  timeout: parseInt(process.env.REDIS_HEALTH_CHECK_TIMEOUT) || 5000,
  retryCount: parseInt(process.env.REDIS_HEALTH_CHECK_RETRIES) || 3
};

// Monitoring configuration
const monitoringConfig = {
  enabled: process.env.REDIS_MONITORING_ENABLED === 'true',
  metricsCollection: process.env.REDIS_METRICS_COLLECTION === 'true',
  slowLogEnabled: process.env.REDIS_SLOW_LOG_ENABLED === 'true',
  slowLogThreshold: parseInt(process.env.REDIS_SLOW_LOG_THRESHOLD) || 100000, // 100ms
  
  // Performance alerts
  alerts: {
    enabled: process.env.REDIS_ALERTS_ENABLED === 'true',
    connectionThreshold: parseInt(process.env.REDIS_CONNECTION_ALERT_THRESHOLD) || 100,
    memoryThreshold: parseInt(process.env.REDIS_MEMORY_ALERT_THRESHOLD) || 80, // 80%
    latencyThreshold: parseInt(process.env.REDIS_LATENCY_ALERT_THRESHOLD) || 1000 // 1 second
  }
};

// Export configuration based on environment
const environment = process.env.NODE_ENV || 'development';
const redisConfig = config[environment];

// Merge additional configurations
redisConfig.cluster = clusterConfig;
redisConfig.cache = cacheConfig;
redisConfig.health = healthConfig;
redisConfig.monitoring = monitoringConfig;

module.exports = redisConfig;
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const config = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Mahmud1334@',
    database: process.env.DB_NAME || 'lianxin',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    timezone: '+08:00',
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      useUTC: false,
      dateStrings: true,
      typeCast: true,
      ssl: process.env.DB_SSL_ENABLED === 'true' ? {
        ca: process.env.DB_SSL_CA,
        key: process.env.DB_SSL_KEY,
        cert: process.env.DB_SSL_CERT,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      evict: parseInt(process.env.DB_POOL_EVICT) || 60000
    },
    logging: process.env.DB_LOGGING_ENABLED === 'true' ? console.log : false,
    benchmark: process.env.DB_BENCHMARK_ENABLED === 'true',
    retry: {
      max: parseInt(process.env.DB_RETRY_MAX) || 3,
      match: [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'ETIMEDOUT',
        'ESOCKETTIMEDOUT'
      ]
    }
  },

  test: {
    username: process.env.DB_USER_TEST || 'root',
    password: process.env.DB_PASSWORD_TEST || 'Mahmud1334@',
    database: process.env.DB_NAME_TEST || 'lianxin',
    host: process.env.DB_HOST_TEST || 'localhost',
    port: parseInt(process.env.DB_PORT_TEST) || 3306,
    dialect: 'mysql',
    timezone: '+08:00',
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      useUTC: false,
      dateStrings: true,
      typeCast: true
    },
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000
    },
    logging: false,
    benchmark: false
  },

  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    timezone: '+08:00',
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      useUTC: false,
      dateStrings: true,
      typeCast: true,
      ssl: {
        ca: process.env.DB_SSL_CA,
        key: process.env.DB_SSL_KEY,
        cert: process.env.DB_SSL_CERT,
        rejectUnauthorized: true
      }
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      evict: parseInt(process.env.DB_POOL_EVICT) || 60000
    },
    logging: process.env.DB_LOGGING_ENABLED === 'true' ? console.log : false,
    benchmark: false,
    retry: {
      max: parseInt(process.env.DB_RETRY_MAX) || 5,
      match: [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'ETIMEDOUT',
        'ESOCKETTIMEDOUT'
      ]
    }
  }
};

// Connection configuration
const connectionConfig = {
  // Connection options
  acquireConnectionTimeout: parseInt(process.env.DB_ACQUIRE_CONNECTION_TIMEOUT) || 30000,
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000,

  // Read replica configuration
  readReplicas: process.env.DB_READ_REPLICAS ? process.env.DB_READ_REPLICAS.split(',').map(replica => {
    const [host, port] = replica.split(':');
    return {
      host,
      port: parseInt(port) || 3306,
      username: process.env.DB_READ_REPLICA_USER || process.env.DB_USER,
      password: process.env.DB_READ_REPLICA_PASSWORD || process.env.DB_PASSWORD
    };
  }) : [],

  // Connection health check
  healthCheck: {
    enabled: process.env.DB_HEALTH_CHECK_ENABLED !== 'false',
    interval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL) || 30000,
    timeout: parseInt(process.env.DB_HEALTH_CHECK_TIMEOUT) || 10000
  },

  // Transaction settings
  transaction: {
    isolationLevel: process.env.DB_ISOLATION_LEVEL || 'READ_COMMITTED',
    deferrable: process.env.DB_DEFERRABLE === 'true',
    autocommit: process.env.DB_AUTOCOMMIT !== 'false'
  },

  // Backup settings
  backup: {
    enabled: process.env.DB_BACKUP_ENABLED === 'true',
    schedule: process.env.DB_BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    retention: parseInt(process.env.DB_BACKUP_RETENTION_DAYS) || 30
  }
};

// Export configuration based on environment
const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Merge connection config
dbConfig.connectionConfig = connectionConfig;

module.exports = dbConfig;
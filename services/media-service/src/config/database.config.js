const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const baseConfig = {
  dialect: "mysql",
  timezone: "+00:00",
  define: {
    collate: "utf8mb4_unicode_ci",
  },
  dialectOptions: {
    charset: "utf8mb4",
    dateStrings: true,
    typeCast: true,
    ssl:
      process.env.DB_SSL_ENABLED === "true"
        ? {
            ca: process.env.DB_SSL_CA,
            key: process.env.DB_SSL_KEY,
            cert: process.env.DB_SSL_CERT,
            rejectUnauthorized: false,
          }
        : false,
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 15,
    min: parseInt(process.env.DB_POOL_MIN) || 3,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
    idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    evict: parseInt(process.env.DB_POOL_EVICT) || 60000,
  },
  logging: process.env.DB_LOGGING_ENABLED === "true" ? console.log : false,
  benchmark: process.env.DB_BENCHMARK_ENABLED === "true",
  retry: {
    max: parseInt(process.env.DB_RETRY_MAX) || 3,
    match: [
      "ECONNRESET",
      "ENOTFOUND",
      "ECONNREFUSED",
      "EHOSTUNREACH",
      "ETIMEDOUT",
      "ESOCKETTIMEDOUT",
    ],
  },
};

const config = {
  development: {
    ...baseConfig,
    username: process.env.DB_USER_MEDIA_SERVICE,
    password: process.env.DB_PASSWORD_MEDIA_SERVICE,
    database: process.env.DB_NAME_MEDIA_SERVICE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
  },

  test: {
    ...baseConfig,
    username: process.env.DB_USER_TEST || "root",
    password: process.env.DB_PASSWORD_TEST || "Mahmud1334@",
    database: process.env.DB_NAME_TEST || "lianxin_media_test",
    host: process.env.DB_HOST_TEST || "localhost",
    port: parseInt(process.env.DB_PORT_TEST) || 3306,
    logging: false,
    benchmark: false,
  },

  production: {
    ...baseConfig,
    username: process.env.DB_USER_MEDIA_SERVICE,
    password: process.env.DB_PASSWORD_MEDIA_SERVICE,
    database: process.env.DB_NAME_MEDIA_SERVICE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      evict: parseInt(process.env.DB_POOL_EVICT) || 60000,
    },
  },
};

module.exports = config;

const { Sequelize } = require('sequelize');
const databaseConfig = require('../config/database.config');
const logger = require('../utils/logger.util');

// Initialize Sequelize
const sequelize = new Sequelize(
  databaseConfig.database,
  databaseConfig.username,
  databaseConfig.password,
  {
    host: databaseConfig.host,
    port: databaseConfig.port,
    dialect: databaseConfig.dialect,
    timezone: databaseConfig.timezone,
    dialectOptions: databaseConfig.dialectOptions,
    pool: databaseConfig.pool,
    logging: databaseConfig.logging,
    benchmark: databaseConfig.benchmark,
    retry: databaseConfig.retry
  }
);

// Import models
const User = require('./user.model')(sequelize);
const UserSession = require('./session.model')(sequelize);
const OtpVerification = require('./otp.model')(sequelize);
const UserSettings = require('./settings.model')(sequelize);
const AuditLog = require('./audit.model')(sequelize);

// Define associations
User.hasMany(UserSession, {
  foreignKey: 'user_id',
  as: 'sessions',
  onDelete: 'CASCADE'
});

UserSession.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

User.hasMany(OtpVerification, {
  foreignKey: 'user_id',
  as: 'otpVerifications',
  onDelete: 'CASCADE'
});

OtpVerification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

User.hasOne(UserSettings, {
  foreignKey: 'user_id',
  as: 'settings',
  onDelete: 'CASCADE'
});

UserSettings.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

User.hasMany(AuditLog, {
  foreignKey: 'user_id',
  as: 'auditLogs',
  onDelete: 'SET NULL'
});

AuditLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Database connection test
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Unable to connect to database', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// Database synchronization
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    logger.info('Database synchronized successfully');
    return true;
  } catch (error) {
    logger.error('Database synchronization failed', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
    return true;
  } catch (error) {
    logger.error('Error closing database connection', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  User,
  UserSession,
  OtpVerification,
  UserSettings,
  AuditLog,
  testConnection,
  syncDatabase,
  closeConnection
};
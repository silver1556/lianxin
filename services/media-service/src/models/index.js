const { Sequelize } = require("sequelize");
const databaseConfig = require("../config/database.config");
const logger = require("../../../../shared/utils/logger.util");

// Get environment-specific config
const environment = process.env.NODE_ENV || "development";
const config = databaseConfig[environment];

// Initialize Sequelize
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    timezone: config.timezone,
    dialectOptions: config.dialectOptions,
    pool: config.pool,
    logging: config.logging,
    benchmark: config.benchmark,
    retry: config.retry,
  }
);

// Import models
const MediaFile = require("./media-file.model")(sequelize);
const MediaVariant = require("./media-variant.model")(sequelize);
const MediaMetadata = require("./media-metadata.model")(sequelize);
const ProcessingJob = require("./processing-job.model")(sequelize);

// Define associations
MediaFile.hasMany(MediaVariant, {
  foreignKey: "media_file_id",
  as: "variants",
  onDelete: "CASCADE",
});

MediaVariant.belongsTo(MediaFile, {
  foreignKey: "media_file_id",
  as: "mediaFile",
});

MediaFile.hasOne(MediaMetadata, {
  foreignKey: "media_file_id",
  as: "metadata",
  onDelete: "CASCADE",
});

MediaMetadata.belongsTo(MediaFile, {
  foreignKey: "media_file_id",
  as: "mediaFile",
});

MediaFile.hasMany(ProcessingJob, {
  foreignKey: "media_file_id",
  as: "processingJobs",
  onDelete: "CASCADE",
});

ProcessingJob.belongsTo(MediaFile, {
  foreignKey: "media_file_id",
  as: "mediaFile",
});

// Database connection test
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Media service database connected");
    return true;
  } catch (error) {
    logger.error("Unable to connect to media service database", {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
};

// Database synchronization
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    logger.info("Media service database synchronized successfully");
    return true;
  } catch (error) {
    logger.error("Media service database synchronization failed", {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info("Media service database connection closed");
    return true;
  } catch (error) {
    logger.error("Error closing media service database connection", {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  MediaFile,
  MediaVariant,
  MediaMetadata,
  ProcessingJob,
  testConnection,
  syncDatabase,
  closeConnection,
};

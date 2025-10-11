"use strict";

const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const db = {};

const databaseConfig = require("../config/db-config");
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

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Database connection test
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info("User service database connected");
    return true;
  } catch (error) {
    logger.error("Unable to connect to user service database", {
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
    logger.info("User service database synchronized successfully");
    return true;
  } catch (error) {
    logger.error("User service database synchronization failed", {
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
    logger.info("User service database connection closed");
    return true;
  } catch (error) {
    logger.error("Error closing user service database connection", {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
};

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.testConnection = testConnection;
db.syncDatabase = syncDatabase;
db.closeConnection = closeConnection;

module.exports = db;

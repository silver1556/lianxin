// db config For sequelize-cli

require("dotenv").config(); // load .env

module.exports = {
  development: {
    username: process.env.DB_USER_USER_SERVICE || "root",
    password:
      process.env.DB_PASSWORD_USER_SERVICE ||
      process.env.MYSQL_ROOT_PASSWORD ||
      null,
    database: process.env.DB_NAME_USER_SERVICE || "user_service_db",
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: "mysql",
  },
  test: {
    username: process.env.DB_USER_USER_SERVICE || "root",
    password:
      process.env.DB_PASSWORD_USER_SERVICE ||
      process.env.MYSQL_ROOT_PASSWORD ||
      null,
    database: process.env.DB_NAME_USER_SERVICE || "user_service_db",
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: "mysql",
  },
  production: {
    username: process.env.DB_USER_USER_SERVICE || "root",
    password:
      process.env.DB_PASSWORD_USER_SERVICE ||
      process.env.MYSQL_ROOT_PASSWORD ||
      null,
    database: process.env.DB_NAME_USER_SERVICE || "user_service_db",
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: "mysql",
  },
};

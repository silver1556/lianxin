"use strict";
const fs = require("fs");
const path = require("path");

module.exports = {
  up: async (queryInterface) => {
    const sqlPath = path.join(__dirname, "audit_logs.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    return queryInterface.sequelize.query(sql);
  },

  down: async (queryInterface) => {
    return queryInterface.dropTable("audit_logs");
  },
};

"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      resource: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      resource_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      old_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      new_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      session_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes
    await queryInterface.addIndex("audit_logs", ["user_id"]);
    await queryInterface.addIndex("audit_logs", ["action"]);
    await queryInterface.addIndex("audit_logs", ["resource"]);
    await queryInterface.addIndex("audit_logs", ["created_at"]);
    await queryInterface.addIndex("audit_logs", ["user_id", "action"]);
    await queryInterface.addIndex("audit_logs", ["resource", "resource_id"]);
  },

  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable("audit_logs");
  },
};

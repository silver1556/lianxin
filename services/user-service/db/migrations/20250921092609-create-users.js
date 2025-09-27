"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },
      phone: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      phone_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.CHAR(60),
        allowNull: false,
      },
      password_changed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      password_history: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: Sequelize.ENUM(
          "active",
          "deactivated",
          "pending_deletion",
          "suspended"
        ),
        allowNull: false,
        defaultValue: "active",
      },
      suspension_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      suspension_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      registration_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      last_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      failed_login_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_failed_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deactivated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      pending_deletion_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Sequelize timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Add indexes
    await queryInterface.addIndex("users", ["phone_hash"]);
    await queryInterface.addIndex("users", ["status"]);
    await queryInterface.addIndex("users", ["created_at"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("users");
  },
};

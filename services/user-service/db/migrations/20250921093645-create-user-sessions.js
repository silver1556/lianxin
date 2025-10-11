"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_sessions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      session_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        unique: true,
      },
      refresh_token: {
        type: Sequelize.CHAR(64),
        allowNull: false,
        unique: true,
      },
      device_info: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      location: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_active_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      refresh_issued_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Indexes
    await queryInterface.addIndex("user_sessions", ["user_id"]);
    await queryInterface.addIndex("user_sessions", ["session_id"]);
    await queryInterface.addIndex("user_sessions", ["refresh_token"]);
    await queryInterface.addIndex("user_sessions", ["expires_at"]);
    await queryInterface.addIndex("user_sessions", ["is_active"]);
    await queryInterface.addIndex("user_sessions", ["last_active_at"]);
    await queryInterface.addIndex("user_sessions", ["user_id", "is_active"]);
  },

  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable("user_sessions");
  },
};

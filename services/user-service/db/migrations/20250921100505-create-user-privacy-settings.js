"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_privacy_settings", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
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
      field_name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      visibility: {
        type: Sequelize.ENUM("public", "friends", "private"),
        allowNull: false,
        defaultValue: "public",
      },
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
    await queryInterface.addIndex(
      "user_privacy_settings",
      ["user_id", "field_name"],
      { unique: true, name: "uniq_user_field" }
    );
    await queryInterface.addIndex("user_privacy_settings", ["user_id"], {
      name: "idx_user_id",
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable("user_privacy_settings");
  },
};

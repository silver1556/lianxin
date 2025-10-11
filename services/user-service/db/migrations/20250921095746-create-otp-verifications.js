"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("otp_verifications", {
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
        onDelete: "CASCADE",
      },
      verification_id: {
        type: Sequelize.UUID,
        unique: true,
        allowNull: false,
        defaultValue: Sequelize.literal("(UUID())"), // for MySQL, Sequelize.fn('UUID') can also work
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      otp_type: {
        type: Sequelize.ENUM(
          "registration",
          "login",
          "password_reset",
          "phone_number_change"
        ),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("generated", "sent", "verified"),
        allowNull: false,
        defaultValue: "generated",
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes
    await queryInterface.addIndex("otp_verifications", ["verification_id"]);
    await queryInterface.addIndex("otp_verifications", ["expires_at"]);
    await queryInterface.addIndex("otp_verifications", [
      "verified_at",
      "expires_at",
    ]);
    await queryInterface.addIndex("otp_verifications", [
      "phone",
      "otp_type",
      "created_at",
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable("otp_verifications");
  },
};

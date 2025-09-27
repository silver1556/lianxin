"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_profiles", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users", // references "users" table
          key: "id",
        },
        onDelete: "CASCADE",
      },
      display_name: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      first_name: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      last_name: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      cover_photo_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      birth_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        // defaultValue is handled in the model, not migration
      },
      gender: {
        type: Sequelize.ENUM("male", "female", "other"),
        allowNull: true,
      },
      hometown: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      lives_in: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      interested_in: {
        type: Sequelize.ENUM("men", "women", "both"),
        allowNull: true,
      },
      occupation: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      salary: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      relationship_status: {
        type: Sequelize.ENUM(
          "single",
          "in_relationship",
          "married",
          "Divorced"
        ),
        allowNull: true,
      },
      languages: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      hobbies: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      skills: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Indexes
    await queryInterface.addIndex("user_profiles", ["user_id"], {
      unique: true,
      name: "idx_user_profiles_user_id",
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable("user_profiles");
  },
};

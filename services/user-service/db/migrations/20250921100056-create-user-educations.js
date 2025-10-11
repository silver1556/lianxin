"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_educations", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("(UUID())"), // For MySQL, UUID generation
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
      school_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      degree: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      field_of_study: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      start_year: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: true,
      },
      end_year: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: true,
      },
      is_current: {
        type: Sequelize.TINYINT,
        allowNull: true,
        defaultValue: null,
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
    await queryInterface.addIndex("user_educations", ["user_id"], {
      name: "idx_user_id",
    });
    await queryInterface.addIndex("user_educations", ["school_name"], {
      name: "idx_school_name",
    });
    await queryInterface.addIndex("user_educations", ["degree"], {
      name: "idx_degree",
    });
    await queryInterface.addIndex("user_educations", ["field_of_study"], {
      name: "idx_field_of_study",
    });
    await queryInterface.addIndex("user_educations", ["start_year"], {
      name: "idx_start_year",
    });
    await queryInterface.addIndex("user_educations", ["end_year"], {
      name: "idx_end_year",
    });
    await queryInterface.addIndex(
      "user_educations",
      ["school_name", "degree", "field_of_study"],
      { name: "idx_school_degree_field" }
    );
  },

  async down(queryInterface, Sequelize) {
    // Drop table
    await queryInterface.dropTable("user_educations");
  },
};

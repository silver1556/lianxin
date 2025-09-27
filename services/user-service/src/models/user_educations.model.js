// models/userEducation.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserEducation = sequelize.define(
    "UserEducation",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: () => uuidv4(),
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      school_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      degree: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      field_of_study: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      start_year: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: true,
      },
      end_year: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: true,
      },
      is_current: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: "user_educations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["user_id"], name: "idx_user_id" },
        { fields: ["school_name"], name: "idx_school_name" },
        { fields: ["degree"], name: "idx_degree" },
        { fields: ["field_of_study"], name: "idx_field_of_study" },
        { fields: ["start_year"], name: "idx_start_year" },
        { fields: ["end_year"], name: "idx_end_year" },
        {
          fields: ["school_name", "degree", "field_of_study"],
          name: "idx_school_degree_field",
        },
      ],
    }
  );

  // Associations
  UserEducation.associate = (models) => {
    UserEducation.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });
  };

  return UserEducation;
};

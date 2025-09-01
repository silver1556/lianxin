/*
  # Create user privacy settings model
  (allows users to set visibility for individual profile fields)
  (per-field overrides)
*/

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UserPrivacySettings = sequelize.define(
    "UserPrivacySettings",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      field_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      visibility: {
        type: DataTypes.ENUM("public", "friends", "private"),
        allowNull: false,
        defaultValue: "public",
      },
    },
    {
      tableName: "user_privacy_settings",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true, // only 1 row per user per field
          fields: ["user_id", "field_name"],
        },
        {
          fields: ["user_id"],
        },
      ],
    }
  );

  // Allowed fields for privacy settings
  const ALLOWED_FIELDS = [
    "birth_date",
    "lives_in_location",
    "hometown",
    "occupation",
    "salary",
    "relationship_status",
    "languages",
    "hobbies",
    "skills",
  ];

  // Default visibility for each field
  const DEFAULT_VISIBILITY = {
    birth_date: "private",
    lives_in_location: "friends",
    hometown: "friends",
    occupation: "public",
    salary: "private",
    relationship_status: "public",
    languages: "public",
    hobbies: "public",
    skills: "public",
  };

  // Validate allowed fields
  UserPrivacySettings.beforeValidate((setting) => {
    if (!ALLOWED_FIELDS.includes(setting.field_name)) {
      throw new Error(`Invalid privacy field: ${setting.field_name}`);
    }
  });

  // Helper to set or update a single field
  UserPrivacySettings.setVisibility = async function (
    userId,
    field,
    visibility
  ) {
    return await this.upsert({
      user_id: userId,
      field_name: field,
      visibility,
    });
  };

  UserPrivacySettings.createDefault = async function (userId, options = {}) {
    const defaultSettings = ALLOWED_FIELDS.map((field) => ({
      user_id: userId,
      field_name: field,
      visibility: DEFAULT_VISIBILITY[field] || "public",
    }));

    return await this.bulkCreate(defaultSettings, options);
  };

  return UserPrivacySettings;
};

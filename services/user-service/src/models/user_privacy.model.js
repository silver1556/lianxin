module.exports = (sequelize, DataTypes) => {
  const UserPrivacySetting = sequelize.define(
    "UserPrivacySetting",
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

  // Associations
  UserPrivacySetting.associate = (models) => {
    UserPrivacySetting.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });
  };

  // Allowed fields for privacy settings
  const ALLOWED_FIELDS = [
    "birth_date",
    "birth_year",
    "lives_in",
    "hometown",
    "check_ins",
    "educations",
    "occupation",
    "salary",
    "relationship_status",
    "languages",
    "hobbies",
    "skills",
  ];

  // Default visibility for each field
  const DEFAULT_VISIBILITY = {
    birth_date: "public",
    birth_year: "private",
    interested_in: "public",
    lives_in: "friends",
    hometown: "friends",
    check_ins: "private",
    educations: "friends",
    occupation: "public",
    salary: "private",
    relationship_status: "public",
    languages: "public",
    hobbies: "public",
    skills: "public",
  };

  // Validate allowed fields
  UserPrivacySetting.beforeValidate((setting) => {
    if (!ALLOWED_FIELDS.includes(setting.field_name)) {
      throw new Error(`Invalid privacy field: ${setting.field_name}`);
    }
  });

  // Helper to set or update a single field
  UserPrivacySetting.setVisibility = async function (
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

  UserPrivacySetting.createDefault = async function (userId, options = {}) {
    const defaultSettings = ALLOWED_FIELDS.map((field) => ({
      user_id: userId,
      field_name: field,
      visibility: DEFAULT_VISIBILITY[field] || "public",
    }));

    return await this.bulkCreate(defaultSettings, options);
  };

  return UserPrivacySetting;
};

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UserSettings = sequelize.define(
    "UserSettings",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true, // only one settings row per user
        references: {
          model: "users",
          key: "id",
        },
      },
      privacy_settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          profile_visibility: "public",
          search_visibility: true,
          allow_friend_requests: true,
          message_permissions: "friends",
          allow_tagging: "friends",
        },
      },
      notification_settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          push_notifications: true,
          friend_requests: true,
          messages: true,
          likes: true,
          comments: true,
          shares: false,
          mentions: true,
          group_activities: true,
          event_reminders: true,
          security_alerts: true,
        },
      },
      display_settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          theme: "light",
          language: "zh-CN",
          font_size: "medium",
        },
      },
      security_settings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          login_alerts: true,
        },
      },
    },
    {
      tableName: "user_settings",
      timestamps: true,
      createdAt: false, // no created_at column
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["user_id"],
        },
      ],
    }
  );

  // Instance methods

  UserSettings.prototype.updatePartialSettings = async function (
    settingType,
    newSettings,
    transaction = null
  ) {
    // Merge existing settings with new updates
    const updatedSettings = {
      ...this[settingType],
      ...newSettings,
    };

    // Update specific setting type
    this[settingType] = updatedSettings;

    const options = transaction ? { transaction } : {};
    return await this.save(options);
  };

  UserSettings.prototype.getAllSettings = function () {
    return {
      privacy: this.privacy_settings,
      notifications: this.notification_settings,
      display: this.display_settings,
      security: this.security_settings,
    };
  };

  // Class methods
  UserSettings.findByUserId = async function (userId) {
    return await this.findOne({ where: { user_id: userId } });
  };

  UserSettings.createDefault = async function (userId, options = {}) {
    return await this.create({ user_id: userId }, options);
  };

  return UserSettings;
};

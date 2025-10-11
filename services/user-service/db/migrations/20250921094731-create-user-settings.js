"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_settings", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true, // one row per user
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      privacy_settings: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify({
          profile_visibility: "public",
          search_visibility: true,
          allow_friend_requests: true,
          message_permissions: "friends",
          allow_tagging: "friends",
        }),
      },
      notification_settings: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify({
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
        }),
      },
      display_settings: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify({
          theme: "light",
          language: "zh-CN",
          font_size: "medium",
        }),
      },
      security_settings: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify({
          login_alerts: true,
        }),
      },

      // timestamps
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Add indexes
    await queryInterface.addIndex("user_settings", ["user_id"]);
  },

  async down(queryInterface, Sequelize) {
    //  Drop table
    await queryInterface.dropTable("user_settings");
  },
};

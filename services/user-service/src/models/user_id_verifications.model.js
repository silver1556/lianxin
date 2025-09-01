const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UserIdVerification = sequelize.define(
    "UserIdVerification",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      document_type: {
        type: DataTypes.ENUM("id_card", "passport"),
        allowNull: false,
      },
      document_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
          isUrl: true,
        },
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      reviewed_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "users", // admin user later
          key: "id",
        },
      },
      reviewed_by_name: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "user_verifications",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [{ fields: ["status"] }, { fields: ["created_at"] }],
    }
  );

  return UserIdVerification;
};

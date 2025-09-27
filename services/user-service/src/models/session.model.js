module.exports = (sequelize, DataTypes) => {
  const { Op } = sequelize.Sequelize;

  const UserSession = sequelize.define(
    "UserSession",
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
      session_id: {
        type: DataTypes.CHAR(36),
        unique: true,
        allowNull: false,
      },
      refresh_token: {
        type: DataTypes.CHAR(64),
        unique: true,
        allowNull: false,
      },
      device_info: {
        type: DataTypes.JSON,
        allowNull: false,
        validate: {
          hasDeviceId(value) {
            if (!value.device_id) {
              throw new Error("device_id cannot be null");
            }
          },
        },
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      last_active_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      refresh_issued_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "user_sessions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [
        {
          fields: ["user_id"],
        },
        {
          fields: ["session_id"],
        },
        {
          fields: ["refresh_token"],
        },
        {
          fields: ["expires_at"],
        },
        {
          fields: ["is_active"],
        },
        {
          fields: ["last_active_at"],
        },
        {
          fields: ["user_id", "is_active"],
        },
      ],
    }
  );

  // Associations
  UserSession.associate = (models) => {
    UserSession.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });
  };

  // Instance methods
  UserSession.prototype.isExpired = function () {
    return new Date() > this.expires_at;
  };

  UserSession.prototype.isRevoked = function () {
    return this.revoked_at !== null;
  };

  UserSession.prototype.isValid = function () {
    return this.is_active && !this.isExpired() && !this.isRevoked();
  };

  UserSession.prototype.revoke = async function (t = null) {
    this.is_active = false;
    this.revoked_at = new Date();
    return await this.save({ transaction: t });
  };

  UserSession.prototype.toSafeObject = function () {
    const session = this.toJSON();
    delete session.refresh_token;
    return session;
  };

  // Class methods
  UserSession.findBySessionId = async function (sessionId) {
    return await this.findOne({
      where: {
        session_id: sessionId,
        is_active: true,
      },
    });
  };

  UserSession.findByRefreshToken = async function (refreshToken) {
    return await this.findOne({
      where: {
        refresh_token: refreshToken,
        is_active: true,
      },
    });
  };

  UserSession.findActiveSessionsByDevice = async function (
    userId,
    deviceId,
    transaction = null
  ) {
    return await this.findAll({
      where: {
        user_id: userId,
        is_active: true,
        "device_info.device_id": deviceId,
      },
      transaction,
    });
  };

  UserSession.findActiveSessionsAllByUserId = async function (
    userId,
    transaction = null
  ) {
    // Mark expired sessions as inactive for this user only
    await this.markExpiredAsInactive(userId, null); // run outside transaction to avoid locks

    // Fetch active sessions
    return await this.findAll({
      where: {
        user_id: userId,
        is_active: true,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });
  };

  // -------------------
  // Cleanup Methods
  // -------------------
  UserSession.markExpiredAsInactive = async function (
    userId = null,
    transaction = null
  ) {
    const whereClause = {
      is_active: true,
      expires_at: { [Op.lt]: new Date() },
      ...(userId && { user_id: userId }), // include user_id only if provided
    };
    return await this.update(
      { is_active: false },
      {
        where: whereClause,
        transaction,
      }
    );
  };

  UserSession.cleanupExpiredAndRevoked = async function () {
    const { Op } = require("sequelize");

    // Delete sessions that are either expired or revoked
    const deletedCount = await this.destroy({
      where: {
        is_active: false,
        [Op.or]: [
          { expires_at: { [Op.lt]: new Date() } },
          { revoked_at: { [Op.ne]: null } },
        ],
      },
    });

    return deletedCount;
  };

  return UserSession;
};

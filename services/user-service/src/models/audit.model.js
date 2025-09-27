module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    "AuditLog",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      resource: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      resource_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      old_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      new_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      session_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "audit_logs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [
        {
          fields: ["user_id"],
        },
        {
          fields: ["action"],
        },
        {
          fields: ["resource"],
        },
        {
          fields: ["created_at"],
        },
        {
          fields: ["user_id", "action"],
        },
        {
          fields: ["resource", "resource_id"],
        },
      ],
    }
  );

  // Associations
  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "SET NULL",
    });
  };

  // Class methods
  AuditLog.logAction = async function (data) {
    return await this.create({
      user_id: data.userId || null,
      action: data.action,
      resource: data.resource,
      resource_id: data.resourceId || null,
      old_values: data.oldValues || null,
      new_values: data.newValues || null,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      session_id: data.sessionId || null,
    });
  };

  AuditLog.findByUser = async function (userId, options = {}) {
    const { limit = 50, offset = 0, action, resource } = options;

    const where = { user_id: userId };
    if (action) where.action = action;
    if (resource) where.resource = resource;

    return await this.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });
  };

  AuditLog.findByResource = async function (
    resource,
    resourceId,
    options = {}
  ) {
    const { limit = 50, offset = 0 } = options;

    return await this.findAndCountAll({
      where: {
        resource,
        resource_id: resourceId,
      },
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });
  };

  AuditLog.cleanup = async function (daysOld = 2555) {
    // 7 years default
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
      where: {
        created_at: { [sequelize.Sequelize.Op.lt]: cutoffDate },
      },
    });
  };

  return AuditLog;
};

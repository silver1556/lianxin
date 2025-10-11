module.exports = (sequelize, DataTypes) => {
  const { Op } = sequelize.Sequelize;

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
      tableName: "user_id_verifications",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "idx_user_id",
          fields: ["user_id"], // lookup by user
        },
        {
          name: "idx_status",
          fields: ["status"], // filtering pending/approved/rejected
        },
        {
          name: "idx_created_at",
          fields: ["created_at"], // sorting pending by oldest
        },
      ],
    }
  );

  // Associations
  UserIdVerification.associate = (models) => {
    UserIdVerification.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });

    UserIdVerification.belongsTo(models.User, {
      foreignKey: "reviewed_by",
      as: "reviewer",
      onDelete: "SET NULL",
    });
  };

  // Instance Methods
  UserIdVerification.prototype.isExpired = function () {
    return this.expires_at && new Date() > this.expires_at;
  };

  UserIdVerification.prototype.isPending = function () {
    return this.status === "pending";
  };

  UserIdVerification.prototype.isApproved = function () {
    return this.status === "approved";
  };

  UserIdVerification.prototype.isRejected = function () {
    return this.status === "rejected";
  };

  UserIdVerification.prototype.markApproved = async function (
    reviewerId,
    reviewerName
  ) {
    this.status = "approved";
    this.reviewed_by = reviewerId;
    this.reviewed_by_name = reviewerName;
    this.reviewed_at = new Date();
    return await this.save();
  };

  UserIdVerification.prototype.markRejected = async function (
    reviewerId,
    reviewerName,
    reason
  ) {
    this.status = "rejected";
    this.reviewed_by = reviewerId;
    this.reviewed_by_name = reviewerName;
    this.reviewed_at = new Date();
    this.rejection_reason = reason;
    return await this.save();
  };

  // Class Methods
  UserIdVerification.findPendingByUser = async function (userId) {
    return await this.findOne({
      where: { user_id: userId, status: "pending" },
      order: [["created_at", "DESC"]],
    });
  };

  UserIdVerification.findLatestByUser = async function (userId) {
    return await this.findOne({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });
  };

  UserIdVerification.findAllPending = async function () {
    return await this.findAll({
      where: { status: "pending" },
      order: [["created_at", "ASC"]], // Oldest one first
    });
  };

  UserIdVerification.findReviewed = async function () {
    return await this.findAll({
      where: { status: { [Op.in]: ["approved", "rejected"] } },
      order: [["reviewed_at", "DESC"]],
    });
  };

  UserIdVerification.findAllByReviewer = async function (reviewerId) {
    return await this.findAll({
      where: { reviewed_by: reviewerId },
      order: [["reviewed_at", "DESC"]],
    });
  };

  UserIdVerification.findAllByDocumentType = async function (documentType) {
    return await this.findAll({
      where: { document_type: documentType },
      attributes: ["user_id", "status"], // return both user_id and status
      group: ["user_id"], // ensure uniqueness
      order: [["created_at", "DESC"]],
    });
  };

  return UserIdVerification;
};

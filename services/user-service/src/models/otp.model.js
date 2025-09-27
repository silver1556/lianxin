const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const { Op } = sequelize.Sequelize;

  const OtpVerification = sequelize.define(
    "OtpVerification",
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
      verification_id: {
        type: DataTypes.UUID,
        unique: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      otp_type: {
        type: DataTypes.ENUM(
          "registration",
          "login",
          "password_reset",
          "phone_number_change"
        ),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("generated", "sent", "verified"),
        allowNull: false,
        defaultValue: "generated",
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "otp_verifications",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      indexes: [
        {
          fields: ["verification_id"],
        },
        {
          fields: ["expires_at"],
        },
        {
          fields: ["verified_at", "expires_at"],
        },
        {
          fields: ["phone", "type", "created_at"],
        },
      ],
    }
  );

  // Associations
  OtpVerification.associate = (models) => {
    OtpVerification.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    });
  };

  // Instance methods
  OtpVerification.prototype.isExpired = function () {
    return new Date() > this.expires_at;
  };

  OtpVerification.prototype.isVerified = function () {
    return this.verified_at != null;
  };

  OtpVerification.prototype.markAsVerified = async function () {
    this.verified_at = new Date();
    this.status = "verified";
    return await this.save();
  };

  // Class methods
  OtpVerification.findByVerificationId = async function (verificationId) {
    return await this.findOne({
      where: { verification_id: verificationId },
    });
  };

  OtpVerification.findByPhone = async function (phone) {
    return await this.findAll({
      where: {
        phone,
      },
      order: [["created_at", "DESC"]],
    });
  };

  OtpVerification.findByUserId = async function (userId) {
    return await this.findAll({
      where: {
        userId,
      },
      order: [["created_at", "DESC"]],
    });
  };

  /**
   * Count OTP verification records created after a given timestamp.
   *
   * @async
   * @function countRecentOtp
   * @memberof OtpVerification
   *
   * @param {string} phone - The phone number (E.164 format) to search for.
   * @param {string} otpType - The type of OTP to filter by ('registration', 'login', 'password_reset', 'phone_number_change').
   * @param {Date} timeAgo - Only include OTPs created at or after this timestamp.
   *
   * @returns {Promise<number>} The count of OTP verification records matching the criteria.
   */
  OtpVerification.countRecentOtp = async function (phone, otpType, timeAgo) {
    return await this.count({
      where: {
        phone,
        otp_type: otpType,
        created_at: { [Op.gte]: timeAgo },
      },
    });
  };

  // Cleanup rows that are older than 7 days and not verified
  OtpVerification.cleanupExpired = async function (daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
      where: {
        expires_at: { [Op.lt]: cutoffDate },
        verified_at: null,
      },
    });
  };

  // Cleanup rows that are older than 15 days and verified
  OtpVerification.cleanupVerified = async function (daysOld = 15) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
      where: {
        verified_at: {
          [Op.lt]: cutoffDate,
          [Op.not]: null,
        },
      },
    });
  };

  return OtpVerification;
};

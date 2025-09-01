const { DataTypes, Sequelize } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const { Op } = Sequelize;

module.exports = (sequelize) => {
  const OtpVerification = sequelize.define(
    "OtpVerification",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      verification_id: {
        type: DataTypes.UUID,
        unique: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      country_code: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "+86",
      },
      otp_code: {
        type: DataTypes.STRING(6),
        allowNull: false,
        validate: {
          isNumeric: true,
          len: [6, 6],
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
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
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
          fields: ["phone", "country_code"],
        },
        {
          fields: ["otp_type"],
        },
        {
          fields: ["expires_at"],
        },
        {
          fields: ["verified_at", "expires_at"],
        },
        {
          fields: ["user_id"],
        },
      ],
    }
  );

  OtpVerification.cleanupExpired = async function () {
    return await this.destroy({
      where: {
        expires_at: { [Op.lt]: new Date() },
        verified_at: null,
      },
    });
  };

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

  // Instance methods
  OtpVerification.prototype.isExpired = function () {
    return new Date() > this.expires_at;
  };

  OtpVerification.prototype.isVerified = function () {
    return this.verified_at != null;
  };

  OtpVerification.prototype.canVerify = function () {
    if (this.verified_at == null && this.expires_at > new Date())
      return !this.verified_at && !this.isExpired();
    return false;
  };

  OtpVerification.prototype.markAsVerified = async function () {
    this.verified_at = new Date();
    return await this.save();
  };

  // Class methods
  OtpVerification.findByVerificationId = async function (verificationId) {
    return await this.findOne({
      where: { verification_id: verificationId },
    });
  };

  OtpVerification.findActiveByPhone = async function (phone, otpType) {
    return await this.findOne({
      where: {
        phone,
        otp_type: otpType,
        verified_at: null,
        expires_at: { [sequelize.Sequelize.Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });
  };

  OtpVerification.cleanupExpired = async function () {
    return await this.destroy({
      where: {
        expires_at: { [sequelize.Sequelize.Op.lt]: new Date() },
        verified_at: null,
      },
    });
  };

  OtpVerification.cleanupVerified = async function (daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.destroy({
      where: {
        verified_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate,
          [sequelize.Sequelize.Op.not]: null,
        },
      },
    });
  };

  return OtpVerification;
};

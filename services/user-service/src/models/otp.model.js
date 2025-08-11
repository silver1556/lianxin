const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const OtpVerification = sequelize.define('OtpVerification', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    verification_id: {
      type: DataTypes.UUID,
      unique: true,
      allowNull: false,
      defaultValue: () => uuidv4()
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    country_code: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: '+86'
    },
    otp_code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      validate: {
        isNumeric: true,
        len: [6, 6]
      }
    },
    otp_type: {
      type: DataTypes.ENUM('registration', 'login', 'password_reset', 'phone_number_change'),
      allowNull: false
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    attempts: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    max_attempts: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 3
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'otp_verifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['verification_id']
      },
      {
        fields: ['phone', 'country_code']
      },
      {
        fields: ['otp_type']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['is_verified', 'expires_at']
      },
      {
        fields: ['user_id']
      }
    ]
  });

  // Instance methods
  OtpVerification.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  OtpVerification.prototype.isMaxAttemptsReached = function() {
    return this.attempts >= this.max_attempts;
  };

  OtpVerification.prototype.canVerify = function() {
    return !this.is_verified && 
           !this.isExpired() && 
           !this.isMaxAttemptsReached();
  };

  OtpVerification.prototype.incrementAttempts = async function() {
    this.attempts += 1;
    return await this.save();
  };

  OtpVerification.prototype.markAsVerified = async function() {
    this.is_verified = true;
    this.verified_at = new Date();
    return await this.save();
  };

  // Class methods
  OtpVerification.findByVerificationId = async function(verificationId) {
    return await this.findOne({ 
      where: { verification_id: verificationId }
    });
  };

  OtpVerification.findActiveByPhone = async function(phone, otpType) {
    return await this.findOne({ 
      where: { 
        phone,
        otp_type: otpType,
        is_verified: false,
        expires_at: { [sequelize.Sequelize.Op.gt]: new Date() }
      },
      order: [['created_at', 'DESC']]
    });
  };

  OtpVerification.cleanupExpired = async function() {
    return await this.destroy({
      where: {
        expires_at: { [sequelize.Sequelize.Op.lt]: new Date() },
        is_verified: false
      }
    });
  };

  OtpVerification.cleanupVerified = async function(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return await this.destroy({
      where: {
        verified_at: { 
          [sequelize.Sequelize.Op.lt]: cutoffDate,
          [sequelize.Sequelize.Op.not]: null
        }
      }
    });
  };

  return OtpVerification;
};
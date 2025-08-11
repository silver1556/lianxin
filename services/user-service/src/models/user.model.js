const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    uuid: {
      type: DataTypes.UUID,
      unique: true,
      allowNull: false,
      defaultValue: () => uuidv4()
    },
    phone: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
      validate: {
        notEmpty: true,
        is: /^\+\d{1,4}-\d{3,15}$/
      }
    },
    country_code: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: '+86',
      validate: {
        isIn: [['+86', '+852', '+853', '+886']]
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Profile Information
    display_name: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [1, 20]
      }
    },
    first_name: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: [1, 10]
      }
    },
    last_name: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: [1, 10]
      }
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500]
      }
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    cover_photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    birth_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0]
      }
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    occupation: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    education: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    relationship_status: {
      type: DataTypes.ENUM('single', 'in_relationship', 'married', 'complicated'),
      allowNull: true
    },
    languages: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ['zh-CN']
    },

    // Account Status
    phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phone_verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verification_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    is_private: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.ENUM('active', 'deactivated', 'pending_deletion', 'suspended'),
      allowNull: false,
      defaultValue: 'active'
    },
    suspension_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    suspension_until: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Tracking
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    login_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    registration_ip: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    last_ip: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_failed_login: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Timestamps
    deactivated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    pending_deletion_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['phone']
      },
      {
        fields: ['uuid']
      },
      {
        fields: ['display_name']
      },
      {
        fields: ['status']
      },
      {
        fields: ['phone_verified']
      },
      {
        fields: ['created_at']
      }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
          user.password_changed_at = new Date();
        }
      }
    }
  });

  // Instance methods
  User.prototype.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  User.prototype.toSafeObject = function () {
    const user = this.toJSON();
    delete user.password_hash;
    delete user.verification_data;
    delete user.failed_login_attempts;
    delete user.last_failed_login;
    delete user.registration_ip;
    delete user.last_ip;
    return user;
  };

  User.prototype.toPublicObject = function () {
    const user = this.toSafeObject();
    delete user.phone;
    delete user.birth_date;
    delete user.location;
    delete user.website;
    delete user.occupation;
    delete user.education;
    delete user.relationship_status;
    delete user.languages;
    delete user.phone_verified;
    delete user.phone_verified_at;
    delete user.suspension_reason;
    delete user.suspension_until;
    delete user.login_count;
    delete user.deactivated_at;
    delete user.pending_deletion_at;
    return user;
  };

  User.prototype.isAccountLocked = function () {
    return this.failed_login_attempts >= 5 &&
      this.last_failed_login &&
      (Date.now() - this.last_failed_login.getTime()) < 30 * 60 * 1000; // 30 minutes
  };

  User.prototype.isSuspended = function () {
    return this.status === 'suspended' &&
      this.suspension_until &&
      new Date() < this.suspension_until;
  };

  User.prototype.canLogin = function () {
    return this.status === 'active' &&
      !this.isAccountLocked() &&
      !this.isSuspended();
  };

  // Class methods
  User.findByPhone = async function (phone) {
    return await this.findOne({ where: { phone } });
  };

  User.findByUuid = async function (uuid) {
    return await this.findOne({ where: { uuid } });
  };

  return User;
};
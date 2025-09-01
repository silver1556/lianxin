const { DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      uuid: {
        type: DataTypes.UUID,
        unique: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      phone: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      phone_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      password_hash: {
        type: DataTypes.CHAR(60),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      password_changed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      password_history: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },

      // Account Status
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM(
          "active",
          "deactivated",
          "pending_deletion",
          "suspended"
        ),
        allowNull: false,
        defaultValue: "active",
      },
      suspension_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      suspension_until: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Tracking
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      registration_ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      last_ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      failed_login_attempts: {
        //in redis later
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      last_failed_login: {
        //in redis later
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Timestamps
      deactivated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      pending_deletion_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["phone_hash"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["created_at"],
        },
      ],
      hooks: {
        beforeCreate: async (user) => {
          if (user.password_hash) {
            user.password_hash = await bcrypt.hash(user.password_hash, 12);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("password_hash")) {
            // Initialize password_history if null
            const history = Array.isArray(user.password_history)
              ? [...user.password_history]
              : [];

            // Add the previous password to history
            const previousPassword = user.previous("password_hash"); // cleaner than _previousDataValues
            if (previousPassword) {
              history.push({ hash: previousPassword, changed_at: new Date() });
            }

            // Keep only last 5 passwords
            const lastFive = history.slice(-5);

            // Update the JSON field explicitly
            user.setDataValue("password_history", lastFive);

            // Hash the new password
            user.password_hash = await bcrypt.hash(user.password_hash, 12);
            user.password_changed_at = new Date();
          }
        },
      },
    }
  );

  // Instance methods
  User.prototype.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  User.prototype.isPasswordReused = async function (newPassword) {
    for (const entry of this.password_history || []) {
      if (await bcrypt.compare(newPassword, entry.hash)) {
        return true;
      }
    }
    return false;
  };

  User.prototype.toSafeObject = function () {
    const user = this.toJSON();
    delete user.phone_hash;
    delete user.password_hash;
    delete user.password_history;
    delete user.verification_data;
    delete user.failed_login_attempts;
    delete user.last_failed_login;
    delete user.registration_ip;
    delete user.last_ip;
    return user;
  };

  User.prototype.isAccountLocked = function () {
    return (
      this.failed_login_attempts >= 5 &&
      this.last_failed_login &&
      Date.now() - this.last_failed_login.getTime() < 30 * 60 * 1000
    ); // 30 minutes lock
  };

  User.prototype.isSuspended = function () {
    return (
      this.status === "suspended" &&
      this.suspension_until &&
      new Date() < this.suspension_until
    );
  };

  // Class methods
  User.findByPhoneHash = async function (
    phoneHash,
    attributes = null,
    isRaw = false
  ) {
    const options = { where: { phone_hash: phoneHash } };
    if (attributes) {
      options.attributes = attributes; // only fetch selected fields
    }
    if (isRaw) {
      options.raw = true;
    }
    return await this.findOne(options);
  };

  User.findByUuid = async function (uuid, attributes = null, isRaw = false) {
    const options = { where: { uuid } };
    if (attributes) {
      options.attributes = attributes; // only fetch selected fields
    }
    if (isRaw) {
      options.raw = true;
    }
    return await this.findOne(options);
  };

  return User;
};

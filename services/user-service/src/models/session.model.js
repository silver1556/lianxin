const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const UserSession = sequelize.define('UserSession', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    session_id: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
      defaultValue: () => uuidv4()
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false
    },
    device_info: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['session_id']
      },
      {
        fields: ['refresh_token']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['user_id', 'is_active']
      }
    ]
  });

  // Instance methods
  UserSession.prototype.isExpired = function() {
    return new Date() > this.expires_at;
  };

  UserSession.prototype.isRevoked = function() {
    return this.revoked_at !== null;
  };

  UserSession.prototype.isValid = function() {
    return this.is_active && !this.isExpired() && !this.isRevoked();
  };

  UserSession.prototype.revoke = async function() {
    this.is_active = false;
    this.revoked_at = new Date();
    return await this.save();
  };

  UserSession.prototype.toSafeObject = function() {
    const session = this.toJSON();
    delete session.refresh_token;
    return session;
  };

  // Class methods
  UserSession.findBySessionId = async function(sessionId) {
    return await this.findOne({ 
      where: { 
        session_id: sessionId,
        is_active: true
      }
    });
  };

  UserSession.findByRefreshToken = async function(refreshToken) {
    return await this.findOne({ 
      where: { 
        refresh_token: refreshToken,
        is_active: true
      }
    });
  };

  UserSession.findActiveByUserId = async function(userId) {
    return await this.findAll({ 
      where: { 
        user_id: userId,
        is_active: true
      },
      order: [['created_at', 'DESC']]
    });
  };

  UserSession.cleanupExpired = async function() {
    return await this.update(
      { is_active: false },
      { 
        where: { 
          expires_at: { [sequelize.Sequelize.Op.lt]: new Date() },
          is_active: true
        }
      }
    );
  };

  return UserSession;
};
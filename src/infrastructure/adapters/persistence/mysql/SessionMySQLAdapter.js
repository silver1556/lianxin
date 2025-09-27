const SessionRepositoryPort = require('../../../../core/domain/user/ports/SessionRepositoryPort');
const UserSession = require('../../../../core/domain/user/entities/UserSession');

/**
 * MySQL Session Repository Adapter
 * Implements SessionRepositoryPort using MySQL/Sequelize
 */
class SessionMySQLAdapter extends SessionRepositoryPort {
  constructor(sequelize, models, encryptionService) {
    super();
    this.sequelize = sequelize;
    this.UserSessionModel = models.UserSession;
    this.encryptionService = encryptionService;
  }

  async findBySessionId(sessionId) {
    const sessionData = await this.UserSessionModel.findOne({
      where: { 
        session_id: sessionId,
        is_active: true 
      }
    });

    if (!sessionData) return null;

    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptSessionData(sessionData.toJSON());
    
    return UserSession.fromPersistence(decryptedData);
  }

  async findByRefreshToken(refreshToken) {
    const refreshTokenHash = this.encryptionService.hash(refreshToken);
    
    const sessionData = await this.UserSessionModel.findOne({
      where: { 
        refresh_token: refreshTokenHash,
        is_active: true 
      }
    });

    if (!sessionData) return null;

    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptSessionData(sessionData.toJSON());
    
    return UserSession.fromPersistence(decryptedData);
  }

  async findActiveByUserId(userId) {
    // First mark expired sessions as inactive
    await this._markExpiredAsInactive(userId);

    const sessionsData = await this.UserSessionModel.findAll({
      where: {
        user_id: userId,
        is_active: true
      },
      order: [['created_at', 'DESC']]
    });

    const sessions = [];
    for (const sessionData of sessionsData) {
      const decryptedData = await this.encryptionService.decryptSessionData(sessionData.toJSON());
      sessions.push(UserSession.fromPersistence(decryptedData));
    }

    return sessions;
  }

  async findByDeviceId(userId, deviceId) {
    const sessionsData = await this.UserSessionModel.findAll({
      where: {
        user_id: userId,
        is_active: true
      }
    });

    const sessions = [];
    for (const sessionData of sessionsData) {
      const decryptedData = await this.encryptionService.decryptSessionData(sessionData.toJSON());
      const session = UserSession.fromPersistence(decryptedData);
      
      if (session.isSameDevice(deviceId)) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async save(session) {
    if (session.id) {
      return await this.update(session);
    } else {
      return await this.create(session);
    }
  }

  async create(session) {
    // Encrypt sensitive data
    const encryptedData = await this.encryptionService.encryptSessionData(
      session.toPersistence()
    );

    const createdSession = await this.UserSessionModel.create(encryptedData);
    
    // Return updated session entity with ID
    session.id = createdSession.id;
    return session;
  }

  async update(session) {
    // Encrypt sensitive data
    const encryptedData = await this.encryptionService.encryptSessionData(
      session.toPersistence()
    );

    await this.UserSessionModel.update(encryptedData, {
      where: { id: session.id }
    });

    return session;
  }

  async revoke(sessionId) {
    const result = await this.UserSessionModel.update(
      { 
        is_active: false, 
        revoked_at: new Date() 
      },
      { 
        where: { session_id: sessionId } 
      }
    );

    return result[0] > 0;
  }

  async revokeAllForUser(userId, excludeSessionId = null) {
    const whereClause = {
      user_id: userId,
      is_active: true
    };

    if (excludeSessionId) {
      whereClause.session_id = {
        [this.sequelize.Op.ne]: excludeSessionId
      };
    }

    const result = await this.UserSessionModel.update(
      { 
        is_active: false, 
        revoked_at: new Date() 
      },
      { where: whereClause }
    );

    return result[0];
  }

  async cleanupExpired() {
    const result = await this.UserSessionModel.destroy({
      where: {
        [this.sequelize.Op.or]: [
          { 
            expires_at: { [this.sequelize.Op.lt]: new Date() },
            is_active: false 
          },
          { 
            revoked_at: { [this.sequelize.Op.ne]: null } 
          }
        ]
      }
    });

    return result;
  }

  async countActiveForUser(userId) {
    return await this.UserSessionModel.count({
      where: {
        user_id: userId,
        is_active: true,
        expires_at: { [this.sequelize.Op.gt]: new Date() }
      }
    });
  }

  // Private helper methods
  async _markExpiredAsInactive(userId = null) {
    const whereClause = {
      is_active: true,
      expires_at: { [this.sequelize.Op.lt]: new Date() }
    };

    if (userId) {
      whereClause.user_id = userId;
    }

    return await this.UserSessionModel.update(
      { is_active: false },
      { where: whereClause }
    );
  }
}

module.exports = SessionMySQLAdapter;
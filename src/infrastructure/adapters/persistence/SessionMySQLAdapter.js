const SessionRepository = require('../../../core/domain/user/contracts/SessionRepository');
const UserSession = require('../../../core/domain/user/entities/UserSession');

/**
 * MySQL Session Repository Adapter
 * Implements SessionRepository contract using MySQL/Sequelize
 */
class SessionMySQLAdapter extends SessionRepository {
  constructor(sequelize, models, encryptionService) {
    super();
    this.sequelize = sequelize;
    this.UserSessionModel = models.UserSession;
    this.encryptionService = encryptionService;
  }

  async findById(id) {
    const sessionData = await this.UserSessionModel.findByPk(id);
    if (!sessionData) return null;

    return await this._toDomainEntity(sessionData);
  }

  async findBySessionId(sessionId) {
    const sessionData = await this.UserSessionModel.findOne({
      where: { 
        session_id: sessionId,
        is_active: true 
      }
    });

    if (!sessionData) return null;

    return await this._toDomainEntity(sessionData);
  }

  async findByRefreshToken(refreshTokenHash) {
    const sessionData = await this.UserSessionModel.findOne({
      where: { 
        refresh_token: refreshTokenHash,
        is_active: true 
      }
    });

    if (!sessionData) return null;

    return await this._toDomainEntity(sessionData);
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
      sessions.push(await this._toDomainEntity(sessionData));
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
      const session = await this._toDomainEntity(sessionData);
      
      if (session.isSameDevice(deviceId)) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async save(session) {
    if (session.id) {
      return await this._update(session);
    } else {
      return await this._create(session);
    }
  }

  async delete(id) {
    const result = await this.UserSessionModel.destroy({
      where: { id }
    });

    return result > 0;
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

  async findWithFilters(filters, options = {}) {
    const { userId, isActive } = filters;
    const { limit = 50, offset = 0 } = options;

    const whereClause = {};
    if (userId) whereClause.user_id = userId;
    if (isActive !== undefined) whereClause.is_active = isActive;

    const { count, rows } = await this.UserSessionModel.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    const sessions = [];
    for (const sessionData of rows) {
      sessions.push(await this._toDomainEntity(sessionData));
    }

    return { entities: sessions, total: count };
  }

  async beginTransaction() {
    return await this.sequelize.transaction();
  }

  async commitTransaction(transaction) {
    return await transaction.commit();
  }

  async rollbackTransaction(transaction) {
    return await transaction.rollback();
  }

  // Private helper methods
  async _create(session) {
    // Encrypt sensitive data
    const encryptedData = await this.encryptionService.encryptUserData(
      session.toPersistence()
    );

    const createdSession = await this.UserSessionModel.create(encryptedData);
    
    // Return updated session entity with ID
    session.id = createdSession.id;
    return session;
  }

  async _update(session) {
    // Encrypt sensitive data
    const encryptedData = await this.encryptionService.encryptUserData(
      session.toPersistence()
    );

    await this.UserSessionModel.update(encryptedData, {
      where: { id: session.id }
    });

    return session;
  }

  async _toDomainEntity(sessionData) {
    // Decrypt sensitive data
    const decryptedData = await this.encryptionService.decryptUserData(
      sessionData.toJSON()
    );
    
    return UserSession.fromPersistence(decryptedData);
  }

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
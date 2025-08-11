const { UserSession } = require('../models');
const { User } = require('../models');
const logger = require('../utils/logger.util');
const jwtUtil = require('../utils/jwt.util');
const { AuthError } = require('../errors/authError');
const { AppError } = require('../errors/AppError');
const securityConfig = require('../config/security.config');

/**
 * Session Service
 * Handles Redis session management, device tracking, and session cleanup
 */
class SessionService {
  constructor() {
    this.maxActiveSessionsPerUser = securityConfig.app.maxActiveSessionsPerUser;
    this.sessionCleanupInterval = securityConfig.app.sessionCleanupInterval;
  }

  /**
   * Create new user session
   */
  async createSession(userId, deviceInfo, ipAddress, userAgent, location = null) {
    try {
      // Check and cleanup existing sessions if limit exceeded
      await this.enforceSessionLimit(userId);

      // Calculate expiry time (7 days)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Generate refresh token
      const refreshToken = jwtUtil.generateRefreshToken({
        userId,
        sessionId: null, // Will be set after session creation
        deviceId: deviceInfo.device_id,
        roles: ['user'],
        permissions: []
      });

      // Create session record
      const session = await UserSession.create({
        user_id: userId,
        refresh_token: refreshToken,
        device_info: deviceInfo,
        ip_address: ipAddress,
        user_agent: userAgent,
        location: location,
        expires_at: expiresAt
      });

      // Update refresh token with session ID
      const updatedRefreshToken = jwtUtil.generateRefreshToken({
        userId,
        sessionId: session.session_id,
        deviceId: deviceInfo.device_id,
        roles: ['user'],
        permissions: []
      });

      session.refresh_token = updatedRefreshToken;
      await session.save();

      logger.info('Session created', {
        userId,
        sessionId: session.session_id,
        deviceId: deviceInfo.device_id,
        ipAddress,
        expiresAt
      });

      return session;
    } catch (error) {
      logger.error('Failed to create session', {
        userId,
        deviceInfo,
        error: error.message,
        stack: error.stack
      });
      throw new AppError('Failed to create session', 500, 'SESSION_CREATE_ERROR');
    }
  }

  /**
   * Get session by session ID
   */
  async getSession(sessionId) {
    try {
      const session = await UserSession.findBySessionId(sessionId);

      if (!session) {
        throw AuthError.sessionNotFound('Session not found');
      }

      if (!session.isValid()) {
        if (session.isExpired()) {
          throw AuthError.sessionExpired('Session has expired');
        }
        if (session.isRevoked()) {
          throw AuthError.sessionNotFound('Session has been revoked');
        }
        throw AuthError.sessionNotFound('Session is not valid');
      }

      return session;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error('Failed to get session', {
        sessionId,
        error: error.message
      });
      throw new AppError('Failed to get session', 500, 'SESSION_GET_ERROR');
    }
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(refreshToken) {
    try {
      const session = await UserSession.findByRefreshToken(refreshToken);

      if (!session) {
        throw AuthError.sessionNotFound('Session not found');
      }

      if (!session.isValid()) {
        if (session.isExpired()) {
          throw AuthError.sessionExpired('Session has expired');
        }
        if (session.isRevoked()) {
          throw AuthError.sessionNotFound('Session has been revoked');
        }
        throw AuthError.sessionNotFound('Session is not valid');
      }

      return session;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error('Failed to get session by refresh token', {
        error: error.message
      });
      throw new AppError('Failed to get session', 500, 'SESSION_GET_ERROR');
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const sessions = await UserSession.findActiveByUserId(userId);

      // Filter out expired sessions and mark them as inactive
      const validSessions = [];
      for (const session of sessions) {
        if (session.isValid()) {
          validSessions.push(session);
        } else if (session.isExpired()) {
          await session.revoke();
        }
      }

      return validSessions;
    } catch (error) {
      logger.error('Failed to get user sessions', {
        userId,
        error: error.message
      });
      throw new AppError('Failed to get user sessions', 500, 'SESSION_GET_ERROR');
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId, ipAddress = null, userAgent = null) {
    try {
      const session = await this.getSession(sessionId);

      if (ipAddress) {
        session.ip_address = ipAddress;
      }

      if (userAgent) {
        session.user_agent = userAgent;
      }

      // Update the updated_at timestamp
      session.changed('updated_at', true);
      await session.save();

      logger.debug('Session activity updated', {
        sessionId,
        userId: session.user_id,
        ipAddress,
        userAgent
      });

      return session;
    } catch (error) {
      logger.error('Failed to update session activity', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId, userId = null, password = null) {
    try {
      const session = await UserSession.findBySessionId(sessionId);

      if (!session) {
        throw AuthError.sessionNotFound('Session not found');
      }

      // Verify user ownership if userId provided
      if (userId && session.user_id !== userId) {
        throw AuthError.forbidden('Cannot revoke session of another user');
      }

      // Verify password if provided
      if (password && userId) {
        const user = await User.findByPk(userId);
        if (!user) {
          throw AuthError.unauthorized('User not found');
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          throw AuthError.invalidCredentials('Invalid password');
        }
      }

      await session.revoke();

      logger.info('Session revoked', {
        sessionId,
        userId: session.user_id,
        deviceId: session.device_info?.device_id
      });

      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error('Failed to revoke session', {
        sessionId,
        userId,
        error: error.message
      });
      throw new AppError('Failed to revoke session', 500, 'SESSION_REVOKE_ERROR');
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId, password = null, excludeSessionId = null) {
    try {
      // Verify password if provided
      if (password) {
        const user = await User.findByPk(userId);
        if (!user) {
          throw AuthError.unauthorized('User not found');
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          throw AuthError.invalidCredentials('Invalid password');
        }
      }

      const sessions = await UserSession.findActiveByUserId(userId);

      let revokedCount = 0;
      for (const session of sessions) {
        if (excludeSessionId && session.session_id === excludeSessionId) {
          continue; // Skip the excluded session
        }

        await session.revoke();
        revokedCount++;
      }

      logger.info('All user sessions revoked', {
        userId,
        revokedCount,
        excludeSessionId
      });

      return revokedCount;
    } catch (error) {
      logger.error('Failed to revoke all user sessions', {
        userId,
        error: error.message
      });
      throw new AppError('Failed to revoke user sessions', 500, 'SESSION_REVOKE_ERROR');
    }
  }

  /**
   * Enforce session limit per user
   */
  async enforceSessionLimit(userId) {
    try {
      const activeSessions = await UserSession.findActiveByUserId(userId);

      if (activeSessions.length >= this.maxActiveSessionsPerUser) {
        // Sort by created_at to find oldest sessions
        activeSessions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Revoke oldest sessions to make room for new one
        const sessionsToRevoke = activeSessions.slice(0, activeSessions.length - this.maxActiveSessionsPerUser + 1);

        for (const session of sessionsToRevoke) {
          await session.revoke();
          logger.info('Session revoked due to limit', {
            sessionId: session.session_id,
            userId,
            deviceId: session.device_info?.device_id
          });
        }
      }
    } catch (error) {
      logger.error('Failed to enforce session limit', {
        userId,
        error: error.message
      });
      // Don't throw error here, just log it
    }
  }

  /**
   * Refresh session with new tokens
   */
  async refreshSession(refreshToken) {
    try {
      // Verify refresh token
      const payload = jwtUtil.verifyRefreshToken(refreshToken);

      // Get session
      const session = await this.getSessionByRefreshToken(refreshToken);

      // Generate new tokens
      const newRefreshToken = jwtUtil.generateRefreshToken({
        userId: payload.userId,
        sessionId: session.session_id,
        deviceId: payload.deviceId,
        roles: payload.roles || ['user'],
        permissions: payload.permissions || []
      });

      // Update session with new refresh token
      session.refresh_token = newRefreshToken;
      await session.save();

      logger.info('Session refreshed', {
        sessionId: session.session_id,
        userId: payload.userId,
        deviceId: payload.deviceId
      });

      return {
        session,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error('Failed to refresh session', {
        error: error.message
      });
      throw AuthError.tokenRefreshFailed('Failed to refresh session');
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const cleanedCount = await UserSession.cleanupExpired();

      logger.info('Expired sessions cleaned up', {
        cleanedCount
      });

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: error.message
      });
      throw new AppError('Failed to cleanup sessions', 500, 'SESSION_CLEANUP_ERROR');
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(userId = null) {
    try {
      const where = {};
      if (userId) {
        where.user_id = userId;
      }

      const stats = await UserSession.findAll({
        where,
        attributes: [
          [require('sequelize').fn('COUNT', '*'), 'total_sessions'],
          [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_active = true THEN 1 ELSE 0 END')), 'active_sessions'],
          [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END')), 'expired_sessions'],
          [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END')), 'revoked_sessions']
        ],
        raw: true
      });

      return stats[0] || {
        total_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        revoked_sessions: 0
      };
    } catch (error) {
      logger.error('Failed to get session statistics', {
        userId,
        error: error.message
      });
      throw new AppError('Failed to get session statistics', 500, 'SESSION_STATS_ERROR');
    }
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId, deviceId) {
    try {
      const recentSessions = await UserSession.findAll({
        where: {
          user_id: userId,
          is_active: true
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });

      // Check if device has been used recently
      const deviceSessions = recentSessions.filter(session =>
        session.device_info?.device_id === deviceId
      );

      // Device is trusted if it has been used in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentDeviceSessions = deviceSessions.filter(session =>
        new Date(session.created_at) > thirtyDaysAgo
      );

      return recentDeviceSessions.length > 0;
    } catch (error) {
      logger.error('Failed to check device trust', {
        userId,
        deviceId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get device sessions
   */
  async getDeviceSessions(userId, deviceId) {
    try {
      const sessions = await UserSession.findAll({
        where: {
          user_id: userId,
          is_active: true
        },
        order: [['created_at', 'DESC']]
      });

      return sessions.filter(session =>
        session.device_info?.device_id === deviceId
      );
    } catch (error) {
      logger.error('Failed to get device sessions', {
        userId,
        deviceId,
        error: error.message
      });
      throw new AppError('Failed to get device sessions', 500, 'SESSION_GET_ERROR');
    }
  }
}

module.exports = new SessionService();
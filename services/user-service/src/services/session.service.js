const { UserSession, User } = require("../models");
const logger = require("../../../../shared/utils/logger.util");
const jwtUtil = require("../utils/jwt.util");
const { AuthError } = require("../../../../shared/errors/authError");
const { AppError } = require("../../../../shared/errors/appError");
const securityConfig = require("../config/security.config");
const encryptionService = require("./encryption.service");
const { sequelize } = require("../models");
const { v4: uuidv4 } = require("uuid");

/**
 * Session Service
 * Handles Redis session management, device tracking
 */
class SessionService {
  constructor() {
    this.maxActiveSessionsPerUser =
      securityConfig.session.maxActiveSessionsPerUser;
  }

  /**
   * Create new user session
   */
  async createSession(
    userId,
    deviceInfo,
    ipAddress,
    userAgent,
    transaction = null,
    location = null
  ) {
    if (!deviceInfo || !deviceInfo.device_id) {
      throw new AppError("Invalid device info", 400, "INVALID_DEVICE_INFO");
    }

    const t = transaction || (await sequelize.transaction());
    try {
      // Revoke existing sessions for the same device
      const existingSessionsForDevice =
        await UserSession.findActiveSessionsByDevice(
          userId,
          deviceInfo.device_id,
          t
        );

      for (const session of existingSessionsForDevice) {
        await session.revoke(t);
        logger.info("Revoked existing session for device", {
          sessionId: session.session_id,
          deviceId: deviceInfo.device_id,
        });
      }

      // Enforce session limit
      await this.enforceSessionLimit(userId, t);

      // Pre-generate session_id (UUID)
      const sessionId = uuidv4();

      const tokens = jwtUtil.generateTokenPair({
        userId,
        sessionId,
        deviceId: deviceInfo.device_id,
      });

      const refreshTokenHash = await encryptionService.hashData(
        tokens.refresh_token
      );

      // Create session in DB
      await UserSession.create(
        {
          session_id: sessionId,
          user_id: userId,
          refresh_token: refreshTokenHash,
          device_info: deviceInfo,
          ip_address: ipAddress,
          user_agent: userAgent,
          location,
          refresh_issued_at: tokens.issued_at,
          expires_at: tokens.refresh_expires_at,
          is_active: true,
          last_active_at: new Date(),
        },
        { transaction: t }
      );

      if (!transaction) await t.commit();

      logger.info("Session created", {
        userId,
        sessionId,
        deviceId: deviceInfo.device_id,
      });

      return {
        ...tokens,
        session_id: sessionId,
        user_id: userId,
        device_info: deviceInfo,
        ip_address: ipAddress,
        user_agent: userAgent,
        location,
      };
    } catch (error) {
      if (!transaction) await t.rollback();
      logger.error("Failed to create session", {
        userId,
        error: error.message,
      });
      throw new AppError(
        "Failed to create session",
        500,
        "SESSION_CREATE_ERROR"
      );
    }
  }

  /**
   * Get session by session ID
   */
  async getSession(sessionId) {
    try {
      const session = await UserSession.findBySessionId(sessionId);

      if (!session) {
        throw AuthError.sessionNotFound("Session not found");
      }

      if (!session.isValid()) {
        if (session.isExpired()) {
          throw AuthError.sessionExpired("Session has expired");
        }
        if (session.isRevoked()) {
          throw AuthError.sessionNotFound("Session has been revoked");
        }
        throw AuthError.sessionNotFound("Session is not valid");
      }

      return session;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error("Failed to get session", {
        sessionId,
        error: error.message,
      });
      throw new AppError("Failed to get session", 500, "SESSION_GET_ERROR");
    }
  }

  /**
   * Get session by refresh token
   */
  async getSessionByRefreshToken(refreshToken) {
    try {
      const refreshTokenHash = await encryptionService.hashData(refreshToken);
      const session = await UserSession.findByRefreshToken(refreshTokenHash);

      if (!session) {
        throw AuthError.sessionNotFound("Session not found");
      }

      if (!session.isValid()) {
        if (session.isExpired()) {
          throw AuthError.sessionExpired("Session has expired");
        }
        if (session.isRevoked()) {
          throw AuthError.sessionNotFound("Session has been revoked");
        }
        throw AuthError.sessionNotFound("Session is not valid");
      }

      return session;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error("Failed to get session by refresh token", {
        error: error.message,
      });
      throw new AppError("Failed to get session", 500, "SESSION_GET_ERROR");
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const sessions = await UserSession.findActiveSessionsAllByUserId(userId);

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
      logger.error("Failed to get user sessions", {
        userId,
        error: error.message,
      });
      throw new AppError(
        "Failed to get user sessions",
        500,
        "SESSION_GET_ERROR"
      );
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId, userId = null, password = null) {
    try {
      const session = await UserSession.findBySessionId(sessionId);

      if (!session) {
        throw AuthError.sessionNotFound(`Session not found ${sessionId}`);
      }

      // Verify user ownership if userId provided
      if (userId && session.user_id !== userId) {
        throw AuthError.forbidden("Cannot revoke session of another user");
      }

      // Verify password if provided
      if (password && userId) {
        const user = await User.findByPk(userId);
        if (!user) {
          throw AuthError.unauthorized("User not found");
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          throw AuthError.invalidCredentials("Invalid password");
        }
      }

      await session.revoke();

      logger.info("Session revoked", {
        sessionId,
        userId: session.user_id,
        deviceId: session.device_info?.device_id,
      });

      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      logger.error("Failed to revoke session", {
        sessionId,
        userId,
        error: error.message,
      });
      throw new AppError(
        "Failed to revoke session",
        500,
        "SESSION_REVOKE_ERROR"
      );
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(
    userId,
    password = null,
    excludeSessionId = null,
    transaction = null
  ) {
    const t = transaction || (await sequelize.transaction());
    try {
      // Verify password if provided
      if (password) {
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
          throw AuthError.unauthorized("User not found");
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          throw AuthError.invalidCredentials("Invalid password");
        }
      }

      const sessions = await UserSession.findActiveSessionsAllByUserId(
        userId,
        t
      );

      // 3. Filter out the session to exclude, if any
      const sessionsToRevoke = excludeSessionId
        ? sessions.filter((s) => s.session_id !== excludeSessionId)
        : sessions;

      // 4. Bulk revoke all remaining sessions
      if (sessionsToRevoke.length > 0) {
        const idsToRevoke = sessionsToRevoke.map((s) => s.id);
        await UserSession.update(
          { is_active: false, revoked_at: new Date() },
          { where: { id: idsToRevoke }, transaction: t }
        );
      }

      const revokedCount = sessionsToRevoke.length;

      logger.info("All user sessions revoked", {
        userId,
        revokedCount,
        excludeSessionId,
      });

      if (!transaction) await t.commit();

      return revokedCount;
    } catch (error) {
      if (!transaction) await t.rollback();
      logger.error("Failed to revoke all user sessions", {
        userId,
        error: error.message,
      });
      throw new AppError(
        "Failed to revoke user sessions",
        500,
        "SESSION_REVOKE_ERROR"
      );
    }
  }

  /**
   * Enforce session limit per user (if exceeded limit, revoke oldest session)
   */
  async enforceSessionLimit(userId, transaction) {
    try {
      const activeSessions = await UserSession.findActiveSessionsAllByUserId(
        userId
      );

      if (activeSessions.length >= this.maxActiveSessionsPerUser) {
        // Sort by refresh_issued_at to find oldest sessions
        activeSessions.sort(
          (a, b) =>
            new Date(a.refresh_issued_at) - new Date(b.refresh_issued_at)
        );

        // Revoke oldest sessions to make room for new one
        const sessionsToRevoke = activeSessions.slice(
          0,
          activeSessions.length - this.maxActiveSessionsPerUser + 1
        );

        for (const session of sessionsToRevoke) {
          await session.revoke({ transaction });
          logger.info("Session revoked due to limit", {
            sessionId: session.session_id,
            userId,
            deviceId: session.device_info?.device_id,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to enforce session limit", {
        userId,
        error: error.message,
      });
      // Don't throw error here, just log it
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

      // Update the last_active_at timestamp
      session.last_active_at = new Date();
      await session.save();

      logger.debug("Session activity updated", {
        sessionId,
        userId: session.user_id,
        ipAddress,
        userAgent,
      });

      return session;
    } catch (error) {
      logger.error("Failed to update session activity", {
        sessionId,
        error: error.message,
      });
      throw error;
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
          is_active: true,
        },
        order: [["created_at", "DESC"]],
        limit: 10,
      });

      // Check if device has been used recently
      const deviceSessions = recentSessions.filter(
        (session) => session.device_info?.device_id === deviceId
      );

      // Device is trusted if it has been used in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentDeviceSessions = deviceSessions.filter(
        (session) => new Date(session.refresh_issued_at) > thirtyDaysAgo
      );

      return recentDeviceSessions.length > 0;
    } catch (error) {
      logger.error("Failed to check device trust", {
        userId,
        deviceId,
        error: error.message,
      });
      return false;
    }
  }
}

module.exports = new SessionService();

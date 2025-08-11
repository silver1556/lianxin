const express = require('express');
const sessionService = require('../services/session.service');
const validationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');
const apiResponse = require('../../../shared/utils/api.response');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');

const router = express.Router();

/**
 * Get Active Sessions
 * GET /api/v1/user/sessions
 */
router.get('/sessions',
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const currentSessionId = req.user.sessionId;

      const sessions = await sessionService.getUserSessions(userId);

      // Mark current session and sanitize data
      const sanitizedSessions = sessions.map(session => {
        const sessionData = session.toSafeObject();
        sessionData.is_current = session.session_id === currentSessionId;
        sessionData.last_active = session.updated_at || session.created_at;
        return sessionData;
      });

      logger.info('User sessions retrieved', {
        userId,
        sessionCount: sanitizedSessions.length,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success({ sessions: sanitizedSessions }, 'Active sessions retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Revoke Specific Session
 * DELETE /api/v1/user/sessions/:sessionId
 */
router.delete('/sessions/:sessionId',
  authMiddleware.authenticate,
  rateLimitMiddleware.sessionRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;

      // Use validation utility
      const revocationData = validationUtil.validateSessionRevocation(req.body);

      await sessionService.revokeSession(sessionId, userId, revocationData.password);

      logger.info('Session revoked successfully', {
        userId,
        revokedSessionId: sessionId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, 'Session revoked successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Revoke All Other Sessions
 * POST /api/v1/user/sessions/revoke-all
 */
router.post('/sessions/revoke-all',
  authMiddleware.authenticate,
  rateLimitMiddleware.sessionRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const currentSessionId = req.user.sessionId;

      // Use validation utility
      const revocationData = validationUtil.validateSessionRevocation(req.body);

      const revokedCount = await sessionService.revokeAllUserSessions(userId, revocationData.password, currentSessionId);

      logger.info('All other sessions revoked', {
        userId,
        revokedCount,
        currentSessionId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(
        { revoked_sessions: revokedCount },
        `${revokedCount} sessions revoked successfully`,
        req.requestId
      ));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Session Statistics
 * GET /api/v1/user/sessions/stats
 */
router.get('/sessions/stats',
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const stats = await sessionService.getSessionStats(userId);

      logger.debug('Session statistics retrieved', {
        userId,
        stats,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success({ stats }, 'Session statistics retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Check Device Trust Status
 * GET /api/v1/user/sessions/device-trust/:deviceId
 */
router.get('/sessions/device-trust/:deviceId',
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { deviceId } = req.params;

      const isTrusted = await sessionService.isDeviceTrusted(userId, deviceId);

      logger.debug('Device trust status checked', {
        userId,
        deviceId,
        isTrusted,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(
        { device_id: deviceId, is_trusted: isTrusted },
        'Device trust status retrieved',
        req.requestId
      ));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Device Sessions
 * GET /api/v1/user/sessions/device/:deviceId
 */
router.get('/sessions/device/:deviceId',
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { deviceId } = req.params;

      const sessions = await sessionService.getDeviceSessions(userId, deviceId);

      const sanitizedSessions = sessions.map(session => session.toSafeObject());

      logger.debug('Device sessions retrieved', {
        userId,
        deviceId,
        sessionCount: sanitizedSessions.length,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(
        { device_id: deviceId, sessions: sanitizedSessions },
        'Device sessions retrieved successfully',
        req.requestId
      ));
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
const sessionService = require("../services/session.service");
const validationUtil = require("../utils/validation.util");
const logger = require("../../../../shared/utils/logger.util");
const apiResponse = require("../../../../shared/utils/api.response");

/**
 * Get Active Sessions (protected)
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const currentSessionId = req.user.sessionId;

    const sessions = await sessionService.getUserSessions(userId);

    // Mark current session and sanitize data
    const sanitizedSessions = sessions.map((session) => {
      const sessionData = session.toSafeObject();
      sessionData.is_current = session.session_id === currentSessionId;
      sessionData.last_active = session.last_active_at || session.created_at;
      return sessionData;
    });

    logger.info("User sessions retrieved", {
      userId,
      sessionCount: sanitizedSessions.length,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { sessions: sanitizedSessions },
          "Active sessions retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke Specific Session (protected)
 */
const revokeSessionById = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    // Use validation utility (undefined if body is empty)
    const revocationData = validationUtil.validateSessionRevocation(req.body);

    await sessionService.revokeSession(
      sessionId,
      userId,
      revocationData.password
    );

    logger.info("Session revoked successfully", {
      userId,
      revokedSessionId: sessionId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(null, "Session revoked successfully", req.requestId)
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke All Other Sessions except for current one (protected)
 */
const revokeUserAllSessions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const currentSessionId = req.user.sessionId;

    // Use validation utility (undefined if body is empty)
    const revocationData = validationUtil.validateSessionRevocation(req.body);

    const revokedCount = await sessionService.revokeAllUserSessions(
      userId,
      revocationData.password,
      currentSessionId
    );

    logger.info("All other sessions revoked", {
      userId,
      revokedCount,
      currentSessionId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { revoked_sessions: revokedCount },
          `${revokedCount} sessions revoked successfully`,
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Check Device Trust Status
 */
const checkDeviceTrust = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { deviceId } = req.params;

    const isTrusted = await sessionService.isDeviceTrusted(userId, deviceId);

    logger.debug("Device trust status checked", {
      userId,
      deviceId,
      isTrusted,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { device_id: deviceId, is_trusted: isTrusted },
          "Device trust status retrieved",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveSessions,
  revokeSessionById,
  revokeUserAllSessions,
  checkDeviceTrust,
};

const express = require("express");

// Controller import
const sessionController = require("../controllers/session.controller");

// Middleware imports
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

/**
 * Get Active Sessions (protected)
 * GET /api/v1/user/sessions
 */
router.get(
  "/sessions",
  authMiddleware.authenticate,
  sessionController.getActiveSessions
);

/**
 * Revoke Specific Session (protected)
 * DELETE /api/v1/user/sessions/:sessionId/revoke
 */
router.delete(
  "/sessions/:sessionId/revoke",
  authMiddleware.authenticate,
  sessionController.revokeSessionById
);

/**
 * Revoke All Other Sessions except for current one (protected)
 * DELETE /api/v1/user/sessions
 */
router.delete(
  "/sessions",
  authMiddleware.authenticate,
  sessionController.revokeUserAllSessions
);

/**
 * Check Device Trust Status
 * GET /api/v1/user/sessions/device-trust/:deviceId
 */
router.get(
  "/sessions/device-trust/:deviceId",
  sessionController.checkDeviceTrust
);

module.exports = router;

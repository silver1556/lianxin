const express = require("express");
const { query } = require("express-validator");

// Controller import
const complianceController = require("../controllers/admin/compliance.controller");

// Middleware imports
const authMiddleware = require("../middlewares/auth.middleware.js");
const auditMiddleware = require("../middlewares/audit.middleware");

const router = express.Router();

// Validation rules
const validationRules = {
  getAuditLogs: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("user_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("User ID must be a positive integer"),
    query("action")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Action must be 1-100 characters"),
    query("resource")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Resource must be 1-100 characters"),
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO date"),
  ],

  getUserAuditTrail: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("action")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Action must be 1-100 characters"),
  ],

  generateComplianceReport: [
    query("report_type")
      .isIn(["pipl", "cybersecurity_law", "data_security", "full"])
      .withMessage("Invalid report type"),
    query("start_date")
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    query("end_date")
      .isISO8601()
      .withMessage("End date must be a valid ISO date"),
    query("format")
      .optional()
      .isIn(["json", "csv", "pdf"])
      .withMessage("Invalid format"),
  ],

  requestDataExport: [
    query("format")
      .optional()
      .isIn(["json", "csv"])
      .withMessage("Invalid format"),
    query("include_deleted")
      .optional()
      .isBoolean()
      .withMessage("Include deleted must be boolean"),
  ],

  getComplianceStats: [
    query("period")
      .optional()
      .isIn(["24h", "7d", "30d", "90d"])
      .withMessage("Invalid period"),
  ],

  getSecurityEvents: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("severity")
      .optional()
      .isIn(["low", "medium", "high", "critical"])
      .withMessage("Invalid severity"),
    query("event_type")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Event type must be 1-100 characters"),
  ],
};

/**
 * Get Audit Logs (Admin)
 * GET /api/v1/admin/audit-logs
 */
router.get(
  "/audit-logs",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.getAuditLogs,
  complianceController.getAuditLogs
);

/**
 * Get User Audit Trail (Admin)
 * GET /api/v1/admin/users/:userId/audit
 */
router.get(
  "/users/:userId/audit",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.getUserAuditTrail,
  complianceController.getUserAuditTrail
);

/**
 * Generate Compliance Report (Admin)
 * POST /api/v1/admin/compliance/report
 */
router.post(
  "/compliance/report",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.generateComplianceReport,
  complianceController.generateComplianceReport
);

/**
 * Get Data Export Request (Admin)
 * GET /api/v1/admin/users/:userId/data-export
 */
router.get(
  "/users/:userId/data-export",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.requestDataExport,
  complianceController.requestDataExport
);

/**
 * Get Compliance Statistics (Admin)
 * GET /api/v1/admin/compliance/stats
 */
router.get(
  "/compliance/stats",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  validationRules.getComplianceStats,
  complianceController.getComplianceStats
);

/**
 * Get Security Events (Admin)
 * GET /api/v1/admin/security/events
 */
router.get(
  "/security/events",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.getSecurityEvents,
  complianceController.getSecurityEvents
);

module.exports = router;

const express = require("express");
const { body, query } = require("express-validator");

// Controller import
const adminController = require("../controllers/admin/admin.controller");

// Middleware imports
const authMiddleware = require("../middlewares/auth.middleware.js");
const auditMiddleware = require("../middlewares/audit.middleware");

const router = express.Router();

// Validation rules
const validationRules = {
  suspendUser: [
    body("reason").notEmpty().withMessage("Suspension reason is required"),
    body("duration")
      .isInt({ min: 1, max: 365 })
      .withMessage("Duration must be between 1 and 365 days"),
    body("admin_note")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Admin note must not exceed 1000 characters"),
  ],

  getUsersList: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["active", "deactivated", "pending_deletion", "suspended"])
      .withMessage("Invalid status"),
    query("search")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be 1-100 characters"),
  ],

  unsuspendUser: [
    body("admin_note")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Admin note must not exceed 1000 characters"),
  ],

  verifyUser: [
    body("verification_type")
      .isIn(["government_id", "manual"])
      .withMessage("Invalid verification type"),
    body("verification_data")
      .isObject()
      .withMessage("Verification data must be an object"),
    body("admin_note")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Admin note must not exceed 1000 characters"),
  ],

  searchUsers: [
    query("q").notEmpty().withMessage("Search query is required"),
    query("type")
      .optional()
      .isIn(["phone", "name", "id"])
      .withMessage("Invalid search type"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
};

/**
 * Get User List (Admin)
 * GET /api/v1/admin/users
 */
router.get(
  "/users",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.getUsersList,
  adminController.getUsersList
);

/**
 * Get User Details (Admin)
 * GET /api/v1/admin/users/:userId
 */
router.get(
  "/users/:userId",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  adminController.getUserDetails
);

/**
 * Suspend User (Admin)
 * POST /api/v1/admin/users/:userId/suspend
 */
router.post(
  "/users/:userId/suspend",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.suspendUser,
  adminController.suspendUser
);

/**
 * Unsuspend User (Admin)
 * POST /api/v1/admin/users/:userId/unsuspend
 */
router.post(
  "/users/:userId/unsuspend",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.unsuspendUser,
  adminController.unsuspendUser
);

/**
 * Verify User (Admin)
 * POST /api/v1/admin/users/:userId/verify
 */
router.post(
  "/users/:userId/verify",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  auditMiddleware.logAdminAction,
  validationRules.verifyUser,
  adminController.verifyUser
);

/**
 * Get User Statistics (Admin)
 * GET /api/v1/admin/stats
 */
router.get(
  "/stats",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  adminController.getUserStats
);

/**
 * Search Users (Admin)
 * GET /api/v1/admin/users/search
 */
router.get(
  "/users/search",
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  validationRules.searchUsers,
  adminController.searchUsers
);

module.exports = router;

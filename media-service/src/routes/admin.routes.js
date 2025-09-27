const express = require("express");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

/**
 * Get Media Service Statistics
 * GET /api/v1/admin/stats
 */
router.get("/stats", adminController.getServiceStatistics);

/**
 * Get System Health
 * GET /api/v1/admin/health
 */
router.get("/health", adminController.getSystemHealth);

/**
 * Get Media Processing Queue Status
 * GET /api/v1/admin/queue
 */
router.get("/queue", adminController.getQueueStatus);

/**
 * Get ClamAV Status
 * GET /api/v1/admin/clamav/status
 */
router.get("/clamav/status", adminController.getClamavStatus);

/**
 * Update ClamAV Definitions
 * POST /api/v1/admin/clamav/update
 */
router.post("/clamav/update", adminController.updateClamavDefinition);

/**
 * Clean Up Completed Jobs
 * POST /api/v1/admin/queue/cleanup
 */
router.post("/queue/cleanup", adminController.cleanupCompletedJobs);

module.exports = router;

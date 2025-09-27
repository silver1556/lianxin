const express = require("express");
const { query, validationResult } = require("express-validator");
const adminService = require("../services/admin.service");
const queueService = require("../services/queue.service");
const clamavService = require("../services/clamav.service");
const logger = require("../../../../shared/utils/logger.util");
const { ValidationError } = require("../errors/validation.error");
const rateLimitMiddleware = require("../middleware/rate-limit.middleware");

/**
 * Get Media Service Statistics
 * GET /api/v1/admin/stats
 */
const getServiceStatistics = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;

    const stats = await adminService.getServiceStatistics();

    logger.info("Media service statistics retrieved", {
      adminUserId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: { stats },
      message: "Service statistics retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get System Health
 * GET /api/v1/admin/health
 */
const getSystemHealth = async (req, res, next) => {
  try {
    const health = await adminService.getSystemHealth();

    res.status(200).json({
      success: true,
      data: { health },
      message: "System health retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Queue Statistics
 * GET /api/v1/admin/queue/stats
 */
const getQueueStatus = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;

    const queueStats = await queueService.getQueueStats();

    logger.info("Media service queue statistics retrieved", {
      adminUserId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: { queue_stats: queueStats },
      message: "Queue statistics retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ClamAV Status
 * GET /api/v1/admin/clamav/status
 */
const getClamavStatus = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;

    const clamavStatus = await clamavService.healthCheck();
    const clamavStats = clamavService.getStats();

    logger.info("ClamAV status retrieved", {
      adminUserId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: {
        status: clamavStatus,
        stats: clamavStats,
      },
      message: "ClamAV status retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update ClamAV Definitions
 * POST /api/v1/admin/clamav/update
 */
const updateClamavDefinition = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;

    const updateResult = await clamavService.updateDefinitions();

    logger.info("ClamAV definitions update initiated", {
      adminUserId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: updateResult,
      message: "ClamAV definitions update initiated",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clean Up Completed Jobs
 * POST /api/v1/admin/queue/cleanup
 */
const cleanupCompletedJobs = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;

    const cleanedCount = await queueService.cleanupCompletedJobs();

    logger.info("Queue cleanup completed", {
      adminUserId,
      cleanedCount,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: { cleaned_jobs: cleanedCount },
      message: "Queue cleanup completed successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getServiceStatistics,
  getSystemHealth,
  getQueueStatus,
  getClamavStatus,
  updateClamavDefinition,
  cleanupCompletedJobs,
};

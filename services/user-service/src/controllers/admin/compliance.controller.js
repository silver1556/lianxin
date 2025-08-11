const express = require('express');
const { query, validationResult } = require('express-validator');
const complianceService = require('../../services/compliance.service');
const logger = require('../../utils/logger.util');
const apiResponse = require('../../../../shared/utils/api.response');
const { ValidationError } = require('../../errors/validationError');
const authMiddleware = require('../../middleware/auth.middleware');
const rateLimitMiddleware = require('../../middleware/rate-limit.middleware');
const auditMiddleware = require('../../middleware/audit.middleware');

const router = express.Router();

/**
 * Get Audit Logs (Admin)
 * GET /api/v1/admin/audit-logs
 */
router.get('/audit-logs',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('user_id').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    query('action').optional().isLength({ min: 1, max: 100 }).withMessage('Action must be 1-100 characters'),
    query('resource').optional().isLength({ min: 1, max: 100 }).withMessage('Resource must be 1-100 characters'),
    query('start_date').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
    query('end_date').optional().isISO8601().withMessage('End date must be a valid ISO date')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Audit log query validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        user_id: req.query.user_id ? parseInt(req.query.user_id) : null,
        action: req.query.action,
        resource: req.query.resource,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const result = await complianceService.getAuditLogs(filters);

      logger.info('Admin audit logs retrieved', {
        adminUserId,
        filters,
        resultCount: result.logs.length,
        totalCount: result.total_count,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Audit logs retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get User Audit Trail (Admin)
 * GET /api/v1/admin/users/:userId/audit
 */
router.get('/users/:userId/audit',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('action').optional().isLength({ min: 1, max: 100 }).withMessage('Action must be 1-100 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('User audit trail validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const { userId } = req.params;
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        action: req.query.action
      };

      const result = await complianceService.getUserAuditTrail(userId, filters);

      logger.info('User audit trail retrieved', {
        adminUserId,
        targetUserId: userId,
        filters,
        resultCount: result.logs.length,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'User audit trail retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Generate Compliance Report (Admin)
 * POST /api/v1/admin/compliance/report
 */
router.post('/compliance/report',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    query('report_type').isIn(['pipl', 'cybersecurity_law', 'data_security', 'full']).withMessage('Invalid report type'),
    query('start_date').isISO8601().withMessage('Start date must be a valid ISO date'),
    query('end_date').isISO8601().withMessage('End date must be a valid ISO date'),
    query('format').optional().isIn(['json', 'csv', 'pdf']).withMessage('Invalid format')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Compliance report validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const reportParams = {
        report_type: req.query.report_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        format: req.query.format || 'json',
        generated_by: adminUserId
      };

      const result = await complianceService.generateComplianceReport(reportParams);

      logger.info('Compliance report generated', {
        adminUserId,
        reportParams,
        reportId: result.report_id,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Compliance report generated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Data Export Request (Admin)
 * GET /api/v1/admin/users/:userId/data-export
 */
router.get('/users/:userId/data-export',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
    query('include_deleted').optional().isBoolean().withMessage('Include deleted must be boolean')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Data export validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const { userId } = req.params;
      const exportParams = {
        format: req.query.format || 'json',
        include_deleted: req.query.include_deleted === 'true',
        requested_by: adminUserId
      };

      const result = await complianceService.exportUserData(userId, exportParams);

      logger.info('User data export generated', {
        adminUserId,
        targetUserId: userId,
        exportParams,
        exportId: result.export_id,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'User data export generated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Compliance Statistics (Admin)
 * GET /api/v1/admin/compliance/stats
 */
router.get('/compliance/stats',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  [
    query('period').optional().isIn(['24h', '7d', '30d', '90d']).withMessage('Invalid period')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Compliance stats validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const period = req.query.period || '24h';

      const stats = await complianceService.getComplianceStatistics(period);

      logger.info('Compliance statistics retrieved', {
        adminUserId,
        period,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success({ stats }, 'Compliance statistics retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Security Events (Admin)
 * GET /api/v1/admin/security/events
 */
router.get('/security/events',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    query('event_type').optional().isLength({ min: 1, max: 100 }).withMessage('Event type must be 1-100 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Security events validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        severity: req.query.severity,
        event_type: req.query.event_type
      };

      const result = await complianceService.getSecurityEvents(filters);

      logger.info('Security events retrieved', {
        adminUserId,
        filters,
        resultCount: result.events.length,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Security events retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
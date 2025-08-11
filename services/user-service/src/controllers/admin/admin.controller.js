const express = require('express');
const { body, query, validationResult } = require('express-validator');
const adminService = require('../../services/admin.service');
const logger = require('../../utils/logger.util');
const apiResponse = require('../../../../shared/utils/api.response');
const { ValidationError } = require('../../errors/validationError');
const authMiddleware = require('../../middleware/auth.middleware');
const rateLimitMiddleware = require('../../middleware/rate-limit.middleware');
const auditMiddleware = require('../../middleware/audit.middleware');

const router = express.Router();

/**
 * Get User List (Admin)
 * GET /api/v1/admin/users
 */
router.get('/users',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'deactivated', 'pending_deletion', 'suspended']).withMessage('Invalid status'),
    query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search query must be 1-100 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Admin user list validation failed', 
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
        status: req.query.status,
        search: req.query.search
      };

      const result = await adminService.getUserList(filters);

      logger.info('Admin user list retrieved', {
        adminUserId,
        filters,
        resultCount: result.users.length,
        totalCount: result.total_count,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'User list retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get User Details (Admin)
 * GET /api/v1/admin/users/:userId
 */
router.get('/users/:userId',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  async (req, res, next) => {
    try {
      const adminUserId = req.user.userId;
      const { userId } = req.params;

      const user = await adminService.getUserDetails(userId);

      logger.info('Admin user details retrieved', {
        adminUserId,
        targetUserId: userId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success({ user }, 'User details retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Suspend User (Admin)
 * POST /api/v1/admin/users/:userId/suspend
 */
router.post('/users/:userId/suspend',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    body('reason').notEmpty().withMessage('Suspension reason is required'),
    body('duration').isInt({ min: 1, max: 365 }).withMessage('Duration must be between 1 and 365 days'),
    body('admin_note').optional().isLength({ max: 1000 }).withMessage('Admin note must not exceed 1000 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('User suspension validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const { userId } = req.params;
      const { reason, duration, admin_note } = req.body;

      const result = await adminService.suspendUser(userId, {
        reason,
        duration,
        admin_note,
        suspended_by: adminUserId
      });

      logger.info('User suspended by admin', {
        adminUserId,
        targetUserId: userId,
        reason,
        duration,
        suspensionUntil: result.suspension_until,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, `User ${userId} suspended until ${result.suspension_until}`, req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Unsuspend User (Admin)
 * POST /api/v1/admin/users/:userId/unsuspend
 */
router.post('/users/:userId/unsuspend',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    body('admin_note').optional().isLength({ max: 1000 }).withMessage('Admin note must not exceed 1000 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('User unsuspension validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const { userId } = req.params;
      const { admin_note } = req.body;

      await adminService.unsuspendUser(userId, {
        admin_note,
        unsuspended_by: adminUserId
      });

      logger.info('User unsuspended by admin', {
        adminUserId,
        targetUserId: userId,
        adminNote: admin_note,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, `User ${userId} has been unsuspended`, req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Verify User (Admin)
 * POST /api/v1/admin/users/:userId/verify
 */
router.post('/users/:userId/verify',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  auditMiddleware.logAdminAction,
  [
    body('verification_type').isIn(['government_id', 'manual']).withMessage('Invalid verification type'),
    body('verification_data').isObject().withMessage('Verification data must be an object'),
    body('admin_note').optional().isLength({ max: 1000 }).withMessage('Admin note must not exceed 1000 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('User verification validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const { userId } = req.params;
      const { verification_type, verification_data, admin_note } = req.body;

      await adminService.verifyUser(userId, {
        verification_type,
        verification_data,
        admin_note,
        verified_by: adminUserId
      });

      logger.info('User verified by admin', {
        adminUserId,
        targetUserId: userId,
        verificationType: verification_type,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, `User ${userId} has been verified`, req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get User Statistics (Admin)
 * GET /api/v1/admin/stats
 */
router.get('/stats',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  async (req, res, next) => {
    try {
      const adminUserId = req.user.userId;

      const stats = await adminService.getUserStatistics();

      logger.info('Admin statistics retrieved', {
        adminUserId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success({ stats }, 'User statistics retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Search Users (Admin)
 * GET /api/v1/admin/users/search
 */
router.get('/users/search',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  rateLimitMiddleware.adminRateLimit,
  [
    query('q').notEmpty().withMessage('Search query is required'),
    query('type').optional().isIn(['phone', 'name', 'id']).withMessage('Invalid search type'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Admin search validation failed', 
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const adminUserId = req.user.userId;
      const searchParams = {
        q: req.query.q,
        type: req.query.type || 'name',
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await adminService.searchUsers(searchParams);

      logger.info('Admin user search performed', {
        adminUserId,
        searchParams,
        resultCount: result.users.length,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'User search completed successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
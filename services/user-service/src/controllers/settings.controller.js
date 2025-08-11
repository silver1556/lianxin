const express = require('express');
const { body, validationResult } = require('express-validator');
const settingsService = require('../services/settings.service');
const validationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');
const apiResponse = require('../../../shared/utils/api.response');
const { ValidationError } = require('../errors/validationError');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');

const router = express.Router();

/**
 * Get User Settings
 * GET /api/v1/user/settings
 */
router.get('/settings',
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const settings = await settingsService.getUserSettings(userId);

      logger.info('User settings retrieved', {
        userId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success({ settings }, 'Settings retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update User Settings
 * PUT /api/v1/user/settings
 */
router.put('/settings',
  authMiddleware.authenticate,
  rateLimitMiddleware.settingsRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const settingsData = validationUtil.validateSettingsUpdate(req.body);

      await settingsService.updateUserSettings(userId, settingsData);

      logger.info('User settings updated', {
        userId,
        updatedCategories: Object.keys(settingsData),
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, 'Settings updated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Change Password
 * PUT /api/v1/user/password-change
 */
router.put('/password-change',
  authMiddleware.authenticate,
  rateLimitMiddleware.accountActionRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const sessionId = req.user.sessionId;
      // Use validation utility to validate password change
      const passwordData = validationUtil.validatePasswordChange(req.body);

      await settingsService.changePassword(userId, passwordData, sessionId);

      logger.info('Password changed successfully', {
        userId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, 'Password changed successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Request OTP for Phone Number Change
 * POST /api/v1/user/phone/otp
 */
router.post('/phone/otp',
  authMiddleware.authenticate,
  rateLimitMiddleware.otpRateLimit,
  [
    body('new_phone').notEmpty().withMessage('New phone number is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Validation failed',
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const userId = req.user.userId;
      const { new_phone } = req.body;
      const ipAddress = req.ip;

      const result = await settingsService.requestPhoneChangeOtp(userId, new_phone, ipAddress);

      logger.info('Phone change OTP requested', {
        userId,
        newPhone: result.new_phone,
        verificationId: result.verification_id,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'OTP sent to new phone number', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Change Phone Number
 * PUT /api/v1/user/phone-number-change
 */
router.put('/phone-number-change',
  authMiddleware.authenticate,
  rateLimitMiddleware.accountActionRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      // Use validation utility
      const phoneChangeData = validationUtil.validatePhoneChange(req.body);

      const result = await settingsService.changePhoneNumber(userId, phoneChangeData);

      logger.info('Phone number changed successfully', {
        userId,
        newPhone: result.new_phone,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Phone number updated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Deactivate Account
 * POST /api/v1/user/deactivate
 */
router.post('/deactivate',
  authMiddleware.authenticate,
  rateLimitMiddleware.accountActionRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      // Use validation utility
      const deactivationData = validationUtil.validateAccountDeactivation(req.body);

      await settingsService.deactivateAccount(userId, deactivationData.password, deactivationData.reason);

      logger.info('Account deactivated', {
        userId,
        reason: deactivationData.reason,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, 'Account successfully deactivated. You have been logged out.', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Request Account Deletion
 * POST /api/v1/user/request-deletion
 */
router.post('/request-deletion',
  authMiddleware.authenticate,
  rateLimitMiddleware.accountActionRateLimit,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      // Use validation utility
      const deletionData = validationUtil.validateAccountDeletion(req.body);

      await settingsService.requestAccountDeletion(userId, deletionData.password);

      logger.info('Account deletion requested', {
        userId,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, 'Your account is now scheduled for permanent deletion. You have 15 days to cancel this request by logging in. You have been logged out.', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
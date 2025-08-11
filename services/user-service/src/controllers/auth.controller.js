const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const otpService = require('../services/otp.service');
const validationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');
const apiResponse = require('../../../../shared/utils/api.response');
const { AuthError } = require('../errors/authError');
const { ValidationError } = require('../errors/validationError');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');

const router = express.Router();

/**
 * Request OTP for Registration
 * POST /api/v1/auth/register/otp
 */
router.post('/register/otp',
  rateLimitMiddleware.otpRateLimit,
  [
    body('phone').notEmpty().withMessage('Phone number is required')
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

      const { phone } = req.body;
      const ipAddress = req.ip;

      const result = await otpService.sendRegistrationOtp(phone, ipAddress);

      logger.info('Registration OTP requested', {
        phone: result.phone,
        verificationId: result.verification_id,
        ipAddress,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'OTP sent successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * User Registration
 * POST /api/v1/auth/register
 */
router.post('/register',
  rateLimitMiddleware.registerRateLimit,
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('verification_id').isUUID().withMessage('Valid verification ID is required'),
    body('otp_code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('agree_terms').equals('true').withMessage('You must agree to terms and conditions'),
    body('device_id').notEmpty().withMessage('Device ID is required'),
    body('device_type').isIn(['mobile', 'desktop', 'tablet']).withMessage('Invalid device type'),
    body('device_name').notEmpty().withMessage('Device name is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Registration validation failed',
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const registrationData = validationUtil.validateRegistration(req.body);
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await authService.registerUser({
        ...registrationData,
        ipAddress,
        userAgent
      });

      logger.info('User registered successfully', {
        userId: result.user.id,
        phone: result.user.phone,
        ipAddress,
        requestId: req.requestId
      });

      res.status(201).json(apiResponse.success(result, 'Registration successful', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Request OTP for Login
 * POST /api/v1/auth/login/otp
 */
router.post('/login/otp',
  rateLimitMiddleware.otpRateLimit,
  [
    body('phone').notEmpty().withMessage('Phone number is required')
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

      const { phone } = req.body;
      const ipAddress = req.ip;

      const result = await otpService.sendLoginOtp(phone, ipAddress);

      logger.info('Login OTP requested', {
        phone: result.phone,
        verificationId: result.verification_id,
        ipAddress,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'OTP sent successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * User Login
 * POST /api/v1/auth/login
 */
router.post('/login',
  rateLimitMiddleware.loginRateLimit,
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('device_id').notEmpty().withMessage('Device ID is required'),
    body('device_type').isIn(['mobile', 'desktop', 'tablet']).withMessage('Invalid device type'),
    body('device_name').notEmpty().withMessage('Device name is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Login validation failed',
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const loginData = validationUtil.validateLogin(req.body);
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await authService.loginUser({
        ...loginData,
        ipAddress,
        userAgent
      });

      logger.info('User logged in successfully', {
        userId: result.user.id,
        phone: result.user.phone,
        sessionId: result.session.id,
        ipAddress,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Login successful', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Token Refresh
 * POST /api/v1/auth/refresh
 */
router.post('/refresh',
  [
    body('refresh_token').notEmpty().withMessage('Refresh token is required')
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

      const { refresh_token } = req.body;

      const result = await authService.refreshTokens(refresh_token);

      logger.info('Tokens refreshed successfully', {
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Tokens refreshed successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * User Logout
 * POST /api/v1/auth/logout
 */
router.post('/logout',
  async (req, res, next) => {
    try {
      const authHeader = req.get('Authorization');
      if (!authHeader) {
        throw AuthError.missingToken('Authorization header is required');
      }

      const token = authHeader.replace('Bearer ', '');

      await authService.logoutUser(token);

      logger.info('User logged out successfully', {
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(null, 'Logged out successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Request OTP for Password Reset
 * POST /api/v1/auth/forgot-password/otp
 */
router.post('/forgot-password/otp',
  rateLimitMiddleware.passwordResetRateLimit,
  [
    body('phone').notEmpty().withMessage('Phone number is required')
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

      const { phone } = req.body;
      const ipAddress = req.ip;

      const result = await otpService.sendPasswordResetOtp(phone, ipAddress);

      logger.info('Password reset OTP requested', {
        phone: result.phone,
        verificationId: result.verification_id,
        ipAddress,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'OTP sent successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Reset Password
 * POST /api/v1/auth/reset-password
 */
router.post('/reset-password',
  rateLimitMiddleware.passwordResetRateLimit,
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('verification_id').isUUID().withMessage('Valid verification ID is required'),
    body('otp_code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('new_password').notEmpty().withMessage('New password is required'),
    body('confirm_password').custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields('Password reset validation failed',
          errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        );
      }

      const { phone, verification_id, otp_code, new_password } = req.body;

      const result = await authService.resetPassword({
        phone,
        verification_id,
        otp_code,
        new_password
      });

      logger.info('Password reset successfully', {
        phone,
        requestId: req.requestId
      });

      res.status(200).json(apiResponse.success(result, 'Password has been reset successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
const express = require('express');
const { body } = require('express-validator');

/**
 * Authentication Routes Factory
 * Creates routes for authentication operations
 */
function createAuthRoutes(authController) {
  const router = express.Router();

  // Validation middleware
  const validateRequest = (validations) => {
    return async (req, res, next) => {
      await Promise.all(validations.map(validation => validation.run(req)));
      next();
    };
  };

  /**
   * Request Registration OTP
   * POST /auth/register/otp
   */
  router.post('/register/otp',
    validateRequest([
      body('phone').notEmpty().withMessage('Phone number is required'),
      body('country_code').notEmpty().withMessage('Country code is required')
    ]),
    authController.requestRegistrationOtp.bind(authController)
  );

  /**
   * Register User
   * POST /auth/register
   */
  router.post('/register',
    validateRequest([
      body('phone').notEmpty().withMessage('Phone number is required'),
      body('country_code').notEmpty().withMessage('Country code is required'),
      body('password').notEmpty().withMessage('Password is required'),
      body('verification_id').isUUID().withMessage('Valid verification ID is required'),
      body('otp_code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
      body('device_id').notEmpty().withMessage('Device ID is required'),
      body('device_type').isIn(['mobile', 'desktop', 'tablet']).withMessage('Invalid device type'),
      body('device_name').notEmpty().withMessage('Device name is required')
    ]),
    authController.register.bind(authController)
  );

  /**
   * Request Login OTP
   * POST /auth/login/otp
   */
  router.post('/login/otp',
    validateRequest([
      body('phone').notEmpty().withMessage('Phone number is required'),
      body('country_code').notEmpty().withMessage('Country code is required')
    ]),
    authController.requestLoginOtp.bind(authController)
  );

  /**
   * Login User
   * POST /auth/login
   */
  router.post('/login',
    validateRequest([
      body('phone').notEmpty().withMessage('Phone number is required'),
      body('country_code').notEmpty().withMessage('Country code is required'),
      body('device_id').notEmpty().withMessage('Device ID is required'),
      body('device_type').isIn(['mobile', 'desktop', 'tablet']).withMessage('Invalid device type'),
      body('device_name').notEmpty().withMessage('Device name is required')
    ]),
    authController.login.bind(authController)
  );

  /**
   * Refresh Token
   * POST /auth/refresh
   */
  router.post('/refresh',
    validateRequest([
      body('refresh_token').notEmpty().withMessage('Refresh token is required')
    ]),
    authController.refreshToken.bind(authController)
  );

  /**
   * Logout
   * POST /auth/logout
   */
  router.post('/logout', authController.logout.bind(authController));

  /**
   * Request Password Reset OTP
   * POST /auth/forgot-password/otp
   */
  router.post('/forgot-password/otp',
    validateRequest([
      body('phone').notEmpty().withMessage('Phone number is required'),
      body('country_code').notEmpty().withMessage('Country code is required')
    ]),
    authController.requestPasswordResetOtp.bind(authController)
  );

  /**
   * Reset Password
   * POST /auth/reset-password
   */
  router.post('/reset-password',
    validateRequest([
      body('phone').notEmpty().withMessage('Phone number is required'),
      body('country_code').notEmpty().withMessage('Country code is required'),
      body('verification_id').isUUID().withMessage('Valid verification ID is required'),
      body('otp_code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
      body('new_password').notEmpty().withMessage('New password is required')
    ]),
    authController.resetPassword.bind(authController)
  );

  /**
   * Verify Token (for middleware)
   * GET /auth/verify-token
   */
  router.get('/verify-token', authController.verifyToken.bind(authController));

  return router;
}

module.exports = createAuthRoutes;
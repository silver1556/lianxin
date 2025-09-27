const express = require('express');
const { body } = require('express-validator');

/**
 * User Routes Factory
 * Creates routes for user operations
 */
function createUserRoutes(userController) {
  const router = express.Router();

  // Authentication middleware (will be injected by main app)
  const requireAuth = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' }
      });
    }
    next();
  };

  // Admin middleware
  const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: { code: 'ADMIN_REQUIRED', message: 'Admin access required' }
      });
    }
    next();
  };

  // Validation middleware
  const validateRequest = (validations) => {
    return async (req, res, next) => {
      await Promise.all(validations.map(validation => validation.run(req)));
      next();
    };
  };

  /**
   * Get User Profile
   * GET /user/profile/:id
   */
  router.get('/profile/:id', userController.getProfile.bind(userController));

  /**
   * Update User Profile
   * PUT /user/profile
   */
  router.put('/profile',
    requireAuth,
    userController.updateProfile.bind(userController)
  );

  /**
   * Change Password
   * PUT /user/password
   */
  router.put('/password',
    requireAuth,
    validateRequest([
      body('current_password').notEmpty().withMessage('Current password is required'),
      body('new_password').notEmpty().withMessage('New password is required')
    ]),
    userController.changePassword.bind(userController)
  );

  /**
   * Suspend User (Admin)
   * POST /user/:userId/suspend
   */
  router.post('/:userId/suspend',
    requireAuth,
    requireAdmin,
    validateRequest([
      body('reason').notEmpty().withMessage('Suspension reason is required'),
      body('duration').isInt({ min: 1, max: 365 }).withMessage('Duration must be between 1 and 365 days')
    ]),
    userController.suspendUser.bind(userController)
  );

  /**
   * Verify User (Admin)
   * POST /user/:userId/verify
   */
  router.post('/:userId/verify',
    requireAuth,
    requireAdmin,
    validateRequest([
      body('verification_type').isIn(['government_id', 'manual']).withMessage('Invalid verification type'),
      body('verification_data').isObject().withMessage('Verification data must be an object')
    ]),
    userController.verifyUser.bind(userController)
  );

  return router;
}

module.exports = createUserRoutes;
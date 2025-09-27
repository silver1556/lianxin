/**
 * User Controller
 * HTTP layer for user operations
 */
class UserController {
  constructor(userApplicationService) {
    this.userService = userApplicationService;
  }

  /**
   * Get user profile
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.params.id === 'me' ? req.user?.userId : req.params.id;
      const requestingUserId = req.user?.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_USER_ID', message: 'User ID is required' }
        });
      }

      const profile = await this.userService.getUserProfile(userId, requestingUserId);

      res.status(200).json({
        success: true,
        data: { profile },
        message: 'Profile retrieved successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.userId;
      const profileData = req.body;

      const updatedProfile = await this.userService.updateUserProfile(userId, profileData);

      res.status(200).json({
        success: true,
        data: { profile: updatedProfile },
        message: 'Profile updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user.userId;
      const { current_password, new_password } = req.body;

      await this.userService.changePassword(userId, current_password, new_password);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Suspend user (Admin)
   */
  async suspendUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason, duration } = req.body;
      const suspendedBy = req.user.userId;

      const result = await this.userService.suspendUser(
        userId, 
        reason, 
        duration, 
        suspendedBy
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'User suspended successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify user (Admin)
   */
  async verifyUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { verification_type, verification_data } = req.body;
      const verifiedBy = req.user.userId;

      const result = await this.userService.verifyUser(
        userId,
        verification_type,
        verification_data,
        verifiedBy
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'User verified successfully'
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
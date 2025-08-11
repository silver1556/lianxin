const { User, UserSettings } = require('../models');
const sessionService = require('./session.service');
const encryptionService = require('./encryption.service');
const otpService = require('./otp.service');
const passwordUtil = require('../utils/password.util');
const phoneUtil = require('../utils/phone.util');
const logger = require('../utils/logger.util');
const { AuthError } = require('../errors/authError');
const { ValidationError } = require('../errors/validationError');
const { AppError } = require('../errors/AppError');
const { sequelize } = require('../models');

/**
 * Settings Service
 * Handles user settings, preferences, and account management
 */
class SettingsService {
  /**
   * Get user settings
   */
  async getUserSettings(userId) {
    try {
      let settings = await UserSettings.findByUserId(userId);

      if (!settings) {
        // Create default settings if they don't exist
        settings = await UserSettings.createDefault(userId);
      }

      // Decrypt settings data
      const decryptedSettings = await encryptionService.decryptSettingsData(settings.toJSON());

      logger.debug('User settings retrieved', {
        userId
      });

      return decryptedSettings.getAllSettings ? decryptedSettings.getAllSettings() : {
        privacy: decryptedSettings.privacy_settings,
        notifications: decryptedSettings.notification_settings,
        display: decryptedSettings.display_settings,
        security: decryptedSettings.security_settings
      };
    } catch (error) {
      logger.error('Failed to get user settings', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userId, settingsData) {
    try {
      let settings = await UserSettings.findByUserId(userId);

      if (!settings) {
        settings = await UserSettings.createDefault(userId);
      }

      // Update specific setting categories
      if (settingsData.privacy) {
        await settings.updatePrivacySettings(settingsData.privacy);
      }

      if (settingsData.notifications) {
        await settings.updateNotificationSettings(settingsData.notifications);
      }

      if (settingsData.display) {
        await settings.updateDisplaySettings(settingsData.display);
      }

      if (settingsData.security) {
        await settings.updateSecuritySettings(settingsData.security);
      }

      logger.info('User settings updated', {
        userId,
        updatedCategories: Object.keys(settingsData)
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to update user settings', {
        userId,
        error: error.message,
        settingsData: Object.keys(settingsData)
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, passwordData, sessionId = null) {
    try {
      const { current_password, new_password } = passwordData;

      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(user.toJSON());

      // Verify current password
      const isValidPassword = await user.validatePassword(current_password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials('Current password is incorrect');
      }

      // Validate new password
      passwordUtil.validatePassword(new_password);

      // Check password history (if implemented)
      // await passwordUtil.validatePasswordHistory(new_password, user.password_history);

      // Hash new password
      const newPasswordHash = await passwordUtil.hashPassword(new_password);

      // Update password
      await user.update({
        password_hash: newPasswordHash,
        password_changed_at: new Date()
      });

      // Revoke all other sessions except current one
      await sessionService.revokeAllUserSessions(userId, null, sessionId);

      logger.info('Password changed successfully', {
        userId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to change password', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Request OTP for phone number change
   */
  async requestPhoneChangeOtp(userId, newPhone, ipAddress) {
    try {
      // Validate new phone number
      const phoneValidation = phoneUtil.validatePhoneNumber(newPhone);
      const formattedPhone = phoneValidation.formatted;

      // Check if new phone number is already registered
      const existingUser = await User.findByPhone(formattedPhone);
      if (existingUser) {
        throw AuthError.duplicatePhone('Phone number already registered');
      }

      // Send OTP
      const result = await otpService.sendPhoneChangeOtp(formattedPhone, userId, ipAddress);

      logger.info('Phone change OTP requested', {
        userId,
        newPhone: formattedPhone,
        verificationId: result.verification_id
      });

      return result;
    } catch (error) {
      logger.error('Failed to request phone change OTP', {
        userId,
        newPhone,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Change phone number
   */
  async changePhoneNumber(userId, phoneChangeData) {
    const transaction = await sequelize.transaction();

    try {
      const { new_phone, verification_id, otp_code, password } = phoneChangeData;

      // Get user
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials('Password is incorrect');
      }

      // Verify OTP
      const otpVerification = await otpService.verifyOtp(verification_id, otp_code, new_phone);

      if (otpVerification.otp_type !== 'phone_number_change') {
        throw AuthError.invalidOTP('Invalid OTP type for phone number change');
      }

      if (otpVerification.user_id !== userId) {
        throw AuthError.invalidOTP('OTP was not requested for this user');
      }

      // Validate new phone number
      const phoneValidation = phoneUtil.validatePhoneNumber(new_phone);
      const formattedPhone = phoneValidation.formatted;

      // Check if OTP was issued for this phone number
      if (otpVerification.phone !== formattedPhone) {
        throw AuthError.invalidOTP('Phone number does not match the one used for OTP verification');
      }

      // Final check for phone number uniqueness
      const existingUser = await User.findByPhone(formattedPhone, { transaction });
      if (existingUser && existingUser.id !== userId) {
        throw AuthError.duplicatePhone('Phone number already registered by another user');
      }

      // Update phone number
      await user.update({
        phone: formattedPhone,
        country_code: phoneValidation.countryCode,
        phone_verified: true,
        phone_verified_at: new Date()
      }, { transaction });

      await transaction.commit();

      logger.info('Phone number changed successfully', {
        userId,
        oldPhone: user.phone,
        newPhone: formattedPhone
      });

      return {
        message: 'Phone number changed successfully',
        new_phone: formattedPhone
      };
    } catch (error) {
      await transaction.rollback();

      logger.error('Failed to change phone number', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId, password, reason = null) {
    try {
      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials('Password is incorrect');
      }

      // Check if account is already deactivated
      if (user.status === 'deactivated') {
        throw AppError.conflict('Account is already deactivated');
      }

      // Deactivate account
      await user.update({
        status: 'deactivated',
        deactivated_at: new Date()
      });

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(userId);

      logger.info('Account deactivated', {
        userId,
        reason
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to deactivate account', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Request account deletion
   */
  async requestAccountDeletion(userId, password) {
    try {
      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials('Password is incorrect');
      }

      // Check if account is already pending deletion
      if (user.status === 'pending_deletion') {
        throw AppError.conflict('Account is already scheduled for deletion');
      }

      // Schedule account for deletion
      await user.update({
        status: 'pending_deletion',
        pending_deletion_at: new Date()
      });

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(userId);

      logger.info('Account deletion requested', {
        userId,
        pendingDeletionAt: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to request account deletion', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel account deletion (reactivate)
   */
  async cancelAccountDeletion(userId) {
    try {
      // Get user
      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Check if account is pending deletion
      if (user.status !== 'pending_deletion') {
        throw AppError.badRequest('Account is not scheduled for deletion');
      }

      // Check if still within grace period (15 days)
      const gracePeriodEnd = new Date(user.pending_deletion_at);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 15);

      if (new Date() > gracePeriodEnd) {
        throw AppError.badRequest('Grace period for canceling deletion has expired');
      }

      // Reactivate account
      await user.update({
        status: 'active',
        pending_deletion_at: null
      });

      logger.info('Account deletion canceled', {
        userId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to cancel account deletion', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get account deletion status
   */
  async getAccountDeletionStatus(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw AppError.notFound('User not found');
      }

      if (user.status !== 'pending_deletion') {
        return {
          pending_deletion: false,
          deletion_date: null,
          days_remaining: null
        };
      }

      const deletionDate = new Date(user.pending_deletion_at);
      deletionDate.setDate(deletionDate.getDate() + 15);

      const daysRemaining = Math.ceil((deletionDate - new Date()) / (1000 * 60 * 60 * 24));

      return {
        pending_deletion: true,
        deletion_date: deletionDate.toISOString(),
        days_remaining: Math.max(0, daysRemaining)
      };
    } catch (error) {
      logger.error('Failed to get account deletion status', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new SettingsService();
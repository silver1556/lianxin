const { User, UserSettings } = require("../models");
const sessionService = require("./session.service");
const otpService = require("./otp.service");
const encryptionService = require("./encryption.service");
const logger = require("../../../../shared/utils/logger.util");
const validationUtil = require("../utils/validation.util");
const phoneUtil = require("../utils/phone.util");
const { AuthError } = require("../../../../shared/errors/authError");
const { AppError } = require("../../../../shared/errors/appError");
const { sequelize } = require("../models");
const {
  ValidationError,
} = require("../../../../shared/errors/validationError");

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
        logger.debug("User settings not found, creating default settings", {
          userId,
        });
        // Create default settings if they don't exist
        settings = await UserSettings.createDefault(userId);
      }

      logger.debug("User settings retrieved", {
        userId,
      });

      // Return all settings
      return settings.getAllSettings();
    } catch (error) {
      logger.error("Failed to get user settings", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update user individual setting field
   */
  async updateIndividualSetting(userId, category, key, value) {
    const transaction = await sequelize.transaction();

    try {
      let settings = await UserSettings.findByUserId(userId, { transaction });

      if (!settings) {
        logger.debug("No settings found, creating default settings for user", {
          userId,
        });
        settings = await UserSettings.createDefault(userId, { transaction });
      }

      // Construct update object with dot notation path
      const updateObj = {};
      updateObj[key] = value;

      // Update specific setting
      await settings.updatePartialSettings(
        `${category}_settings`,
        updateObj,
        transaction
      );

      await transaction.commit();

      logger.info("User settings updated", {
        userId,
        category,
        key,
        value,
      });

      return { [key]: value };
    } catch (error) {
      await transaction.rollback();
      logger.error("Failed to update user settings", {
        userId,
        category,
        key,
        value,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, passwordData, sessionId = null) {
    const t = await sequelize.transaction();

    try {
      const { current_password, new_password } = passwordData;

      // Get user
      const user = await User.findByPk(userId, { transaction: t });
      if (!user) {
        throw AppError.notFound("User not found");
      }

      // Verify current password
      const isValidCurrentPassword = await user.validatePassword(
        current_password
      );
      if (!isValidCurrentPassword) {
        throw AuthError.invalidCredentials("Current password is incorrect");
      }

      // Verify if new password matches current password
      const compareNewPassword = await user.validatePassword(new_password);
      if (compareNewPassword) {
        throw ValidationError.passwordReuse(
          "New password can not be same as current password"
        );
      }

      // Check password history if password is reused
      if (await user.isPasswordReused(new_password)) {
        throw ValidationError.passwordReuse(
          "New password cannot be same as old passwords"
        );
      }

      // Update password
      await user.update({ password_hash: new_password }, { transaction: t });

      // Revoke all other sessions except current one
      await sessionService.revokeAllUserSessions(userId, null, sessionId, t);

      await t.commit();

      logger.info("Password changed successfully", {
        userId,
      });

      return { success: true };
    } catch (error) {
      await t.rollback();
      logger.error("Failed to change password", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Request OTP for phone number change
   */
  async requestPhoneChangeOtp(userId, newPhone, countryCode) {
    try {
      // Validate new phone number
      const phoneValidation = validationUtil.validatePhoneNumber(
        newPhone,
        countryCode
      );

      // Check if phone number type is MOBILE
      if (phoneValidation.type !== "MOBILE") {
        throw new ValidationError("Phone number must be a mobile number");
      }

      const formattedPhoneE164 = phoneValidation.e164;

      const phoneHash = await encryptionService.hashData(formattedPhoneE164);

      // Check if new phone number is already registered
      const existingUser = await User.findByPhoneHash(phoneHash);
      if (existingUser) {
        throw AuthError.duplicatePhone("Phone number is already registered");
      }

      // Send OTP
      const result = await otpService.sendOtp(
        newPhone,
        countryCode,
        "phone_number_change",
        userId
      );

      return result;
    } catch (error) {
      logger.error("Failed to request phone change OTP", {
        userId,
        newPhone,
        error: error.message,
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
      const { new_phone, country_code, verification_id, otp_code, password } =
        phoneChangeData;

      // Get user
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        throw AppError.notFound("User not found");
      }

      // Verify current password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials("Password is incorrect");
      }

      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(
        new_phone,
        country_code
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // Generate phone hash to search for hashed number
      const phoneHash = await encryptionService.hashData(formattedPhoneE164);

      // Verify OTP
      await otpService.verifyOtp(verification_id, otp_code, phoneHash);

      const phoneEncrypted = await encryptionService.encryptSingleString(
        formattedPhoneE164
      );

      // Update phone number
      await user.update(
        {
          phone: phoneEncrypted,
          phone_hash: phoneHash,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info("Phone number changed successfully", {
        userId,
        newPhone: formattedPhoneE164,
      });

      return {
        message: "Phone number changed successfully",
        new_phone: formattedPhoneE164,
      };
    } catch (error) {
      await transaction.rollback();

      logger.error("Failed to change phone number", {
        userId,
        error: error.message,
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
        throw AppError.notFound("User not found");
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials("Password is incorrect");
      }

      // Check if account is already deactivated
      if (user.status === "deactivated") {
        throw AppError.conflict("Account is already deactivated");
      }

      // Deactivate account
      await user.update({
        status: "deactivated",
        deactivated_at: new Date(),
      });

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(userId);

      logger.info("Account deactivated", {
        userId,
        reason,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to deactivate account", {
        userId,
        error: error.message,
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
        throw AppError.notFound("User not found");
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw AuthError.invalidCredentials("Password is incorrect");
      }

      // Check if account is already pending deletion
      if (user.status === "pending_deletion") {
        throw AppError.conflict("Account is already scheduled for deletion");
      }

      // Schedule account for deletion
      await user.update({
        status: "pending_deletion",
        pending_deletion_at: new Date(),
      });

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(userId);

      logger.info("Account deletion requested", {
        userId,
        pendingDeletionAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to request account deletion", {
        userId,
        error: error.message,
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
        throw AppError.notFound("User not found");
      }

      // Check if account is pending deletion
      if (user.status !== "pending_deletion") {
        throw AppError.badRequest("Account is not scheduled for deletion");
      }

      // Check if still within grace period (15 days)
      const gracePeriodEnd = new Date(user.pending_deletion_at);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 15);

      if (new Date() > gracePeriodEnd) {
        throw AppError.badRequest(
          "Grace period for canceling deletion has expired"
        );
      }

      // Reactivate account
      await user.update({
        status: "active",
        pending_deletion_at: null,
      });

      logger.info("Account deletion canceled", {
        userId,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to cancel account deletion", {
        userId,
        error: error.message,
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
        throw AppError.notFound("User not found");
      }

      if (user.status !== "pending_deletion") {
        return {
          pending_deletion: false,
          deletion_date: null,
          days_remaining: null,
        };
      }

      const deletionDate = new Date(user.pending_deletion_at);
      deletionDate.setDate(deletionDate.getDate() + 15);

      const daysRemaining = Math.ceil(
        (deletionDate - new Date()) / (1000 * 60 * 60 * 24)
      );

      return {
        pending_deletion: true,
        deletion_date: deletionDate.toISOString(),
        days_remaining: Math.max(0, daysRemaining),
      };
    } catch (error) {
      logger.error("Failed to get account deletion status", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new SettingsService();

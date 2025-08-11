const { User } = require('../models');
const encryptionService = require('./encryption.service');
const cloudStorageService = require('./cloud-storage.service');
const logger = require('../utils/logger.util');
const { AppError } = require('../errors/AppError');
const { ValidationError } = require('../errors/validationError');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * Profile Service
 * Handles user profile operations, avatar management, and user data
 */
class ProfileService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(user.toJSON());

      logger.debug('User profile retrieved', {
        userId,
        phone: decryptedUser.phone
      });

      return this.sanitizeUserProfile(decryptedUser);
    } catch (error) {
      logger.error('Failed to get user profile', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, profileData) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Validate birth date if provided
      if (profileData.birth_date) {
        const birthDate = new Date(profileData.birth_date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        if (age < 13) {
          throw ValidationError.invalidAge('User must be at least 13 years old');
        }
        if (age > 120) {
          throw ValidationError.invalidAge('Invalid birth date');
        }
      }

      // Encrypt sensitive data before update
      const encryptedData = await encryptionService.encryptUserData(profileData);

      // Update user profile
      await user.update(encryptedData);

      logger.info('User profile updated successfully', {
        userId,
        updatedFields: Object.keys(profileData)
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId,
        error: error.message,
        profileData: Object.keys(profileData)
      });
      throw error;
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(userId, file) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Upload to cloud storage
      const avatarUrl = await cloudStorageService.uploadAvatar(userId, file);

      // Update user avatar URL
      await user.update({ avatar_url: avatarUrl });

      logger.info('Avatar uploaded successfully', {
        userId,
        fileSize: file.size,
        avatarUrl
      });

      return avatarUrl;
    } catch (error) {
      logger.error('Failed to upload avatar', {
        userId,
        error: error.message,
        fileSize: file?.size
      });
      throw new AppError('Failed to upload avatar', 500, 'AVATAR_UPLOAD_ERROR');
    }
  }

  /**
   * Upload user cover photo
   */
  async uploadCoverPhoto(userId, file) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Upload to cloud storage
      const coverPhotoUrl = await cloudStorageService.uploadCoverPhoto(userId, file);

      // Update user cover photo URL
      await user.update({ cover_photo_url: coverPhotoUrl });

      logger.info('Cover photo uploaded successfully', {
        userId,
        fileSize: file.size,
        coverPhotoUrl
      });

      return coverPhotoUrl;
    } catch (error) {
      logger.error('Failed to upload cover photo', {
        userId,
        error: error.message,
        fileSize: file?.size
      });
      throw new AppError('Failed to upload cover photo', 500, 'COVER_UPLOAD_ERROR');
    }
  }

  /**
   * Sanitize user profile for response (own profile)
   */
  sanitizeUserProfile(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    delete sanitized.verification_data;
    delete sanitized.failed_login_attempts;
    delete sanitized.last_failed_login;
    delete sanitized.registration_ip;
    delete sanitized.last_ip;
    return sanitized;
  }

  /**
   * Get public user profile by ID
   */
  async getPublicUserProfile(targetUserId, requestingUserId = null) {
    try {
      const user = await User.findByPk(targetUserId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // Check if user account is active
      if (user.status !== 'active') {
        throw AppError.notFound('User not found');
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(user.toJSON());

      // Check privacy settings
      if (decryptedUser.is_private) {
        // If profile is private, only show basic info unless they are friends
        // For now, we'll show basic info since friend relationships aren't implemented yet
        return this.sanitizePrivateUserProfile(decryptedUser);
      }

      logger.debug('Public user profile retrieved', {
        targetUserId,
        requestingUserId,
        isPrivate: decryptedUser.is_private
      });

      return this.sanitizePublicUserProfile(decryptedUser);
    } catch (error) {
      logger.error('Failed to get public user profile', {
        targetUserId,
        requestingUserId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sanitize user profile for public viewing
   */
  sanitizePublicUserProfile(user) {
    const sanitized = { ...user };

    // Remove sensitive data
    delete sanitized.password_hash;
    delete sanitized.verification_data;
    delete sanitized.failed_login_attempts;
    delete sanitized.last_failed_login;
    delete sanitized.registration_ip;
    delete sanitized.last_ip;
    delete sanitized.phone;
    delete sanitized.country_code;
    delete sanitized.phone_verified;
    delete sanitized.phone_verified_at;
    delete sanitized.suspension_reason;
    delete sanitized.suspension_until;
    delete sanitized.login_count;
    delete sanitized.deactivated_at;
    delete sanitized.pending_deletion_at;
    delete sanitized.password_changed_at;

    return sanitized;
  }

  /**
   * Sanitize private user profile (minimal info)
   */
  sanitizePrivateUserProfile(user) {
    return {
      id: user.id,
      uuid: user.uuid,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_private: user.is_private,
      status: user.status,
      created_at: user.created_at
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw AppError.notFound('User not found');
      }

      // In a real implementation, this would aggregate data from other services
      const stats = {
        posts_count: 0,
        friends_count: 0,
        followers_count: 0,
        following_count: 0,
        photos_count: 0,
        videos_count: 0
      };

      logger.debug('User statistics retrieved', {
        userId,
        stats
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get user statistics', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new ProfileService();
const { User, UserProfile, UserPrivacy } = require("../models");
const encryptionService = require("./encryption.service");
const cloudStorageService = require("./cloud-storage.service");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");
const {
  ValidationError,
} = require("../../../../shared/errors/validationError");
const redisClient = require("../../../../shared/libraries/cache/redis.client");

/**
 * Profile Service
 * Handles user profile operations, avatar management, and user data
 */
class ProfileService {
  /**
   * Get user profile by userID along with privacy visibility settings
   */
  async getUserProfile(userId) {
    try {
      const profile = await UserProfile.findOne({
        where: { user_id: userId },
        include: [
          {
            model: User,
            as: "user",
            attributes: [
              "id",
              "uuid",
              "phone",
              "is_verified",
              "status",
              "created_at",
              "suspension_reason",
              "suspension_until",
            ],
          },
          { model: UserPrivacy, as: "UserPrivacy" },
        ],
      });

      if (!profile) {
        throw AppError.notFound("User profile not found");
      }

      return profile;
    } catch (error) {
      logger.error("Failed to get user profile", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update the user profile in the database
   * @param {string} userId - The ID of the user to update
   * @param {Object} profileData - The fields to update
   * @returns {Promise<Object>} - The updated user profile
   */
  async updateUserProfile(userId, profileData) {
    try {
      // Fetch the existing profile from the database
      const userProfile = await UserProfile.findOne({
        where: { user_id: userId },
      });

      if (!userProfile) {
        throw AppError.notFound("User profile not found");
      }

      // Validate birth date if provided
      if (profileData.birth_date) {
        const birthDate = new Date(profileData.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        // If birth month/day has not occurred yet this year, subtract 1
        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
          age--;
        }

        if (age < 13) {
          throw ValidationError.invalidAge(
            "User must be at least 13 years old",
            age
          );
        }
        if (age > 120) {
          throw ValidationError.invalidAge("Invalid birth date", age);
        }
      }

      // Encrypt sensitive data before update
      const encryptedData = await encryptionService.encryptUserData(
        profileData,
        userId
      );

      // Update user profile in database
      await userProfile.update(encryptedData);

      // Full cache in Redis
      await redisClient.cacheUserProfile(userId, profileData, "full");

      // Retrieve updated profile from Redis
      let retrievedProfile = await redisClient.getUserProfile(userId, "full");

      if (!retrievedProfile) {
        // Retrieve from redis failed. Reload to get latest values from DATABASE
        retrievedProfile = await userProfile.reload().toJSON();

        // Full cache in Redis
        await redisClient.cacheUserProfile(userId, profileData, "full");
      }

      logger.info("User profile updated successfully", {
        userId,
        updatedFields: Object.keys(profileData),
      });

      return retrievedProfile.toJSON();
    } catch (error) {
      logger.error("Failed to update user profile", {
        userId,
        error: error.message,
        profileData: Object.keys(profileData),
      });
      throw error;
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(userId, file) {
    try {
      const userProfile = await UserProfile.findOne({
        where: { user_id: userId },
      });

      if (!userProfile) {
        throw AppError.notFound("User profile not found");
      }

      // Upload to cloud storage
      const avatarUrl = await cloudStorageService.uploadAvatar(userId, file);

      // Update user avatar URL
      await userProfile.update({ avatar_url: avatarUrl });

      logger.info("Avatar uploaded successfully", {
        userId,
        fileSize: file.size,
        avatarUrl,
      });

      return avatarUrl;
    } catch (error) {
      logger.error("Failed to upload avatar", {
        userId,
        error: error.message,
        fileSize: file?.size,
      });
      throw new AppError("Failed to upload avatar", 500, "AVATAR_UPLOAD_ERROR");
    }
  }

  /**
   * Upload user cover photo
   */
  async uploadCoverPhoto(userId, file) {
    try {
      const user = await UserProfile.findOne({
        where: { user_id: userId },
      });

      if (!user) {
        throw AppError.notFound("User not found");
      }

      // Upload to cloud storage
      const coverPhotoUrl = await cloudStorageService.uploadCoverPhoto(
        userId,
        file
      );

      // Update user cover photo URL
      await user.update({ cover_photo_url: coverPhotoUrl });

      logger.info("Cover photo uploaded successfully", {
        userId,
        fileSize: file.size,
        coverPhotoUrl,
      });

      return coverPhotoUrl;
    } catch (error) {
      logger.error("Failed to upload cover photo", {
        userId,
        error: error.message,
        fileSize: file?.size,
      });
      throw new AppError(
        "Failed to upload cover photo",
        500,
        "COVER_UPLOAD_ERROR"
      );
    }
  }

  /**
   * Get public user profile by ID
   */
  async getPublicUserProfile(targetUserId, requestingUserId = null) {
    try {
      const user = await User.findByPk(targetUserId);

      if (!user) {
        throw AppError.notFound("User not found");
      }

      // Check if user account is active
      if (user.status !== "active") {
        throw AppError.notFound("User not found");
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(
        user.toJSON()
      );

      // Check privacy settings
      if (decryptedUser.is_private) {
        // If profile is private, only show basic info unless they are friends
        // For now, we'll show basic info since friend relationships aren't implemented yet
        return this.sanitizePrivateUserProfile(decryptedUser);
      }

      logger.debug("Public user profile retrieved", {
        targetUserId,
        requestingUserId,
        isPrivate: decryptedUser.is_private,
      });

      return this.sanitizePublicUserProfile(decryptedUser);
    } catch (error) {
      logger.error("Failed to get public user profile", {
        targetUserId,
        requestingUserId,
        error: error.message,
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
      created_at: user.created_at,
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw AppError.notFound("User not found");
      }

      // In a real implementation, this would aggregate data from other services
      const stats = {
        posts_count: 0,
        friends_count: 0,
        followers_count: 0,
        following_count: 0,
        photos_count: 0,
        videos_count: 0,
      };

      logger.debug("User statistics retrieved", {
        userId,
        stats,
      });

      return stats;
    } catch (error) {
      logger.error("Failed to get user statistics", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  isFieldVisible(field_name, privacySettings, viewerType) {
    // Find the setting for this field
    const setting = privacySettings.find((s) => s.field === field_name);

    // Default to "public" if no setting found
    const visibility = setting ? setting.visibility : "public";

    if (visibility === "public") return true;
    if (visibility === "private") return false;

    // For "friends", you’ll need your own friend-checking logic
    if (visibility === "friends") {
      return viewerType === "self" || viewerType === "friend";
    }

    return false;
  }

  buildProfileResponse(profile, isOwner, viewerType = "public") {
    const { user, privacySettings, ...profileData } = profile;

    const base = {
      id: user.id,
      uuid: user.uuid,
      display_name: profileData.display_name,
      avatar_url: profileData.avatar_url,
      is_verified: user.is_verified,
      created_at: user.created_at,
    };

    if (isOwner) {
      //full profile (self view)
      return {
        ...base,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        bio: profileData.bio,
        gender: profileData.gender,
        cover_photo_url: profileData.cover_photo_url,
        birth_date: profileData.birth_date,
        lives_in_location: encryptionService.decryptSingleString(
          profileData.lives_in_location
        ),
        hometown: encryptionService.decryptSingleString(profileData.hometown),
        occupation: profileData.occupation,
        salary: profileData.salary,
        relationship_status: profileData.relationship_status,
        languages: profileData.languages,
        hobbies: profileData.hobbies,
        skills: profileData.skills,

        privacySettings: privacySettings || [],
        phone: encryptionService.decryptSingleString(user.phone),
        account_status: user.status,
        suspension_reason: user.suspension_reason,
        suspension_until: user.suspension_until,
      };
    } else {
      // Public profile (sanitized with privacy rules)
      const safeProfile = { ...base };

      safeProfile.bio = profileData.bio;
      safeProfile.gender = profileData.gender;
      safeProfile.cover_photo_url = profileData.cover_photo_url;

      if (this.isFieldVisible("birth_date", privacySettings, viewerType)) {
        safeProfile.birth_date = profileData.birth_date;
      }
      if (
        this.isFieldVisible("lives_in_location", privacySettings, viewerType)
      ) {
        safeProfile.lives_in_location = profileData.lives_in_location;
      }
      if (this.isFieldVisible("hometown", privacySettings, viewerType)) {
        safeProfile.hometown = profileData.hometown;
      }
      if (this.isFieldVisible("occupation", privacySettings, viewerType)) {
        safeProfile.occupation = profileData.occupation;
      }
      if (this.isFieldVisible("salary", privacySettings, viewerType)) {
        safeProfile.salary = profileData.salary;
      }
      if (
        this.isFieldVisible("relationship_status", privacySettings, viewerType)
      ) {
        safeProfile.relationship_status = profileData.relationship_status;
      }
      if (this.isFieldVisible("languages", privacySettings, viewerType)) {
        safeProfile.languages = profileData.languages;
      }
      if (this.isFieldVisible("hobbies", privacySettings, viewerType)) {
        safeProfile.hobbies = profileData.hobbies;
      }
      if (this.isFieldVisible("skills", privacySettings, viewerType)) {
        safeProfile.skills = profileData.skills;
      }

      return safeProfile;
    }
  }
}

module.exports = new ProfileService();

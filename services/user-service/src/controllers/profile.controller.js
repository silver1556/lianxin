const express = require("express");
const { body, validationResult } = require("express-validator");
const profileService = require("../services/profile.service");
const validationUtil = require("../utils/validation.util");
const logger = require("../utils/logger.util");
const apiResponse = require("../../shared/utils/api.response");
const { ValidationError } = require("../errors/validationError");
const authMiddleware = require("../middleware/auth.middleware");
const router = express.Router();

/**
 * Get User Profile (Protected for self, Optional Auth for others)
 * GET /api/v1/user/profile/:id
 */
router.get(
  "/profile/:id",
  authMiddleware.optionalAuth,
  async (req, res, next) => {
    try {
      let userId = req.params.id;

      if (req.params.id === "me") {
        if (!req.user) {
          throw ValidationError.unauthorized(
            "Authentication required to access profile"
          );
        }
        userId = req.user.userId;
      }

      const profile = await profileService.getUserProfile(userId);

      const requestingUserId = req.user?.id;
      const isOwner = String(requestingUserId) === String(userId);

      //check viewer type
      let viewerType = "public";
      /* NEED TO IMPLEMENT LATER

      if (isOwner) {
        viewerType = "owner";
      } else if (requestingUserId) {
        // NEED TO IMPLEMENT
        const areFriends = await profileService.checkFriendship(
          requestingUserId,
          userId
        );
        viewerType = areFriends ? "friend" : "public";
      } else {
        viewerType = "public";
      }
      */

      const response = profileService.buildProfileResponse(
        profile,
        isOwner,
        viewerType
      );

      logger.info("User profile retrieved", {
        userId,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            { profile: response },
            "Profile retrieved successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update User Profile (protected)
 * PUT /api/v1/user/profile
 */
router.put(
  "/profile",
  authMiddleware.authenticate,
  [
    body("first_name")
      .optional()
      .isLength({ min: 1, max: 10 })
      .withMessage("First name must be 1-10 characters"),
    body("last_name")
      .optional()
      .isLength({ min: 1, max: 10 })
      .withMessage("Last name must be 1-10 characters"),
    body("display_name")
      .optional()
      .isLength({ min: 1, max: 20 })
      .withMessage("Display name must be 1-20 characters"),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Bio must not exceed 500 characters"),
    body("birth_date")
      .optional()
      .isISO8601({ strict: true })
      .toDate()
      .withMessage("Birth date must be a valid date"),
    body("gender")
      .optional()
      .isIn(["male", "female", "other"])
      .withMessage("Gender must be male, female, or other"),
    body("interested_in")
      .optional()
      .isIn(["men", "women", "both"])
      .withMessage("interested_in must be men, women or both"),
    body("lives_in_location")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Location must not exceed 100 characters"),
    body("hometown")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Hometown must not exceed 100 characters"),
    body("occupation")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Occupation must not exceed 100 characters"),
    body("salary")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Salary must be a positive integer")
      .toInt(),
    body("relationship_status")
      .optional()
      .isIn(["single", "in_relationship", "married", "divorced"])
      .withMessage("Invalid relationship status"),
    body("languages")
      .optional()
      .isArray()
      .withMessage("Languages must be an array"),
    body("hobbies")
      .optional()
      .isArray()
      .withMessage("Hobbies must be an array"),
    body("skills").optional().isArray().withMessage("Skills must be an array"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "Registration validation failed",
          fieldErrors
        );
      }

      const userId = req.user.userId;
      const profileData = validationUtil.validateProfileUpdate(req.body);

      const updatedProfile = await profileService.updateUserProfile(
        userId,
        profileData
      );

      logger.info("User profile updated", {
        userId,
        updatedFields: Object.keys(profileData),
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            updatedProfile,
            "User profile updated successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload Avatar
 * POST /api/v1/user/avatar
 */
router.post(
  "/avatar",
  authMiddleware.authenticate,
  createUpload("avatar", "avatar"),
  malwareScan,
  (req, _res, next) => {
    req.imageOpts = { width: 1200, quality: 85 };
    next();
  },
  sharpProcessor,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw ValidationError.requiredField(
          "avatar",
          "Avatar file is required"
        );
      }

      const userId = req.user.userId;

      // Validate file
      // 10 MB file size limit after convert
      validationUtil.validateFileUpload(req.file, "avatar");

      const avatarUrl = await profileService.uploadAvatar(userId, req.file);

      logger.info("Avatar uploaded successfully", {
        userId,
        avatarUrl,
        originalSize: req.file.size,
        fileSize: req.file.buffer.size,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            { avatar_url: avatarUrl },
            "Avatar uploaded successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload Cover Photo
 * POST /api/v1/user/cover-photo
 */
router.post(
  "/cover-photo",
  authMiddleware.authenticate,
  upload("cover_photo").single("cover_photo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw ValidationError.requiredField(
          "cover_photo",
          "Cover photo file is required"
        );
      }

      const userId = req.user.userId;

      // Convert HEIC/HEIF to JPEG
      // if not HEIC?HEIF then return original
      const file = await convertHeicToJpeg(req.file);

      // Validate file
      validationUtil.validateFileUpload(file, "cover_photo");

      const coverPhotoUrl = await profileService.uploadCoverPhoto(userId, file);

      logger.info("Cover photo uploaded successfully", {
        userId,
        coverPhotoUrl,
        fileSize: req.file.size,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            { cover_photo_url: coverPhotoUrl },
            "Cover photo uploaded successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Public User Profile
 * GET /api/v1/user/public/:userId
 */
router.get(
  "/public/:userId",
  authMiddleware.optionalAuth,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user?.userId || null;

      const profile = await profileService.getPublicUserProfile(
        userId,
        requestingUserId
      );

      logger.info("Public user profile retrieved", {
        targetUserId: userId,
        requestingUserId,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            { user: profile },
            "Public profile retrieved successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

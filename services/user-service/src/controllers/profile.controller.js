const express = require("express");
const { body, validationResult } = require("express-validator");
const profileService = require("../services/profile.service");
const validationUtil = require("../utils/validation.util");
const logger = require("../utils/logger.util");
const apiResponse = require("../../../shared/utils/api.response");
const { ValidationError } = require("../errors/validationError");
const authMiddleware = require("../middleware/auth.middleware");
const multer = require("multer");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          "Invalid file type. Only JPEG, PNG, and WebP are allowed."
        )
      );
    }
  },
});

/**
 * Get User Profile
 * GET /api/v1/user/profile
 */
router.get("/profile", authMiddleware.authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const profile = await profileService.getUserProfile(userId);

    logger.info("User profile retrieved", {
      userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { user: profile },
          "Profile retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
});

/**
 * Update User Profile
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
    body("location")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Location must not exceed 100 characters"),
    body("website")
      .optional()
      .isURL()
      .withMessage("Website must be a valid URL"),
    body("occupation")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Occupation must not exceed 100 characters"),
    body("education")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Education must not exceed 100 characters"),
    body("relationship_status")
      .optional()
      .isIn(["single", "in_relationship", "married", "complicated"])
      .withMessage("Invalid relationship status"),
    body("birth_date")
      .optional()
      .isISO8601()
      .withMessage("Birth date must be a valid date"),
    body("gender")
      .optional()
      .isIn(["male", "female", "other"])
      .withMessage("Invalid gender"),
    body("languages")
      .optional()
      .isArray()
      .withMessage("Languages must be an array"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw ValidationError.multipleFields(
          "Profile validation failed",
          errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
          }))
        );
      }

      const userId = req.user.userId;
      const profileData = validationUtil.validateProfileUpdate(req.body);

      await profileService.updateUserProfile(userId, profileData);

      logger.info("User profile updated", {
        userId,
        updatedFields: Object.keys(profileData),
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            null,
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
  upload.single("avatar"),
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
      validationUtil.validateFileUpload(req.file, "avatar");

      const avatarUrl = await profileService.uploadAvatar(userId, req.file);

      logger.info("Avatar uploaded successfully", {
        userId,
        avatarUrl,
        fileSize: req.file.size,
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
  upload.single("cover_photo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw ValidationError.requiredField(
          "cover_photo",
          "Cover photo file is required"
        );
      }

      const userId = req.user.userId;

      // Validate file
      validationUtil.validateFileUpload(req.file, "cover");

      const coverPhotoUrl = await profileService.uploadCoverPhoto(
        userId,
        req.file
      );

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

const express = require("express");
const { body } = require("express-validator");

// Controller import
const profileController = require("../controllers/profile.controller");

// Middleware imports
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

// Validation rules
const validationRules = {
  updateAvatarUrl: [
    body("avatar_url").isURL().withMessage("Avatar URL must be a valid URL"),
  ],

  updateCoverUrl: [
    body("cover_photo_url")
      .isURL()
      .withMessage("Cover photo URL must be a valid URL"),
  ],
};

/**
 * Get User Profile (Protected for self, Optional Auth for others)
 * GET /api/v1/user/profile/:id
 */
router.get(
  "/profile/:id",
  authMiddleware.optionalAuth,
  profileController.getUserProfile
);

/**
 * Update User Profile with privacy settings (protected)
 * PUT /api/v1/user/profile
 */
router.put(
  "/profile",
  authMiddleware.authenticate,
  profileController.updateUserProfile
);

/**
 * Update Avatar URL (after uploading via Media Service)
 * PUT /api/v1/user/profile/avatar
 */
router.put(
  "/profile/avatar",
  authMiddleware.authenticate,
  validationRules.updateAvatarUrl,
  profileController.updateAvatarUrl
);

/**
 * Update Cover Photo URL (after uploading via Media Service)
 * PUT /api/v1/user/profile/cover-photo
 */
router.put(
  "/profile/cover-photo",
  authMiddleware.authenticate,
  validationRules.updateCoverUrl,
  profileController.updateCoverUrl
);

module.exports = router;

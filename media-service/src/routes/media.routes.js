const express = require("express");
const { query } = require("express-validator");
const mediaController = require("../controllers/media.controller");
const rateLimitMiddleware = require("../middleware/rate-limit.middleware");

const router = express.Router();

/**
 * Get User Media Files
 * GET /api/v1/media/files
 */
router.get(
  "/files",
  rateLimitMiddleware.mediaAccessRateLimit,
  [
    query("media_type")
      .optional()
      .isIn(["profile", "cover", "post", "story", "message"])
      .withMessage("Invalid media type"),
    query("file_type")
      .optional()
      .isIn(["image", "video", "live_photo"])
      .withMessage("Invalid file type"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
  ],
  mediaController.getUserMediaFiles
);

/**
 * Get Media File Details
 * GET /api/v1/media/files/:mediaFileId
 */
router.get("/files/:mediaFileId", mediaController.getMediaFileDetails);

/**
 * Get Media File Variants
 * GET /api/v1/media/files/:mediaFileId/variants
 */
router.get(
  "/files/:mediaFileId/variants",
  mediaController.getMediaFileVariants
);

/**
 * Delete Media File
 * DELETE /api/v1/media/files/:mediaFileId
 */
router.delete("/files/:mediaFileId", mediaController.deleteMediaFile);

/**
 * Get Media File URL
 * GET /api/v1/media/files/:mediaFileId/url
 */
router.get("/files/:mediaFileId/url", mediaController.getMediaFileUrl);

/**
 * Get User Media Statistics
 * GET /api/v1/media/stats
 */
router.get("/stats", mediaController.getUserMediaStats);

/**
 * Regenerate Media Variants
 * POST /api/v1/media/files/:mediaFileId/regenerate
 */
router.post(
  "/files/:mediaFileId/regenerate",
  mediaController.regenerateMediaVariants
);

module.exports = router;

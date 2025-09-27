const express = require("express");
const { body } = require("express-validator");
const uploadController = require("../controllers/upload.controller");
const uploadMiddleware = require("../middleware/upload.middleware");

const router = express.Router();

/**
 * Upload Profile Picture
 * POST /api/v1/upload/profile
 */
router.post(
  "/profile",
  uploadMiddleware.single("profile_image"),
  [
    body("crop_data")
      .optional()
      .isJSON()
      .withMessage("Crop data must be valid JSON"),
  ],
  uploadController.uploadProfile
);

/**
 * Upload Cover Photo
 * POST /api/v1/upload/cover
 */
router.post(
  "/cover",
  uploadMiddleware.single("cover_image"),
  [
    body("crop_data")
      .optional()
      .isJSON()
      .withMessage("Crop data must be valid JSON"),
  ],
  uploadController.uploadCover
);

/**
 * Upload Post Media (Images, Videos, Live Photos)
 * POST /api/v1/upload/post
 */
router.post(
  "/post",
  uploadMiddleware.array("media_files", 10),
  [
    body("post_type")
      .optional()
      .isIn(["post", "story"])
      .withMessage("Post type must be post or story"),
    body("live_photo_pairs")
      .optional()
      .isJSON()
      .withMessage("Live photo pairs must be valid JSON"),
    body("processing_options")
      .optional()
      .isJSON()
      .withMessage("Processing options must be valid JSON"),
  ],
  uploadController.uploadPost
);

/**
 * Upload Live Photo
 * POST /api/v1/upload/live-photo
 */
router.post(
  "/live-photo",
  uploadMiddleware.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  uploadController.uploadLivePhoto
);

/**
 * Get Upload Status
 * GET /api/v1/upload/status/:mediaFileId
 */
router.get("/status/:mediaFileId", uploadController.getUploadStatus);

/**
 * Cancel Upload
 * DELETE /api/v1/upload/:mediaFileId
 */
router.delete("/:mediaFileId", uploadController.cancelUpload);

module.exports = router;

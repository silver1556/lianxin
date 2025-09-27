const { validationResult } = require("express-validator");
const uploadService = require("../services/upload.service");
const logger = require("../../../../shared/utils/logger.util");
const fileUtil = require("../utils/file.util");
const { ValidationError } = require("../errors/validation.error");

/**
 * Upload Profile Picture
 */
const uploadProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Profile upload validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    if (!req.file) {
      throw ValidationError.requiredField(
        "profile_image",
        "Profile image is required"
      );
    }

    const userId = req.user.userId;
    const cropData = req.body.crop_data ? JSON.parse(req.body.crop_data) : null;

    // Validate file
    const validation = await fileUtil.validateFile(req.file, "image");
    if (!validation.isValid) {
      throw ValidationError.invalidFile(
        "profile_image",
        validation.errors.join(", ")
      );
    }

    // Process upload
    const result = await uploadService.processProfileUpload(
      req.file,
      userId,
      cropData
    );

    logger.info("Profile image uploaded successfully", {
      userId,
      mediaFileId: result.mediaFile.id,
      originalSize: req.file.size,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: {
        media_file: result.mediaFile,
        processing_status: result.processingStatus,
        estimated_completion: result.estimatedCompletion,
      },
      message: "Profile image uploaded successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Cover Photo
 */
const uploadCover = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Cover upload validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    if (!req.file) {
      throw ValidationError.requiredField(
        "cover_image",
        "Cover image is required"
      );
    }

    const userId = req.user.userId;
    const cropData = req.body.crop_data ? JSON.parse(req.body.crop_data) : null;

    // Validate file
    const validation = await fileUtil.validateFile(req.file, "image");
    if (!validation.isValid) {
      throw ValidationError.invalidFile(
        "cover_image",
        validation.errors.join(", ")
      );
    }

    // Process upload
    const result = await uploadService.processCoverUpload(
      req.file,
      userId,
      cropData
    );

    logger.info("Cover photo uploaded successfully", {
      userId,
      mediaFileId: result.mediaFile.id,
      originalSize: req.file.size,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: {
        media_file: result.mediaFile,
        processing_status: result.processingStatus,
        estimated_completion: result.estimatedCompletion,
      },
      message: "Cover photo uploaded successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Post Media (Images, Videos, Live Photos)
 */
const uploadPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Post upload validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    if (!req.files || req.files.length === 0) {
      throw ValidationError.requiredField(
        "media_files",
        "At least one media file is required"
      );
    }

    const userId = req.user.userId;
    const postType = req.body.post_type || "post";
    const livePhotoPairs = req.body.live_photo_pairs
      ? JSON.parse(req.body.live_photo_pairs)
      : [];
    const processingOptions = req.body.processing_options
      ? JSON.parse(req.body.processing_options)
      : {};

    // Validate files
    for (const file of req.files) {
      const validation = await fileUtil.validateFile(file, "media");
      if (!validation.isValid) {
        throw ValidationError.invalidFile(
          file.originalname,
          validation.errors.join(", ")
        );
      }
    }

    // Process uploads
    const result = await uploadService.processPostUpload(
      req.files,
      userId,
      postType,
      livePhotoPairs,
      processingOptions
    );

    logger.info("Post media uploaded successfully", {
      userId,
      fileCount: req.files.length,
      mediaFileIds: result.mediaFiles.map((f) => f.id),
      livePhotoCount: livePhotoPairs.length,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: {
        media_files: result.mediaFiles,
        live_photos: result.livePhotos,
        processing_status: result.processingStatus,
        estimated_completion: result.estimatedCompletion,
      },
      message: "Post media uploaded successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload Live Photo
 */
const uploadLivePhoto = async (req, res, next) => {
  try {
    if (!req.files.image || !req.files.video) {
      throw ValidationError.requiredField(
        "files",
        "Both image and video files are required for live photo"
      );
    }

    const userId = req.user.userId;
    const imageFile = req.files.image[0];
    const videoFile = req.files.video[0];

    // Validate files
    const imageValidation = await fileUtil.validateFile(imageFile, "image");
    const videoValidation = await fileUtil.validateFile(videoFile, "video");

    if (!imageValidation.isValid) {
      throw ValidationError.invalidFile(
        "image",
        imageValidation.errors.join(", ")
      );
    }

    if (!videoValidation.isValid) {
      throw ValidationError.invalidFile(
        "video",
        videoValidation.errors.join(", ")
      );
    }

    // Process live photo upload
    const result = await uploadService.processLivePhotoUpload(
      imageFile,
      videoFile,
      userId
    );

    logger.info("Live photo uploaded successfully", {
      userId,
      mediaFileId: result.mediaFile.id,
      imageSize: imageFile.size,
      videoSize: videoFile.size,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: {
        media_file: result.mediaFile,
        processing_status: result.processingStatus,
        estimated_completion: result.estimatedCompletion,
      },
      message: "Live photo uploaded successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Upload Status
 */
const getUploadStatus = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const status = await uploadService.getUploadStatus(mediaFileId, userId);

    res.status(200).json({
      success: true,
      data: status,
      message: "Upload status retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Upload
 */
const cancelUpload = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    await uploadService.cancelUpload(mediaFileId, userId);

    logger.info("Upload cancelled", {
      mediaFileId,
      userId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      message: "Upload cancelled successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadProfile,
  uploadCover,
  uploadPost,
  uploadLivePhoto,
  getUploadStatus,
  cancelUpload,
};

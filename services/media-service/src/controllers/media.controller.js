const { validationResult } = require("express-validator");
const mediaService = require("../services/media.service");
const logger = require("../../../../shared/utils/logger.util");
const { ValidationError } = require("../errors/validation.error");

/**
 * Get User Media Files
 */

const getUserMediaFiles = async (req, res, next) => {
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
        "Media query validation failed",
        fieldErrors
      );
    }

    const userId = req.user.userId;
    const filters = {
      mediaType: req.query.media_type,
      fileType: req.query.file_type,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };

    const result = await mediaService.getUserMediaFiles(userId, filters);

    res.status(200).json({
      success: true,
      data: result,
      message: "Media files retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Media File Details
 */
const getMediaFileDetails = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const mediaFile = await mediaService.getMediaFileDetails(
      mediaFileId,
      userId
    );

    res.status(200).json({
      success: true,
      data: { media_file: mediaFile },
      message: "Media file details retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Media File Variants
 */
const getMediaFileVariants = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const variants = await mediaService.getMediaFileVariants(
      mediaFileId,
      userId
    );

    res.status(200).json({
      success: true,
      data: { variants },
      message: "Media file variants retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Media File
 */
const deleteMediaFile = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    await mediaService.deleteMediaFile(mediaFileId, userId);

    logger.info("Media file deleted", {
      mediaFileId,
      userId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      message: "Media file deleted successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Media File URL
 */
const getMediaFileUrl = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;
    const variant = req.query.variant || "original";

    const urlInfo = await mediaService.getMediaFileUrl(
      mediaFileId,
      userId,
      variant
    );

    res.status(200).json({
      success: true,
      data: urlInfo,
      message: "Media file URL retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Media Statistics
 */
const getUserMediaStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const stats = await mediaService.getUserMediaStats(userId);

    res.status(200).json({
      success: true,
      data: { stats },
      message: "Media statistics retrieved successfully",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate Media Variants
 */
const regenerateMediaVariants = async (req, res, next) => {
  try {
    const { mediaFileId } = req.params;
    const userId = req.user.userId;

    const result = await mediaService.regenerateMediaVariants(
      mediaFileId,
      userId
    );

    logger.info("Media variants regeneration initiated", {
      mediaFileId,
      userId,
      requestId: req.requestId,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Media variants regeneration initiated",
      request_id: req.requestId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserMediaFiles,
  getMediaFileDetails,
  getMediaFileVariants,
  deleteMediaFile,
  getMediaFileUrl,
  getUserMediaStats,
  regenerateMediaVariants,
};

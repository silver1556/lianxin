const {
  MediaFile,
  MediaVariant,
  MediaMetadata,
  ProcessingJob,
} = require("../models");
const storageService = require("./alibaba-storage.service");
const queueService = require("./queue.service");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * Media Service
 * Handles media file management and retrieval
 */
class MediaService {
  /**
   * Get user media files with filters
   */
  async getUserMediaFiles(userId, filters = {}) {
    try {
      const { mediaType, fileType, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

      const where = {
        user_id: userId,
        is_deleted: false,
        processing_status: "completed",
        malware_scan_status: "clean",
      };

      if (mediaType) where.media_type = mediaType;
      if (fileType) where.file_type = fileType;

      const { count, rows: mediaFiles } = await MediaFile.findAndCountAll({
        where,
        limit,
        offset,
        order: [["created_at", "DESC"]],
        include: [
          {
            model: MediaVariant,
            as: "variants",
            attributes: [
              "variant_type",
              "format",
              "width",
              "height",
              "file_size",
              "cdn_url",
            ],
          },
          {
            model: MediaMetadata,
            as: "metadata",
            attributes: [
              "original_width",
              "original_height",
              "duration",
              "is_live_photo",
            ],
          },
        ],
      });

      const sanitizedFiles = mediaFiles.map((file) => ({
        ...file.toSafeObject(),
        variants: file.variants
          ? file.variants.map((v) => v.toSafeObject())
          : [],
        metadata: file.metadata,
      }));

      return {
        media_files: sanitizedFiles,
        pagination: {
          page,
          limit,
          total_count: count,
          total_pages: Math.ceil(count / limit),
          has_next: page < Math.ceil(count / limit),
          has_prev: page > 1,
        },
      };
    } catch (error) {
      logger.error("Failed to get user media files", {
        userId,
        filters,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media file details
   */
  async getMediaFileDetails(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaFileId,
          user_id: userId,
          is_deleted: false,
        },
        include: [
          {
            model: MediaVariant,
            as: "variants",
          },
          {
            model: MediaMetadata,
            as: "metadata",
          },
          {
            model: ProcessingJob,
            as: "processingJobs",
            order: [["created_at", "DESC"]],
            limit: 5,
          },
        ],
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      return {
        ...mediaFile.toSafeObject(),
        variants: mediaFile.variants
          ? mediaFile.variants.map((v) => v.toSafeObject())
          : [],
        metadata: mediaFile.metadata,
        processing_jobs: mediaFile.processingJobs
          ? mediaFile.processingJobs.map((j) => ({
              id: j.id,
              job_type: j.job_type,
              status: j.status,
              progress: j.progress,
              created_at: j.created_at,
              completed_at: j.completed_at,
            }))
          : [],
      };
    } catch (error) {
      logger.error("Failed to get media file details", {
        mediaFileId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media file variants
   */
  async getMediaFileVariants(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaFileId,
          user_id: userId,
          is_deleted: false,
        },
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      const variants = await MediaVariant.findByMediaFile(mediaFileId);

      return variants.map((variant) => variant.toSafeObject());
    } catch (error) {
      logger.error("Failed to get media file variants", {
        mediaFileId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete media file
   */
  async deleteMediaFile(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaFileId,
          user_id: userId,
          is_deleted: false,
        },
        include: [
          {
            model: MediaVariant,
            as: "variants",
          },
        ],
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      // Soft delete the media file
      await mediaFile.softDelete();

      // Schedule cleanup of storage files
      const filesToDelete = [mediaFile.storage_path];
      if (mediaFile.variants) {
        filesToDelete.push(...mediaFile.variants.map((v) => v.storage_path));
      }

      // Delete from cloud storage
      const remotePathsToDelete = [];
      if (mediaFile.cdn_url) {
        remotePathsToDelete.push(
          this.extractRemotePathFromUrl(mediaFile.cdn_url)
        );
      }
      if (mediaFile.variants) {
        remotePathsToDelete.push(
          ...mediaFile.variants
            .filter((v) => v.cdn_url)
            .map((v) => this.extractRemotePathFromUrl(v.cdn_url))
        );
      }

      if (remotePathsToDelete.length > 0) {
        await storageService.deleteFiles(remotePathsToDelete);
      }

      // Schedule local file cleanup
      await queueService.addCleanupJob({
        filePaths: filesToDelete,
        reason: "user_deletion",
        mediaFileId,
      });

      logger.info("Media file deleted successfully", {
        mediaFileId,
        userId,
        variantCount: mediaFile.variants ? mediaFile.variants.length : 0,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to delete media file", {
        mediaFileId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get media file URL with optional variant
   */
  async getMediaFileUrl(mediaFileId, userId, variantType = "original") {
    try {
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaFileId,
          user_id: userId,
          is_deleted: false,
        },
        include: [
          {
            model: MediaVariant,
            as: "variants",
            where:
              variantType !== "original"
                ? { variant_type: variantType }
                : undefined,
            required: variantType !== "original",
          },
        ],
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      if (!mediaFile.isReady()) {
        throw AppError.badRequest("Media file is not ready for access");
      }

      let url, metadata;

      if (variantType === "original") {
        url = mediaFile.cdn_url;
        metadata = {
          variant_type: "original",
          file_size: mediaFile.file_size,
          mime_type: mediaFile.mime_type,
        };
      } else {
        const variant = mediaFile.variants && mediaFile.variants[0];
        if (!variant) {
          throw AppError.notFound(`Variant '${variantType}' not found`);
        }

        url = variant.cdn_url;
        metadata = {
          variant_type: variant.variant_type,
          format: variant.format,
          width: variant.width,
          height: variant.height,
          file_size: variant.file_size,
        };
      }

      // Generate signed URL if needed
      if (!url) {
        const remotePath = this.extractRemotePathFromUrl(
          mediaFile.storage_path
        );
        const signedUrlResult = await storageService.generateSignedUrl(
          remotePath,
          3600
        );
        url = signedUrlResult.url;
      }

      return {
        url,
        metadata,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      };
    } catch (error) {
      logger.error("Failed to get media file URL", {
        mediaFileId,
        userId,
        variantType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user media statistics
   */
  async getUserMediaStats(userId) {
    try {
      const totalFiles = await MediaFile.count({
        where: { user_id: userId, is_deleted: false },
      });

      const totalSize =
        (await MediaFile.sum("file_size", {
          where: { user_id: userId, is_deleted: false },
        })) || 0;

      const breakdown = await MediaFile.findAll({
        where: { user_id: userId, is_deleted: false },
        attributes: [
          "media_type",
          "file_type",
          [require("sequelize").fn("COUNT", "*"), "count"],
          [
            require("sequelize").fn(
              "SUM",
              require("sequelize").col("file_size")
            ),
            "total_size",
          ],
        ],
        group: ["media_type", "file_type"],
        raw: true,
      });

      const processingStats = await ProcessingJob.findAll({
        attributes: [
          "status",
          [require("sequelize").fn("COUNT", "*"), "count"],
        ],
        include: [
          {
            model: MediaFile,
            as: "mediaFile",
            where: { user_id: userId },
            attributes: [],
          },
        ],
        group: ["status"],
        raw: true,
      });

      return {
        total_files: totalFiles,
        total_size: totalSize,
        formatted_size: this.formatFileSize(totalSize),
        breakdown: breakdown.map((item) => ({
          media_type: item.media_type,
          file_type: item.file_type,
          count: parseInt(item.count),
          total_size: parseInt(item.total_size) || 0,
          formatted_size: this.formatFileSize(parseInt(item.total_size) || 0),
        })),
        processing_stats: processingStats.map((item) => ({
          status: item.status,
          count: parseInt(item.count),
        })),
      };
    } catch (error) {
      logger.error("Failed to get user media stats", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Regenerate media variants
   */
  async regenerateMediaVariants(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaFileId,
          user_id: userId,
          is_deleted: false,
        },
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      // Delete existing variants
      await MediaVariant.destroy({
        where: { media_file_id: mediaFileId },
      });

      // Reset processing status
      await mediaFile.update({
        processing_status: "pending",
      });

      // Add new processing job
      if (
        mediaFile.file_type === "image" ||
        mediaFile.file_type === "live_photo"
      ) {
        await queueService.addImageProcessingJob(
          {
            filePath: mediaFile.storage_path,
            mediaFileId: mediaFile.id,
            mediaType: mediaFile.media_type,
            userId,
          },
          { priority: 6 }
        );
      } else if (mediaFile.file_type === "video") {
        await queueService.addVideoProcessingJob(
          {
            filePath: mediaFile.storage_path,
            mediaFileId: mediaFile.id,
            userId,
          },
          { priority: 4 }
        );
      }

      return {
        message: "Variant regeneration initiated",
        processing_status: "pending",
        estimated_completion: new Date(Date.now() + 300000).toISOString(), // 5 minutes
      };
    } catch (error) {
      logger.error("Failed to regenerate media variants", {
        mediaFileId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Extract remote path from CDN URL
   */
  extractRemotePathFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error) {
      logger.warn("Failed to extract remote path from URL", {
        url,
        error: error.message,
      });
      return url;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

module.exports = new MediaService();

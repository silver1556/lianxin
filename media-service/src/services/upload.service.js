const fs = require("fs-extra");
const { MediaFile, MediaMetadata, ProcessingJob } = require("../models");
const queueService = require("./queue.service");
const fileUtil = require("../utils/file.util");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");
const { ValidationError } = require("../errors/validation.error");
const config = require("../config/app.config");
/**
 * Upload Service
 * Handles file uploads and initiates processing pipelines
 */
class UploadService {
  /**
   * Process profile image upload
   */
  async processProfileUpload(file, userId, cropData = null) {
    try {
      // Generate file hash
      const fileHash = await fileUtil.generateFileHash(file.path);

      // Check for duplicate
      const existingFile = await MediaFile.findByHash(fileHash);
      if (
        existingFile &&
        existingFile.user_id === userId &&
        existingFile.media_type === "profile"
      ) {
        logger.info("Duplicate profile image detected", {
          userId,
          existingFileId: existingFile.id,
          fileHash,
        });
        return {
          mediaFile: existingFile.toSafeObject(),
          processingStatus: existingFile.processing_status,
          isDuplicate: true,
        };
      }

      // Create media file record
      const mediaFile = await MediaFile.create({
        user_id: userId,
        original_filename: file.originalname,
        file_type: "image",
        media_type: "profile",
        mime_type: file.mimetype,
        file_size: file.size,
        file_hash: fileHash,
        storage_path: file.path,
        processing_status: "pending",
        malware_scan_status: "pending",
      });

      // Add malware scan job (highest priority)
      await queueService.addMalwareScanJob(
        {
          filePath: file.path,
          mediaFileId: mediaFile.id,
          userId,
        },
        { priority: 10 }
      );

      // Add image processing job
      await queueService.addImageProcessingJob(
        {
          filePath: file.path,
          mediaFileId: mediaFile.id,
          mediaType: "profile",
          userId,
          cropData,
        },
        { priority: 8 }
      );

      logger.info("Profile upload initiated", {
        userId,
        mediaFileId: mediaFile.id,
        filename: file.originalname,
        fileSize: file.size,
      });

      return {
        mediaFile: mediaFile.toSafeObject(),
        processingStatus: "pending",
        estimatedCompletion: this.estimateProcessingTime("profile", file.size),
      };
    } catch (error) {
      logger.error("Profile upload processing failed", {
        userId,
        filename: file?.originalname,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process cover photo upload
   */
  async processCoverUpload(file, userId, cropData = null) {
    try {
      // Generate file hash
      const fileHash = await fileUtil.generateFileHash(file.path);

      // Create media file record
      const mediaFile = await MediaFile.create({
        user_id: userId,
        original_filename: file.originalname,
        file_type: "image",
        media_type: "cover",
        mime_type: file.mimetype,
        file_size: file.size,
        file_hash: fileHash,
        storage_path: file.path,
        processing_status: "pending",
        malware_scan_status: "pending",
      });

      // Add malware scan job
      await queueService.addMalwareScanJob(
        {
          filePath: file.path,
          mediaFileId: mediaFile.id,
          userId,
        },
        { priority: 10 }
      );

      // Add image processing job
      await queueService.addImageProcessingJob(
        {
          filePath: file.path,
          mediaFileId: mediaFile.id,
          mediaType: "cover",
          userId,
          cropData,
        },
        { priority: 7 }
      );

      logger.info("Cover upload initiated", {
        userId,
        mediaFileId: mediaFile.id,
        filename: file.originalname,
        fileSize: file.size,
      });

      return {
        mediaFile: mediaFile.toSafeObject(),
        processingStatus: "pending",
        estimatedCompletion: this.estimateProcessingTime("cover", file.size),
      };
    } catch (error) {
      logger.error("Cover upload processing failed", {
        userId,
        filename: file?.originalname,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process post media upload (multiple files)
   */
  async processPostUpload(
    files,
    userId,
    postType = "post",
    livePhotoPairs = [],
    processingOptions = {}
  ) {
    try {
      const mediaFiles = [];
      const livePhotos = [];

      // Process regular files
      for (const file of files) {
        // Check if this file is part of a live photo pair
        const livePhotoPair = livePhotoPairs.find(
          (pair) =>
            pair.imageIndex === files.indexOf(file) ||
            pair.videoIndex === files.indexOf(file)
        );

        if (livePhotoPair && livePhotoPair.imageIndex === files.indexOf(file)) {
          // This is the image part of a live photo - skip individual processing
          continue;
        }

        if (livePhotoPair && livePhotoPair.videoIndex === files.indexOf(file)) {
          // This is the video part of a live photo - process as live photo
          const imageFile = files[livePhotoPair.imageIndex];
          const videoFile = file;

          const livePhotoResult = await this.processLivePhotoUpload(
            imageFile,
            videoFile,
            userId
          );
          livePhotos.push(livePhotoResult);
          continue;
        }

        // Process as regular media file
        const fileHash = await fileUtil.generateFileHash(file.path);
        const fileType = config.supportedImageTypes.includes(file.mimetype)
          ? "image"
          : "video";

        const mediaFile = await MediaFile.create({
          user_id: userId,
          original_filename: file.originalname,
          file_type: fileType,
          media_type: postType,
          mime_type: file.mimetype,
          file_size: file.size,
          file_hash: fileHash,
          storage_path: file.path,
          processing_status: "pending",
          malware_scan_status: "pending",
        });

        // Add malware scan job
        await queueService.addMalwareScanJob(
          {
            filePath: file.path,
            mediaFileId: mediaFile.id,
            userId,
          },
          { priority: 9 }
        );

        // Add appropriate processing job
        if (fileType === "image") {
          await queueService.addImageProcessingJob(
            {
              filePath: file.path,
              mediaFileId: mediaFile.id,
              mediaType: postType,
              userId,
              processingOptions,
            },
            { priority: 5 }
          );
        } else {
          await queueService.addVideoProcessingJob(
            {
              filePath: file.path,
              mediaFileId: mediaFile.id,
              userId,
              processingOptions,
            },
            { priority: 3 }
          );
        }

        mediaFiles.push(mediaFile.toSafeObject());
      }

      logger.info("Post media upload initiated", {
        userId,
        fileCount: files.length,
        mediaFileCount: mediaFiles.length,
        livePhotoCount: livePhotos.length,
        postType,
      });

      return {
        mediaFiles,
        livePhotos,
        processingStatus: "pending",
        estimatedCompletion: this.estimateProcessingTime(
          "post",
          this.getTotalFileSize(files)
        ),
      };
    } catch (error) {
      logger.error("Post upload processing failed", {
        userId,
        fileCount: files?.length,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process live photo upload
   */
  async processLivePhotoUpload(imageFile, videoFile, userId) {
    try {
      // Validate live photo constraints
      await this.validateLivePhoto(imageFile, videoFile);

      // Generate file hash for the image (primary component)
      const fileHash = await fileUtil.generateFileHash(imageFile.path);

      // Create media file record for live photo
      const mediaFile = await MediaFile.create({
        user_id: userId,
        original_filename: imageFile.originalname,
        file_type: "live_photo",
        media_type: "post",
        mime_type: imageFile.mimetype,
        file_size: imageFile.size + videoFile.size,
        file_hash: fileHash,
        storage_path: imageFile.path,
        processing_status: "pending",
        malware_scan_status: "pending",
      });

      // Create metadata record with live photo info
      await MediaMetadata.create({
        media_file_id: mediaFile.id,
        is_live_photo: true,
        live_photo_video_path: videoFile.path,
      });

      // Add malware scan jobs for both files
      await queueService.addMalwareScanJob(
        {
          filePath: imageFile.path,
          mediaFileId: mediaFile.id,
          userId,
        },
        { priority: 10 }
      );

      await queueService.addMalwareScanJob(
        {
          filePath: videoFile.path,
          mediaFileId: mediaFile.id,
          userId,
          isSecondaryFile: true,
        },
        { priority: 10 }
      );

      // Add live photo processing job
      await queueService.addImageProcessingJob(
        {
          filePath: imageFile.path,
          videoPath: videoFile.path,
          mediaFileId: mediaFile.id,
          mediaType: "post",
          userId,
          isLivePhoto: true,
        },
        { priority: 6 }
      );

      logger.info("Live photo upload initiated", {
        userId,
        mediaFileId: mediaFile.id,
        imageFile: imageFile.originalname,
        videoFile: videoFile.originalname,
        totalSize: imageFile.size + videoFile.size,
      });

      return {
        mediaFile: mediaFile.toSafeObject(),
        processingStatus: "pending",
        estimatedCompletion: this.estimateProcessingTime(
          "live_photo",
          imageFile.size + videoFile.size
        ),
      };
    } catch (error) {
      logger.error("Live photo upload processing failed", {
        userId,
        imageFile: imageFile?.originalname,
        videoFile: videoFile?.originalname,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findOne({
        where: { id: mediaFileId, user_id: userId },
        include: [
          {
            model: require("../models").MediaVariant,
            as: "variants",
          },
          {
            model: require("../models").MediaMetadata,
            as: "metadata",
          },
          {
            model: require("../models").ProcessingJob,
            as: "processingJobs",
          },
        ],
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      // Get processing progress
      const processingProgress = await this.calculateProcessingProgress(
        mediaFile
      );

      return {
        media_file: mediaFile.toSafeObject(),
        processing_status: mediaFile.processing_status,
        malware_scan_status: mediaFile.malware_scan_status,
        progress: processingProgress,
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
            }))
          : [],
      };
    } catch (error) {
      logger.error("Failed to get upload status", {
        mediaFileId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel upload and cleanup
   */
  async cancelUpload(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findOne({
        where: { id: mediaFileId, user_id: userId },
      });

      if (!mediaFile) {
        throw AppError.notFound("Media file not found");
      }

      if (mediaFile.processing_status === "completed") {
        throw AppError.badRequest("Cannot cancel completed upload");
      }

      // Cancel processing jobs
      const processingJobs = await ProcessingJob.findByMediaFile(mediaFileId);
      for (const job of processingJobs) {
        if (job.status === "pending" || job.status === "processing") {
          await job.cancel();
        }
      }

      // Mark file as deleted
      await mediaFile.softDelete();

      // Schedule cleanup
      await queueService.addCleanupJob({
        filePaths: [mediaFile.storage_path],
        reason: "upload_cancelled",
        mediaFileId,
      });

      logger.info("Upload cancelled successfully", {
        mediaFileId,
        userId,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to cancel upload", {
        mediaFileId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate live photo constraints
   */
  async validateLivePhoto(imageFile, videoFile) {
    try {
      // Check file types
      if (!config.supportedImageTypes.includes(imageFile.mimetype)) {
        throw ValidationError.invalidFile(
          "image",
          "Invalid image format for live photo"
        );
      }

      if (!config.supportedVideoTypes.includes(videoFile.mimetype)) {
        throw ValidationError.invalidFile(
          "video",
          "Invalid video format for live photo"
        );
      }

      // Check video duration (should be around 3 seconds)
      const videoDuration =
        await require("get-video-duration").getVideoDurationInSeconds(
          videoFile.path
        );
      if (videoDuration > 5) {
        throw ValidationError.invalidFile(
          "video",
          "Live photo video must be 5 seconds or less"
        );
      }

      // Check file sizes
      if (imageFile.size > 20 * 1024 * 1024) {
        // 20MB
        throw ValidationError.invalidFile(
          "image",
          "Live photo image too large"
        );
      }

      if (videoFile.size > 50 * 1024 * 1024) {
        // 50MB
        throw ValidationError.invalidFile(
          "video",
          "Live photo video too large"
        );
      }

      return true;
    } catch (error) {
      logger.error("Live photo validation failed", {
        imageFile: imageFile?.originalname,
        videoFile: videoFile?.originalname,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate processing progress
   */
  async calculateProcessingProgress(mediaFile) {
    try {
      const jobs = await ProcessingJob.findByMediaFile(mediaFile.id);

      if (jobs.length === 0) {
        return { overall: 0, jobs: [] };
      }

      let totalProgress = 0;
      const jobProgress = [];

      for (const job of jobs) {
        totalProgress += job.progress;
        jobProgress.push({
          type: job.job_type,
          status: job.status,
          progress: job.progress,
        });
      }

      const overallProgress = Math.floor(totalProgress / jobs.length);

      return {
        overall: overallProgress,
        jobs: jobProgress,
        malware_scan: mediaFile.malware_scan_status,
        processing: mediaFile.processing_status,
      };
    } catch (error) {
      logger.error("Failed to calculate processing progress", {
        mediaFileId: mediaFile.id,
        error: error.message,
      });
      return { overall: 0, jobs: [] };
    }
  }

  /**
   * Estimate processing time based on file type and size
   */
  estimateProcessingTime(mediaType, fileSize) {
    const baseTimes = {
      profile: 30, // 30 seconds
      cover: 45, // 45 seconds
      post: 60, // 1 minute
      live_photo: 120, // 2 minutes
    };

    const baseTime = baseTimes[mediaType] || 60;

    // Add time based on file size (1 second per MB)
    const sizeTime = Math.floor(fileSize / (1024 * 1024));

    const totalSeconds = baseTime + sizeTime;
    const estimatedCompletion = new Date(Date.now() + totalSeconds * 1000);

    return {
      estimated_seconds: totalSeconds,
      estimated_completion: estimatedCompletion.toISOString(),
    };
  }

  /**
   * Get total file size from array of files
   */
  getTotalFileSize(files) {
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Cleanup failed upload
   */
  async cleanupFailedUpload(mediaFileId) {
    try {
      const mediaFile = await MediaFile.findByPk(mediaFileId);
      if (!mediaFile) return;

      // Remove file from filesystem
      if (await fs.pathExists(mediaFile.storage_path)) {
        await fs.remove(mediaFile.storage_path);
      }

      // Remove variants
      const variants = await require("../models").MediaVariant.findByMediaFile(
        mediaFileId
      );
      for (const variant of variants) {
        if (await fs.pathExists(variant.storage_path)) {
          await fs.remove(variant.storage_path);
        }
      }

      // Mark as deleted
      await mediaFile.softDelete();

      logger.info("Failed upload cleaned up", {
        mediaFileId,
        storagePath: mediaFile.storage_path,
      });
    } catch (error) {
      logger.error("Failed to cleanup failed upload", {
        mediaFileId,
        error: error.message,
      });
    }
  }

  /**
   * Get user media statistics
   */
  async getUserMediaStats(userId) {
    try {
      const stats = await MediaFile.findAll({
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

      const totalFiles = await MediaFile.count({
        where: { user_id: userId, is_deleted: false },
      });

      const totalSize = await MediaFile.sum("file_size", {
        where: { user_id: userId, is_deleted: false },
      });

      return {
        total_files: totalFiles,
        total_size: totalSize || 0,
        breakdown: stats,
      };
    } catch (error) {
      logger.error("Failed to get user media stats", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new UploadService();

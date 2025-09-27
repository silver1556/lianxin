const Queue = require("bull");
const Redis = require("ioredis");
const config = require("../config/app.config");
const logger = require("../utils/logger.util");

// Import processors
const imageProcessor = require("./image-processor.service");
const videoProcessor = require("./video-processor.service");
const clamavService = require("./clamav.service");
const storageService = require("./alibaba-storage.service");

/**
 * Queue Service
 * Handles background processing of media files using Bull queues
 */
class QueueService {
  constructor() {
    this.redis = null;
    this.queues = {};
    this.isInitialized = false;
  }

  /**
   * Initialize queue service
   */
  async initialize() {
    try {
      // Initialize Redis connection for queues
      this.redis = new Redis({
        host: config.queue.redis.host,
        port: config.queue.redis.port,
        password: config.queue.redis.password,
        db: config.queue.redis.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.redis.connect();

      // Initialize queues
      this.initializeQueues();

      // Setup queue processors
      this.setupProcessors();

      this.isInitialized = true;
      logger.info("Queue service initialized successfully", {
        redis: {
          host: config.queue.redis.host,
          port: config.queue.redis.port,
          db: config.queue.redis.db,
        },
        queues: Object.keys(this.queues),
      });
    } catch (error) {
      logger.error("Failed to initialize queue service", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initialize all queues
   */
  initializeQueues() {
    const queueOptions = {
      redis: {
        host: config.queue.redis.host,
        port: config.queue.redis.port,
        password: config.queue.redis.password,
        db: config.queue.redis.db,
      },
      defaultJobOptions: {
        removeOnComplete: config.queue.removeOnComplete,
        removeOnFail: config.queue.removeOnFail,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    };

    // Create queues for different processing types
    this.queues.malwareScan = new Queue("malware-scan", queueOptions);
    this.queues.imageProcessing = new Queue("image-processing", queueOptions);
    this.queues.videoProcessing = new Queue("video-processing", queueOptions);
    this.queues.storageUpload = new Queue("storage-upload", queueOptions);
    this.queues.cleanup = new Queue("cleanup", queueOptions);

    // Setup queue event listeners
    this.setupQueueEventListeners();
  }

  /**
   * Setup queue processors
   */
  setupProcessors() {
    // Malware scan processor
    this.queues.malwareScan.process(config.queue.concurrency, async (job) => {
      return await this.processMalwareScan(job);
    });

    // Image processing processor
    this.queues.imageProcessing.process(
      config.queue.concurrency,
      async (job) => {
        return await this.processImageJob(job);
      }
    );

    // Video processing processor
    this.queues.videoProcessing.process(2, async (job) => {
      // Lower concurrency for video
      return await this.processVideoJob(job);
    });

    // Storage upload processor
    this.queues.storageUpload.process(config.queue.concurrency, async (job) => {
      return await this.processStorageUpload(job);
    });

    // Cleanup processor
    this.queues.cleanup.process(1, async (job) => {
      return await this.processCleanup(job);
    });
  }

  /**
   * Setup queue event listeners
   */
  setupQueueEventListeners() {
    Object.entries(this.queues).forEach(([queueName, queue]) => {
      queue.on("completed", (job, result) => {
        logger.info(`Queue job completed`, {
          queue: queueName,
          jobId: job.id,
          processingTime: Date.now() - job.timestamp,
        });
      });

      queue.on("failed", (job, err) => {
        logger.error(`Queue job failed`, {
          queue: queueName,
          jobId: job.id,
          error: err.message,
          attempts: job.attemptsMade,
        });
      });

      queue.on("stalled", (job) => {
        logger.warn(`Queue job stalled`, {
          queue: queueName,
          jobId: job.id,
        });
      });
    });
  }

  /**
   * Add malware scan job
   */
  async addMalwareScanJob(data, options = {}) {
    try {
      const job = await this.queues.malwareScan.add("scan-file", data, {
        priority: options.priority || 10, // High priority for security
        delay: options.delay || 0,
        ...options,
      });

      logger.info("Malware scan job added", {
        jobId: job.id,
        filePath: data.filePath,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add malware scan job", {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add image processing job
   */
  async addImageProcessingJob(data, options = {}) {
    try {
      const job = await this.queues.imageProcessing.add("process-image", data, {
        priority: options.priority || 5,
        delay: options.delay || 0,
        ...options,
      });

      logger.info("Image processing job added", {
        jobId: job.id,
        mediaFileId: data.mediaFileId,
        mediaType: data.mediaType,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add image processing job", {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add video processing job
   */
  async addVideoProcessingJob(data, options = {}) {
    try {
      const job = await this.queues.videoProcessing.add("process-video", data, {
        priority: options.priority || 3,
        delay: options.delay || 0,
        timeout: 600000, // 10 minutes timeout for video processing
        ...options,
      });

      logger.info("Video processing job added", {
        jobId: job.id,
        mediaFileId: data.mediaFileId,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add video processing job", {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add storage upload job
   */
  async addStorageUploadJob(data, options = {}) {
    try {
      const job = await this.queues.storageUpload.add(
        "upload-to-storage",
        data,
        {
          priority: options.priority || 7,
          delay: options.delay || 0,
          ...options,
        }
      );

      logger.info("Storage upload job added", {
        jobId: job.id,
        fileCount: data.files ? data.files.length : 1,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add storage upload job", {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process malware scan job
   */
  async processMalwareScan(job) {
    try {
      const { filePath, mediaFileId } = job.data;

      job.progress(10);

      // Perform malware scan
      const scanResult = await clamavService.scanFile(filePath);

      job.progress(90);

      // Update database with scan result
      const { MediaFile } = require("../models");
      await MediaFile.update(
        {
          malware_scan_status: scanResult.isInfected ? "infected" : "clean",
          malware_scan_result: scanResult,
        },
        { where: { id: mediaFileId } }
      );

      job.progress(100);

      if (scanResult.isInfected) {
        // Schedule file deletion if infected
        await this.addCleanupJob({
          filePaths: [filePath],
          reason: "malware_detected",
          mediaFileId,
        });

        throw new Error(`Malware detected: ${scanResult.viruses.join(", ")}`);
      }

      return {
        success: true,
        scanResult,
        mediaFileId,
      };
    } catch (error) {
      logger.error("Malware scan job failed", {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process image processing job
   */
  async processImageJob(job) {
    try {
      const { filePath, mediaFileId, mediaType, userId } = job.data;

      job.progress(10);

      // Process image
      const result = await imageProcessor.processImage(filePath, mediaType);

      job.progress(60);

      // Upload variants to storage
      const uploadJobs = [];
      for (const variant of result.variants) {
        const remotePath = storageService.generateStoragePath(
          userId,
          mediaType,
          path.basename(variant.storage_path),
          variant.variant_type
        );

        uploadJobs.push({
          localPath: variant.storage_path,
          remotePath,
          variant,
          mediaFileId,
        });
      }

      // Add storage upload jobs
      await this.addStorageUploadJob({
        files: uploadJobs,
        mediaFileId,
        type: "image_variants",
      });

      job.progress(80);

      // Update database with processing result
      const { MediaFile, MediaMetadata } = require("../models");

      await MediaFile.update(
        { processing_status: "completed" },
        { where: { id: mediaFileId } }
      );

      await MediaMetadata.create({
        media_file_id: mediaFileId,
        original_width: result.metadata.width,
        original_height: result.metadata.height,
        color_space: result.metadata.colorSpace,
        exif_data: result.metadata.exif,
        dominant_colors: await imageProcessor.extractDominantColors(filePath),
      });

      job.progress(100);

      // Schedule cleanup of temporary files
      await this.addCleanupJob({
        filePaths: [filePath, ...result.variants.map((v) => v.storage_path)],
        reason: "processing_completed",
        delay: 300000, // 5 minutes delay
      });

      return {
        success: true,
        variantCount: result.variants.length,
        processingTime: result.processingTime,
      };
    } catch (error) {
      logger.error("Image processing job failed", {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process video processing job
   */
  async processVideoJob(job) {
    try {
      const { filePath, mediaFileId, userId } = job.data;

      job.progress(10);

      // Process video
      const result = await videoProcessor.processVideo(
        filePath,
        path.dirname(filePath),
        {
          onProgress: (progress) => {
            job.progress(10 + (progress.percent || 0) * 0.6); // 10-70%
          },
        }
      );

      job.progress(70);

      // Upload variants to storage
      const uploadJobs = [];

      // Upload video variants
      for (const variant of result.variants) {
        const remotePath = storageService.generateStoragePath(
          userId,
          "post",
          path.basename(variant.storage_path),
          variant.variant_type
        );

        uploadJobs.push({
          localPath: variant.storage_path,
          remotePath,
          variant,
          mediaFileId,
        });
      }

      // Upload thumbnails
      for (const thumbnail of result.thumbnails) {
        const remotePath = storageService.generateStoragePath(
          userId,
          "post",
          path.basename(thumbnail.storage_path),
          thumbnail.variant_type
        );

        uploadJobs.push({
          localPath: thumbnail.storage_path,
          remotePath,
          variant: thumbnail,
          mediaFileId,
        });
      }

      // Add storage upload jobs
      await this.addStorageUploadJob({
        files: uploadJobs,
        mediaFileId,
        type: "video_variants",
      });

      job.progress(85);

      // Update database
      const { MediaFile, MediaMetadata } = require("../models");

      await MediaFile.update(
        { processing_status: "completed" },
        { where: { id: mediaFileId } }
      );

      await MediaMetadata.create({
        media_file_id: mediaFileId,
        original_width: result.metadata.width,
        original_height: result.metadata.height,
        duration: result.metadata.duration,
        frame_rate: result.metadata.frameRate,
        bitrate: result.metadata.bitrate,
        has_audio: result.metadata.hasAudio,
        video_codec: result.metadata.videoCodec,
        audio_codec: result.metadata.audioCodec,
      });

      job.progress(100);

      // Schedule cleanup
      const allFiles = [
        filePath,
        ...result.variants.map((v) => v.storage_path),
        ...result.thumbnails.map((t) => t.storage_path),
      ];

      await this.addCleanupJob({
        filePaths: allFiles,
        reason: "processing_completed",
        delay: 300000, // 5 minutes delay
      });

      return {
        success: true,
        variantCount: result.variants.length,
        thumbnailCount: result.thumbnails.length,
        processingTime: result.processingTime,
      };
    } catch (error) {
      logger.error("Video processing job failed", {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process storage upload job
   */
  async processStorageUpload(job) {
    try {
      const { files, mediaFileId, type } = job.data;

      job.progress(10);

      const uploadResults = [];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          const uploadResult = await storageService.uploadFile(
            file.localPath,
            file.remotePath,
            {
              contentType: storageService.getMimeType(file.localPath),
            }
          );

          // Save variant to database
          const { MediaVariant } = require("../models");
          await MediaVariant.create({
            media_file_id: mediaFileId,
            ...file.variant,
            cdn_url: uploadResult.url,
          });

          uploadResults.push({
            ...file,
            uploadResult,
          });

          job.progress(10 + ((i + 1) / totalFiles) * 80);
        } catch (uploadError) {
          logger.error("Individual file upload failed", {
            file: file.localPath,
            error: uploadError.message,
          });
        }
      }

      job.progress(90);

      // Update main media file with CDN URL (use first variant)
      if (uploadResults.length > 0) {
        const { MediaFile } = require("../models");
        await MediaFile.update(
          { cdn_url: uploadResults[0].uploadResult.url },
          { where: { id: mediaFileId } }
        );
      }

      job.progress(100);

      return {
        success: true,
        uploadedFiles: uploadResults.length,
        totalFiles,
        type,
      };
    } catch (error) {
      logger.error("Storage upload job failed", {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process cleanup job
   */
  async processCleanup(job) {
    try {
      const { filePaths, reason, mediaFileId } = job.data;

      let cleanedCount = 0;

      for (const filePath of filePaths) {
        try {
          if (await require("fs-extra").pathExists(filePath)) {
            await require("fs-extra").remove(filePath);
            cleanedCount++;
          }
        } catch (cleanupError) {
          logger.warn("Failed to cleanup file", {
            filePath,
            error: cleanupError.message,
          });
        }
      }

      logger.info("Cleanup job completed", {
        reason,
        totalFiles: filePaths.length,
        cleanedFiles: cleanedCount,
        mediaFileId,
      });

      return {
        success: true,
        cleanedFiles: cleanedCount,
        totalFiles: filePaths.length,
        reason,
      };
    } catch (error) {
      logger.error("Cleanup job failed", {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add cleanup job
   */
  async addCleanupJob(data, options = {}) {
    try {
      const job = await this.queues.cleanup.add("cleanup-files", data, {
        priority: options.priority || 1, // Low priority
        delay: options.delay || 0,
        ...options,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add cleanup job", {
        data,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const stats = {};

      for (const [queueName, queue] of Object.entries(this.queues)) {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        stats[queueName] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total:
            waiting.length + active.length + completed.length + failed.length,
        };
      }

      return stats;
    } catch (error) {
      logger.error("Failed to get queue statistics", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clean up completed jobs
   */
  async cleanupCompletedJobs() {
    try {
      let totalCleaned = 0;

      for (const [queueName, queue] of Object.entries(this.queues)) {
        const cleaned = await queue.clean(24 * 60 * 60 * 1000, "completed"); // 24 hours
        totalCleaned += cleaned.length;
      }

      logger.info("Queue cleanup completed", {
        totalCleaned,
      });

      return totalCleaned;
    } catch (error) {
      logger.error("Queue cleanup failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Close all queues
   */
  async close() {
    try {
      for (const [queueName, queue] of Object.entries(this.queues)) {
        await queue.close();
      }

      if (this.redis) {
        await this.redis.quit();
      }

      logger.info("Queue service closed successfully");
    } catch (error) {
      logger.error("Failed to close queue service", {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new QueueService();

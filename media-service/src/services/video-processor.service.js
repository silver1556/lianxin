const { spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const util = require("util");
const config = require("../config/app.config");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

const execAsync = util.promisify(require("child_process").exec);

/**
 * Modern Video Processor Service
 * Uses native FFmpeg commands instead of deprecated fluent-ffmpeg
 */
class VideoProcessorService {
  constructor() {
    this.supportedFormats = [
      "mp4",
      "avi",
      "mov",
      "wmv",
      "flv",
      "webm",
      "mkv",
      "3gp",
    ];
    this.outputFormat = "mp4";
    this.maxDuration = config.videoProcessing.maxDuration;
    this.resolutions = config.videoProcessing.resolutions;

    this.ffmpegPath = this.detectFFmpegPath();
    this.ffprobePath = this.detectFFprobePath();
  }

  /**
   * Detect FFmpeg installation path
   */
  detectFFmpegPath() {
    try {
      // Use ffmpeg-static if available (preferred for consistency)
      const ffmpegStatic = require("ffmpeg-static");
      if (ffmpegStatic) {
        logger.info("Using ffmpeg-static binary", { path: ffmpegStatic });
        return ffmpegStatic;
      }
    } catch (err) {
      logger.debug("ffmpeg-static not available, falling back to system PATH", {
        error: err.message,
      });
    }
    return "ffmpeg"; // fallback
  }

  /**
   * Detect FFprobe installation path
   */
  detectFFprobePath() {
    try {
      const ffprobeStatic = require("ffprobe-static");
      if (ffprobeStatic?.path) {
        logger.info("Using ffprobe-static binary", {
          path: ffprobeStatic.path,
        });
        return ffprobeStatic.path;
      }
    } catch {
      logger.debug("ffprobe-static not available, falling back to system PATH");
    }
    return "ffprobe"; // fallback
  }

  /**
   * Verify FFmpeg installation and capabilities
   */
  async verifyFFmpegInstallation() {
    try {
      const { stdout: versionOutput } = await execAsync(
        `"${this.ffmpegPath}" -version`
      );

      // Parse version information
      const versionMatch = versionOutput.match(/ffmpeg version (\S+)/);
      const version = versionMatch ? versionMatch[1] : "unknown";

      // Reliable codec detection
      const { stdout: codecsOutput } = await execAsync(
        `"${this.ffmpegPath}" -codecs`
      );
      const hasLibx264 = codecsOutput.includes("libx264");
      const hasAac =
        codecsOutput.includes("aac") || codecsOutput.includes("libfdk_aac");
      const hasLibvpx = codecsOutput.includes("libvpx");

      logger.info("FFmpeg verification successful", {
        version,
        path: this.ffmpegPath,
        hasLibx264,
        hasAac,
        hasLibvpx,
      });

      return {
        isValid: true,
        version,
        codecs: { hasLibx264, hasAac, hasLibvpx },
      };
    } catch (error) {
      logger.error("FFmpeg verification failed", {
        path: this.ffmpegPath,
        error: error.message,
      });

      throw new AppError(
        `FFmpeg not found or invalid at path: ${this.ffmpegPath}`,
        500,
        "FFMPEG_NOT_FOUND"
      );
    }
  }

  /**
   * Verify FFprobe installation and capabilities
   */
  async verifyFFprobeInstallation() {
    try {
      const { stdout: versionOutput } = await execAsync(
        `"${this.ffprobePath}" -version`
      );

      // Parse version information
      const versionMatch = versionOutput.match(/ffprobe version (\S+)/);
      const version = versionMatch ? versionMatch[1] : "unknown";

      // Check for some useful capabilities
      const { stdout: codecsOutput } = await execAsync(
        `"${this.ffprobePath}" -codecs`
      );
      const { stdout: formatsOutput } = await execAsync(
        `"${this.ffprobePath}" -formats`
      );

      const hasH264 = codecsOutput.includes("h264");
      const hasAac = codecsOutput.includes("aac");
      const hasVp9 = codecsOutput.includes("vp9");

      logger.info("FFprobe verification successful", {
        version,
        path: this.ffprobePath,
        hasH264,
        hasAac,
        hasVp9,
      });

      return {
        isValid: true,
        version,
        codecs: { hasH264, hasAac, hasVp9 },
        formats: formatsOutput.split("\n").slice(0, 10), // just a preview
      };
    } catch (error) {
      logger.error("FFprobe verification failed", {
        path: this.ffprobePath,
        error: error.message,
      });

      throw new AppError(
        `FFprobe not found or invalid at path: ${this.ffprobePath}`,
        500,
        "FFPROBE_NOT_FOUND"
      );
    }
  }

  /**
   * Initialize service and verify FFmpeg installation
   */
  async initialize() {
    await this.verifyFFmpegInstallation();

    try {
      await this.verifyFFprobeInstallation();
      this.ffprobeAvailable = true;
    } catch (err) {
      logger.warn("FFprobe verification failed, continuing without metadata", {
        error: err.message,
      });
      this.ffprobeAvailable = false;
    }

    logger.info("Video processor initialized", {
      ffmpeg: this.ffmpegPath,
      ffprobe: this.ffprobePath,
      ffprobeAvailable: this.ffprobeAvailable !== false,
    });
  }

  /**
   * Execute FFmpeg command with promise support
   */
  async executeFFmpeg(args, options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(
        this.ffmpegPath,
        ["-hide_banner", ...args, "-progress", "pipe:1"],
        {
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      let stdout = "",
        stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        const str = data.toString();
        stderr += str;

        // Parse progress if callback provided
        if (options.onProgress)
          this.parseStructuredProgress(
            str,
            options.onProgress,
            options.totalDuration
          );
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(`FFmpeg process exited with code ${code}: ${stderr}`)
          );
        }
      });

      process.on("error", (error) => {
        reject(
          new AppError(`Failed to start FFmpeg process: ${error.message}`)
        );
      });
    });
  }

  /**
   * Parse FFmpeg progress output
   */
  parseStructuredProgress(data, callback, totalDuration = null) {
    const lines = data.split("\n");
    const progress = {};
    lines.forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) progress[key.trim()] = value.trim();
    });

    if (progress.out_time_ms && callback) {
      const timeInSeconds = parseInt(progress.out_time_ms, 10) / 1_000_000;
      const percent = totalDuration
        ? Math.min((timeInSeconds / totalDuration) * 100, 100).toFixed(2)
        : null;
      callback({
        timeInSeconds,
        percentCompleted: percent,
        status: "processing",
      });
    }
  }

  /**
   * Execute FFprobe command
   */
  async executeFFprobe(args) {
    if (!this.ffprobePath) {
      throw new AppError(
        "FFprobe path not set. Ensure FFprobe is installed.",
        500,
        "FFPROBE_NOT_FOUND"
      );
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.ffprobePath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(`FFprobe process exited with code ${code}: ${stderr}`)
          );
        }
      });

      process.on("error", (error) => {
        reject(
          new AppError(`Failed to start FFprobe process: ${error.message}`)
        );
      });
    });
  }

  /**
   * Process video with multiple resolutions
   */
  async processVideo(inputPath, outputDir, options = {}) {
    try {
      const startTime = Date.now();

      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);

      // Validate video
      const validation = await this.validateVideo(inputPath, metadata);
      if (!validation.isValid) {
        throw new AppError(
          `Video validation failed: ${validation.errors.join(", ")}`,
          400,
          "VIDEO_VALIDATION_ERROR"
        );
      }

      // Generate thumbnails
      const thumbnails = await this.generateThumbnails(
        inputPath,
        outputDir,
        metadata,
        options // options.onProgress will propagate
      );

      // Process video in multiple resolutions
      const variants = await this.generateVideoVariants(
        inputPath,
        outputDir,
        metadata,
        options
      );

      const processingTime = Date.now() - startTime;

      logger.info("Video processing completed", {
        inputPath,
        variantCount: variants.length,
        thumbnailCount: thumbnails.length,
        processingTime,
        originalDuration: metadata.duration,
      });

      return {
        variants,
        thumbnails,
        metadata,
        processingTime,
      };
    } catch (error) {
      logger.error("Video processing failed", {
        inputPath,
        error: error.message,
        stack: error.stack,
      });
      throw new AppError(
        "Video processing failed",
        500,
        "VIDEO_PROCESSING_ERROR"
      );
    }
  }

  /**
   * Get video metadata using ffprobe
   */
  async getVideoMetadata(videoPath) {
    try {
      const args = [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        videoPath,
      ];

      const { stdout } = await this.executeFFprobe(args);
      const metadata = JSON.parse(stdout);

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );
      const audioStream = metadata.streams.find(
        (stream) => stream.codec_type === "audio"
      );

      const duration = parseFloat(metadata.format.duration) || 0;
      const width = videoStream?.width || 0;
      const height = videoStream?.height || 0;

      return {
        duration,
        width,
        height,
        frameRate: videoStream?.r_frame_rate || "30/1",
        bitrate: parseInt(metadata.format.bit_rate) || 0,
        format: metadata.format.format_name,
        size: parseInt(metadata.format.size) || 0,
        hasAudio: !!audioStream,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        aspectRatio: width && height ? (width / height).toFixed(2) : null,
      };
    } catch (error) {
      logger.error("Failed to get video metadata", {
        videoPath,
        error: error.message,
      });
      throw new AppError(
        "Failed to get video metadata",
        500,
        "VIDEO_METADATA_ERROR"
      );
    }
  }

  /**
   * Generate video variants in multiple resolutions
   */
  async generateVideoVariants(inputPath, outputDir, metadata, options = {}) {
    const baseFilename = path.basename(inputPath, path.extname(inputPath));
    const targetResolutions = this.selectOptimalResolutions(
      metadata.width,
      metadata.height
    );

    const variantPromises = targetResolutions.map((res) =>
      this.generateVideoVariant(
        inputPath,
        outputDir,
        baseFilename,
        res,
        metadata,
        options
      )
    );

    const results = await Promise.allSettled(variantPromises);
    return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  }

  /**
   * Generate individual video variant
   */
  async generateVideoVariant(
    inputPath,
    outputDir,
    baseFilename,
    resolution,
    metadata,
    options = {}
  ) {
    try {
      const outputFilename = `${baseFilename}_${resolution.name}.mp4`;
      const outputPath = path.join(outputDir, outputFilename);
      const startTime = Date.now();

      const args = [
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-vf",
        `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2`,
        "-b:v",
        resolution.bitrate,
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-y", // Overwrite output file
      ];

      // Add audio processing
      if (metadata.hasAudio) {
        args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2");
      } else {
        args.push("-an"); // No audio
      }

      args.push(outputPath);

      const progressCallback = options.onProgress
        ? (progress) => {
            options.onProgress({
              resolution: resolution.name,
              ...progress,
            });
          }
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: metadata.duration,
      });

      const processingTime = Date.now() - startTime;
      const outputStats = await fs.stat(outputPath);

      return {
        variant_type: resolution.name,
        format: "mp4",
        width: resolution.width,
        height: resolution.height,
        file_size: outputStats.size,
        bitrate: resolution.bitrate,
        duration: metadata.duration,
        storage_path: outputPath,
        processing_time: processingTime,
        is_optimized: true,
      };
    } catch (error) {
      logger.error("Failed to generate video variant", {
        resolution: resolution.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate video thumbnails
   */
  async generateThumbnails(inputPath, outputDir, metadata, options = {}) {
    try {
      const thumbnails = [];
      const baseFilename = path.basename(inputPath, path.extname(inputPath));
      const thumbnailCount = config.videoProcessing.thumbnailCount || 3;
      const minInterval = config.videoProcessing.minThumbnailInterval || 1; // minimum seconds between thumbnails

      // Smart interval: avoid duplicates for short videos
      const interval = Math.max(
        metadata.duration / (thumbnailCount + 1),
        minInterval
      );

      for (let i = 1; i <= thumbnailCount; i++) {
        const timestamp = Math.min(interval * i, metadata.duration - 0.1); // avoid exceeding duration
        const thumbnailFilename = `${baseFilename}_thumb_${i}.jpg`;
        const thumbnailPath = path.join(outputDir, thumbnailFilename);

        await this.generateThumbnailAtTime(
          inputPath,
          thumbnailPath,
          timestamp,
          options
        );

        const stats = await fs.stat(thumbnailPath);

        thumbnails.push({
          variant_type: `thumbnail_${i}`,
          format: "jpeg",
          timestamp,
          file_size: stats.size,
          storage_path: thumbnailPath,
        });

        if (options.onProgress) {
          options.onProgress({
            variant: `thumbnail_${i}`,
            index: i,
            total: thumbnailCount,
            percentCompleted: ((i / thumbnailCount) * 100).toFixed(2),
            timestamp,
          });
        }
      }

      return thumbnails;
    } catch (error) {
      logger.error("Failed to generate video thumbnails", {
        inputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate thumbnail at specific time with configurable scale
   */
  async generateThumbnailAtTime(
    inputPath,
    outputPath,
    timestamp,
    options = {}
  ) {
    const scaleWidth = config.videoProcessing.thumbnailWidth || 640;
    const scaleHeight = config.videoProcessing.thumbnailHeight || 360;

    const args = [
      "-i",
      inputPath,
      "-ss",
      timestamp.toString(),
      "-vframes",
      "1",
      "-vf",
      `scale=${scaleWidth}:${scaleHeight}:force_original_aspect_ratio=decrease`,
      "-f",
      "image2",
      "-y",
      outputPath,
    ];

    await this.executeFFmpeg(args, {
      onProgress: options.onProgress,
      totalDuration: 0,
    });
  }

  /**
   * Process live photo video component
   */
  async processLivePhotoVideo(
    inputPath,
    outputDir,
    baseFilename,
    options = {}
  ) {
    try {
      const outputFilename = `${baseFilename}_live.mp4`;
      const outputPath = path.join(outputDir, outputFilename);

      const args = [
        "-i",
        inputPath,
        "-t",
        "3", // 3 seconds duration
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-vf",
        "scale=640:640:force_original_aspect_ratio=decrease,pad=640:640:(ow-iw)/2:(oh-ih)/2",
        "-b:v",
        "1000k",
        "-b:a",
        "64k",
        "-preset",
        "fast",
        "-crf",
        "28",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-y",
        outputPath,
      ];

      // Progress callback for live photo
      const progressCallback = options.onProgress
        ? (progress) =>
            options.onProgress({ variant: "livePhoto", ...progress })
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: 3, // 3 seconds video
      });

      const stats = await fs.stat(outputPath);

      return {
        outputPath,
        fileSize: stats.size,
        duration: 3,
        format: "mp4",
      };
    } catch (error) {
      logger.error("Live photo video processing failed", {
        inputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Select optimal resolutions based on original video dimensions
   */
  selectOptimalResolutions(originalWidth, originalHeight) {
    const selectedResolutions = this.resolutions.filter(
      (r) => r.width <= originalWidth && r.height <= originalHeight
    );
    if (!selectedResolutions.length)
      selectedResolutions.push(this.resolutions[0]);
    return selectedResolutions;
  }

  /**
   * Validate video file
   */
  async validateVideo(filePath, metadata = null) {
    try {
      const videoMetadata = metadata || (await this.getVideoMetadata(filePath));
      const fileStats = await fs.stat(filePath);

      const validation = {
        isValid: true,
        duration: videoMetadata.duration,
        width: videoMetadata.width,
        height: videoMetadata.height,
        size: fileStats.size,
        errors: [],
      };

      // Check duration
      if (videoMetadata.duration > this.maxDuration) {
        validation.errors.push(
          `Video duration exceeds maximum (${this.maxDuration} seconds)`
        );
      }

      // Check file size
      if (fileStats.size > config.maxFileSize) {
        validation.errors.push(
          `File size exceeds maximum (${config.maxFileSize} bytes)`
        );
      }

      // Check dimensions
      if (
        videoMetadata.width > config.videoProcessing.maxDimension ||
        videoMetadata.height > config.videoProcessing.maxDimension
      ) {
        validation.errors.push(
          `Video dimensions exceed maximum (${config.videoProcessing.maxDimension}x${config.videoProcessing.maxDimension})`
        );
      }

      // Check if video has valid streams
      if (!videoMetadata.width || !videoMetadata.height) {
        validation.errors.push("Invalid video streams");
      }

      validation.isValid = validation.errors.length === 0;

      return validation;
    } catch (error) {
      logger.error("Video validation failed", {
        filePath,
        error: error.message,
      });

      return {
        isValid: false,
        errors: ["Invalid video file"],
      };
    }
  }

  /**
   * Extract video frame at specific time
   */
  async extractFrame(inputPath, outputPath, timestamp = 0) {
    const args = [
      "-i",
      inputPath,
      "-ss",
      timestamp.toString(),
      "-vframes",
      "1",
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease",
      "-f",
      "image2",
      "-y",
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }

  /**
   * Compress video for web delivery
   */
  async compressForWeb(inputPath, outputPath, options = {}) {
    try {
      const { maxBitrate = "2000k", crf = 23, preset = "fast" } = options;
      const startTime = Date.now();

      const args = [
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-b:v",
        maxBitrate,
        "-preset",
        preset,
        "-crf",
        crf.toString(),
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-y",
        outputPath,
      ];

      const progressCallback = options.onProgress
        ? (progress) => options.onProgress({ variant: "compress", ...progress })
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: options.totalDuration,
      });

      const processingTime = Date.now() - startTime;
      const outputStats = await fs.stat(outputPath);

      return {
        outputPath,
        fileSize: outputStats.size,
        processingTime,
      };
    } catch (error) {
      logger.error("Video compression failed", {
        inputPath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create video preview (first few seconds) with configurable scale
   */
  async createPreview(inputPath, outputPath, duration = 15, options = {}) {
    try {
      const scaleWidth = config.videoProcessing.previewWidth || 720;
      const scaleHeight = config.videoProcessing.previewHeight || 720;

      const args = [
        "-i",
        inputPath,
        "-t",
        duration.toString(),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-b:v",
        "1500k",
        "-b:a",
        "128k",
        "-vf",
        `scale=${scaleWidth}:${scaleHeight}:force_original_aspect_ratio=decrease,pad=${scaleWidth}:${scaleHeight}:(ow-iw)/2:(oh-ih)/2`,
        "-preset",
        "fast",
        "-crf",
        "25",
        "-movflags",
        "+faststart",
        "-y",
        outputPath,
      ];

      const progressCallback = options.onProgress
        ? (progress) => options.onProgress({ variant: "preview", ...progress })
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: duration,
      });

      const stats = await fs.stat(outputPath);
      return { outputPath, fileSize: stats.size, duration };
    } catch (error) {
      logger.error("Video preview creation failed", {
        inputPath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Convert video to different format
   */
  async convertFormat(
    inputPath,
    outputPath,
    targetFormat = "mp4",
    options = {}
  ) {
    try {
      if (!this.supportedFormats.includes(targetFormat))
        throw new AppError(
          `Unsupported format: ${targetFormat}`,
          400,
          "UNSUPPORTED_FORMAT"
        );

      const args = ["-i", inputPath];

      switch (targetFormat) {
        case "mp4":
          args.push(
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart"
          );
          break;
        case "webm":
          args.push("-c:v", "libvpx-vp9", "-c:a", "libopus");
          break;
        case "avi":
          args.push("-c:v", "libx264", "-c:a", "mp3");
          break;
      }

      args.push("-f", targetFormat, "-y", outputPath);

      const progressCallback = options.onProgress
        ? (progress) =>
            options.onProgress({
              variant: `convert_${targetFormat}`,
              ...progress,
            })
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: options.totalDuration,
      });

      const stats = await fs.stat(outputPath);

      return {
        outputPath,
        fileSize: stats.size,
        format: targetFormat,
      };
    } catch (error) {
      logger.error("Video format conversion failed", {
        inputPath,
        outputPath,
        targetFormat,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Add watermark to video
   */
  async addWatermark(inputPath, outputPath, watermarkPath, options = {}) {
    try {
      const { position = "bottom-right", opacity = 0.7, scale = 0.2 } = options;

      const watermarkFilter = this.buildWatermarkFilter(
        position,
        opacity,
        scale
      );

      const args = [
        "-i",
        inputPath,
        "-i",
        watermarkPath,
        "-filter_complex",
        watermarkFilter,
        "-c:v",
        "libx264",
        "-c:a",
        "copy",
        "-preset",
        "fast",
        "-movflags",
        "+faststart",
        "-y",
        outputPath,
      ];

      const progressCallback = options.onProgress
        ? (progress) =>
            options.onProgress({ variant: "watermark", ...progress })
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: options.totalDuration,
      });

      const stats = await fs.stat(outputPath);

      return {
        outputPath,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error("Video watermark failed", {
        inputPath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Build watermark filter for FFmpeg
   */
  buildWatermarkFilter(position, opacity, scale) {
    const positions = {
      "top-left": "10:10",
      "top-right": "main_w-overlay_w-10:10",
      "bottom-left": "10:main_h-overlay_h-10",
      "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
      center: "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
    };

    const pos = positions[position] || positions["bottom-right"];

    return `[1:v]scale=iw*${scale}:ih*${scale}[watermark];[0:v][watermark]overlay=${pos}:format=auto,format=yuv420p`;
  }

  /**
   * Optimize video for streaming
   */
  async optimizeForStreaming(inputPath, outputPath, options = {}) {
    try {
      const args = [
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-preset",
        "slow",
        "-crf",
        "20",
        "-movflags",
        "+faststart",
        "-profile:v",
        "high",
        "-level",
        "4.0",
        "-pix_fmt",
        "yuv420p",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-y",
        outputPath,
      ];

      const progressCallback = options.onProgress
        ? (progress) =>
            options.onProgress({ variant: "streaming", ...progress })
        : undefined;

      await this.executeFFmpeg(args, {
        onProgress: progressCallback,
        totalDuration: options.totalDuration,
      });

      const stats = await fs.stat(outputPath);

      return {
        outputPath,
        fileSize: stats.size,
      };
    } catch (error) {
      logger.error("Video streaming optimization failed", {
        inputPath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get system information for debugging
   */
  async getSystemInfo() {
    try {
      const ffmpegInfo = await this.verifyFFmpegInstallation();

      let ffprobeInfo = null;
      try {
        ffprobeInfo = await this.verifyFFprobeInstallation();
        this.ffprobeAvailable = true;
      } catch (err) {
        logger.warn(
          "FFprobe verification failed, continuing without metadata",
          {
            error: err.message,
          }
        );
        this.ffprobeAvailable = false;
      }

      return {
        ffmpeg: ffmpegInfo,
        ffprobe: ffprobeInfo,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        supportedFormats: this.supportedFormats,
        resolutions: this.resolutions,
      };
    } catch (error) {
      logger.error("Failed to get system info", { error: error.message });
      throw error;
    }
  }

  /**
   * Clean up temporary video files
   */
  async cleanup(filePaths) {
    try {
      await Promise.all(
        filePaths.map(async (filePath) => {
          if (await fs.pathExists(filePath)) await fs.remove(filePath);
        })
      );
      logger.debug("Video cleanup completed", { filePaths });
    } catch (error) {
      logger.warn("Video cleanup failed", { filePaths, error: error.message });
    }
  }
}

module.exports = new VideoProcessorService();

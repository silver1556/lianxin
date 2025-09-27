const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const fileType = require("file-type");
const sizeOf = require("image-size");
const config = require("../config/app.config");
const logger = require("../../../../shared/utils/logger.util");

/**
 * File Utility Class
 * Handles file validation, hashing, and metadata extraction
 */
class FileUtil {
  /**
   * Generate file hash (SHA-256)
   */
  async generateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash("sha256").update(fileBuffer).digest("hex");
    } catch (error) {
      logger.error("Failed to generate file hash", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate file type and constraints
   */
  async validateFile(file, category = "media") {
    try {
      const validation = {
        isValid: true,
        errors: [],
        metadata: {},
      };

      // Check if file exists
      if (!(await fs.pathExists(file.path))) {
        validation.errors.push("File not found");
        validation.isValid = false;
        return validation;
      }

      // Get file stats
      const stats = await fs.stat(file.path);
      validation.metadata.size = stats.size;

      // Validate file size
      const maxSize = this.getMaxFileSize(category);
      if (stats.size > maxSize) {
        validation.errors.push(
          `File size exceeds maximum (${this.formatFileSize(maxSize)})`
        );
      }

      // Validate MIME type
      const detectedType = await fileType.fromFile(file.path);
      if (detectedType) {
        validation.metadata.detectedMimeType = detectedType.mime;

        // Check if detected type matches declared type
        if (detectedType.mime !== file.mimetype) {
          logger.warn("MIME type mismatch detected", {
            declared: file.mimetype,
            detected: detectedType.mime,
            filename: file.originalname,
          });
        }
      }

      // Validate against supported types
      const supportedTypes = this.getSupportedTypes(category);
      if (!supportedTypes.includes(file.mimetype)) {
        validation.errors.push(`Unsupported file type: ${file.mimetype}`);
      }

      // Additional validation based on file type
      if (file.mimetype.startsWith("image/")) {
        const imageValidation = await this.validateImage(file.path);
        validation.metadata.image = imageValidation;
        if (!imageValidation.isValid) {
          validation.errors.push(...imageValidation.errors);
        }
      } else if (file.mimetype.startsWith("video/")) {
        const videoValidation = await this.validateVideo(file.path);
        validation.metadata.video = videoValidation;
        if (!videoValidation.isValid) {
          validation.errors.push(...videoValidation.errors);
        }
      }

      validation.isValid = validation.errors.length === 0;

      return validation;
    } catch (error) {
      logger.error("File validation failed", {
        filename: file?.originalname,
        error: error.message,
      });

      return {
        isValid: false,
        errors: ["File validation failed"],
        metadata: {},
      };
    }
  }

  /**
   * Validate image file
   */
  async validateImage(imagePath) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        dimensions: {},
      };

      try {
        const dimensions = sizeOf(imagePath);
        validation.dimensions = {
          width: dimensions.width,
          height: dimensions.height,
          type: dimensions.type,
        };

        // Check dimensions
        const maxDimension = config.imageProcessing.maxDimensions.post;
        if (
          dimensions.width > maxDimension ||
          dimensions.height > maxDimension
        ) {
          validation.errors.push(
            `Image dimensions exceed maximum (${maxDimension}x${maxDimension})`
          );
        }

        // Check minimum dimensions
        if (dimensions.width < 50 || dimensions.height < 50) {
          validation.errors.push("Image dimensions too small (minimum 50x50)");
        }

        // Check aspect ratio for extreme cases
        const aspectRatio = dimensions.width / dimensions.height;
        if (aspectRatio > 10 || aspectRatio < 0.1) {
          validation.errors.push("Image aspect ratio is too extreme");
        }
      } catch {
        validation.errors.push("Could not read image dimensions");
      }

      validation.isValid = validation.errors.length === 0;
      return validation;
    } catch (error) {
      logger.error("Image validation failed", {
        imagePath,
        error: error.message,
      });

      return {
        isValid: false,
        errors: ["Image validation failed"],
        dimensions: {},
      };
    }
  }

  /**
   * Validate video file
   */
  async validateVideo(videoPath) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        metadata: {},
      };

      try {
        // Get video duration
        const duration =
          await require("get-video-duration").getVideoDurationInSeconds(
            videoPath
          );
        validation.metadata.duration = duration;

        // Check duration
        if (duration > config.videoProcessing.maxDuration) {
          validation.errors.push(
            `Video duration exceeds maximum (${config.videoProcessing.maxDuration} seconds)`
          );
        }

        if (duration < 0.1) {
          validation.errors.push("Video duration too short");
        }
      } catch {
        validation.errors.push("Could not read video duration");
      }

      validation.isValid = validation.errors.length === 0;
      return validation;
    } catch (error) {
      logger.error("Video validation failed", {
        videoPath,
        error: error.message,
      });

      return {
        isValid: false,
        errors: ["Video validation failed"],
        metadata: {},
      };
    }
  }

  /**
   * Get maximum file size for category
   */
  getMaxFileSize(category) {
    const sizes = {
      image: 20 * 1024 * 1024, // 20MB
      video: 100 * 1024 * 1024, // 100MB
      media: 100 * 1024 * 1024, // 100MB
      profile: 10 * 1024 * 1024, // 10MB
      cover: 15 * 1024 * 1024, // 15MB
    };

    return sizes[category] || config.maxFileSize;
  }

  /**
   * Get supported file types for category
   */
  getSupportedTypes(category) {
    switch (category) {
      case "image":
      case "profile":
      case "cover":
        return config.supportedImageTypes;
      case "video":
        return config.supportedVideoTypes;
      case "media":
        return [...config.supportedImageTypes, ...config.supportedVideoTypes];
      default:
        return [...config.supportedImageTypes, ...config.supportedVideoTypes];
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

  /**
   * Get file extension
   */
  getFileExtension(filename) {
    return path.extname(filename).toLowerCase().substring(1);
  }

  /**
   * Generate unique filename
   */
  generateUniqueFilename(originalName, prefix = "") {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");

    return `${prefix}${name}_${timestamp}_${random}${ext}`;
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  /**
   * Check if file is image
   */
  isImage(mimeType) {
    return config.supportedImageTypes.includes(mimeType);
  }

  /**
   * Check if file is video
   */
  isVideo(mimeType) {
    return config.supportedVideoTypes.includes(mimeType);
  }

  /**
   * Get optimal image quality based on file size and type
   */
  getOptimalImageQuality(fileSize, mediaType) {
    const qualityMap = {
      profile: { small: 95, medium: 90, large: 85 },
      cover: { small: 90, medium: 85, large: 80 },
      post: { small: 85, medium: 80, large: 75 },
    };

    const qualities = qualityMap[mediaType] || qualityMap.post;

    if (fileSize < 1024 * 1024) return qualities.small; // < 1MB
    if (fileSize < 5 * 1024 * 1024) return qualities.medium; // < 5MB
    return qualities.large; // >= 5MB
  }

  /**
   * Create temporary directory for processing
   */
  async createTempDir(prefix = "media_") {
    const tempDir = path.join(
      config.tempDir,
      `${prefix}${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
    );
    await fs.ensureDir(tempDir);
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  async cleanupTempDir(tempDir) {
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        logger.debug("Temporary directory cleaned up", { tempDir });
      }
    } catch (error) {
      logger.warn("Failed to cleanup temporary directory", {
        tempDir,
        error: error.message,
      });
    }
  }

  /**
   * Copy file to temporary location
   */
  async copyToTemp(sourcePath, tempDir, filename = null) {
    try {
      const targetFilename = filename || path.basename(sourcePath);
      const targetPath = path.join(tempDir, targetFilename);

      await fs.copy(sourcePath, targetPath);

      return targetPath;
    } catch (error) {
      logger.error("Failed to copy file to temp", {
        sourcePath,
        tempDir,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get file MIME type from extension
   */
  getMimeTypeFromExtension(filename) {
    const ext = this.getFileExtension(filename);
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      heic: "image/heic",
      heif: "image/heif",
      mp4: "video/mp4",
      avi: "video/avi",
      mov: "video/quicktime",
      wmv: "video/x-ms-wmv",
      flv: "video/x-flv",
      webm: "video/webm",
      mkv: "video/x-matroska",
    };

    return mimeTypes[ext] || "application/octet-stream";
  }
}

module.exports = new FileUtil();

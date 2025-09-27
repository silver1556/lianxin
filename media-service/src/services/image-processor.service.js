const sharp = require("sharp");
const path = require("path");
const fs = require("fs-extra");
const heicConvert = require("heic-convert");
const config = require("../config/app.config");
const logger = require("../utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * Image Processor Service
 * Handles Facebook-like image processing with multiple sizes and optimizations
 */
class ImageProcessorService {
  constructor() {
    this.supportedFormats = [
      "jpeg",
      "png",
      "webp",
      "heic",
      "heif",
      "tiff",
      "bmp",
    ];
    this.outputFormats = ["jpeg", "webp"];
  }

  /**
   * Process image with Facebook-like sizing and optimization
   */
  async processImage(inputPath, mediaType, options = {}) {
    try {
      const startTime = Date.now();

      // Convert HEIC/HEIF to JPEG if needed
      const processedInputPath = await this.convertHeicIfNeeded(inputPath);

      // Get image metadata
      const metadata = await this.getImageMetadata(processedInputPath);

      // Determine processing configuration based on media type
      const processingConfig = this.getProcessingConfig(mediaType);

      // Generate all required variants
      const variants = await this.generateVariants(
        processedInputPath,
        processingConfig,
        metadata,
        options
      );

      const processingTime = Date.now() - startTime;

      logger.info("Image processing completed", {
        inputPath,
        mediaType,
        variantCount: variants.length,
        processingTime,
        originalSize: metadata,
      });

      return {
        variants,
        metadata,
        processingTime,
      };
    } catch (error) {
      logger.error("Image processing failed", {
        inputPath,
        mediaType,
        error: error.message,
        stack: error.stack,
      });
      throw new AppError(
        "Image processing failed",
        500,
        "IMAGE_PROCESSING_ERROR"
      );
    }
  }

  /**
   * Convert HEIC/HEIF to JPEG if needed
   */
  async convertHeicIfNeeded(inputPath) {
    try {
      const fileExtension = path.extname(inputPath).toLowerCase();

      if (fileExtension === ".heic" || fileExtension === ".heif") {
        const outputPath = inputPath.replace(/\.(heic|heif)$/i, ".jpg");
        const inputBuffer = await fs.readFile(inputPath);

        const outputBuffer = await heicConvert({
          buffer: inputBuffer,
          format: "JPEG",
          quality: 0.95,
        }).then((outputBuffer) => fs.writeFile(outputPath, outputBuffer));

        logger.info("HEIC/HEIF converted to JPEG", {
          inputPath,
          outputPath,
          originalSize: inputBuffer.length,
          convertedSize: outputBuffer.length,
        });

        return outputPath;
      }

      return inputPath;
    } catch (error) {
      logger.error("HEIC/HEIF conversion failed", {
        inputPath,
        error: error.message,
      });
      throw new AppError(
        "HEIC/HEIF conversion failed",
        500,
        "HEIC_CONVERSION_ERROR"
      );
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        colorSpace: metadata.space,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        exif: metadata.exif,
        icc: metadata.icc,
      };
    } catch (error) {
      logger.error("Failed to get image metadata", {
        imagePath,
        error: error.message,
      });
      throw new AppError("Failed to get image metadata", 500, "METADATA_ERROR");
    }
  }

  /**
   * Get processing configuration based on media type
   */
  getProcessingConfig(mediaType) {
    const facebookConfig = config.facebookLike;

    switch (mediaType) {
      case "profile":
        return facebookConfig.profile;
      case "cover":
        return facebookConfig.cover;
      case "post":
      case "story":
      case "message":
        return facebookConfig.post;
      default:
        return facebookConfig.post;
    }
  }

  /**
   * Generate all required variants
   */
  async generateVariants(inputPath, processingConfig, metadata, options = {}) {
    try {
      const variants = [];
      const baseFilename = path.basename(inputPath, path.extname(inputPath));
      const outputDir = path.dirname(inputPath);

      const forceCrop = options.mediaType === "profile";

      for (const size of processingConfig.sizes) {
        try {
          // Calculate optimal dimensions
          const dimensions = this.calculateOptimalDimensions(
            metadata.width,
            metadata.height,
            size.width,
            size.height,
            forceCrop
          );

          // Run JPEG + WebP generation in parallel (faster!)
          const [jpegVariant, webpVariant] = await Promise.all([
            this.generateVariant(
              inputPath,
              outputDir,
              baseFilename,
              size.name,
              "jpeg",
              dimensions,
              processingConfig.jpegQuality ?? processingConfig.quality // allow separate quality
            ),
            this.generateVariant(
              inputPath,
              outputDir,
              baseFilename,
              size.name,
              "webp",
              dimensions,
              processingConfig.webpQuality ?? processingConfig.quality // allow override
            ),
          ]);

          // Push results safely
          if (jpegVariant) variants.push(jpegVariant);
          if (webpVariant) variants.push(webpVariant);
        } catch (variantError) {
          logger.warn("Failed to generate one or more variants", {
            size: size.name,
            error: variantError.message,
          });
        }
      }

      return variants;
    } catch (error) {
      logger.error("Failed to generate variants", {
        inputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate individual variant
   */
  async generateVariant(
    inputPath,
    outputDir,
    baseFilename,
    sizeName,
    format,
    dimensions,
    quality
  ) {
    try {
      const outputFilename = `${baseFilename}_${sizeName}.${format}`;
      const outputPath = path.join(outputDir, outputFilename);

      let sharpInstance = sharp(inputPath);

      // Apply transformations based on format and dimensions
      if (dimensions.crop) {
        // Smart crop for profile images
        sharpInstance = sharpInstance.resize(
          dimensions.width,
          dimensions.height,
          {
            fit: "cover",
            position: "attention", // Smart cropping
          }
        );
      } else {
        // Resize maintaining aspect ratio
        sharpInstance = sharpInstance.resize(
          dimensions.width,
          dimensions.height,
          {
            fit: "inside",
            withoutEnlargement: true,
          }
        );
      }

      // Apply format-specific optimizations
      switch (format) {
        case "jpeg":
          sharpInstance = sharpInstance.jpeg({
            quality,
            progressive: true,
            mozjpeg: true,
            optimiseScans: true,
          });
          break;
        case "webp":
          sharpInstance = sharpInstance.webp({
            quality,
            effort: 6,
            smartSubsample: true,
          });
          break;
        case "png":
          sharpInstance = sharpInstance.png({
            compressionLevel: 9,
            adaptiveFiltering: true,
            progressive: true,
          });
          break;
      }

      // Apply additional optimizations
      sharpInstance = sharpInstance.sharpen().withMetadata(false); // Remove EXIF for privacy

      // Write processed image
      const info = await sharpInstance.toFile(outputPath);

      return {
        variant_type: sizeName,
        format,
        width: info.width,
        height: info.height,
        file_size: info.size,
        quality,
        storage_path: outputPath,
        is_optimized: true,
      };
    } catch (error) {
      logger.error("Failed to generate image variant", {
        sizeName,
        format,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate optimal dimensions for resizing
   */
  calculateOptimalDimensions(
    originalWidth,
    originalHeight,
    targetWidth,
    targetHeight,
    forceCrop = false
  ) {
    const originalAspectRatio = originalWidth / originalHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    if (forceCrop) {
      // For profile images, always crop to exact dimensions
      return {
        width: targetWidth,
        height: targetHeight,
        crop: true,
      };
    }

    // For other images, maintain aspect ratio
    let newWidth, newHeight;

    if (originalAspectRatio > targetAspectRatio) {
      // Original is wider
      newWidth = targetWidth;
      newHeight = Math.round(targetWidth / originalAspectRatio);
    } else {
      // Original is taller
      newHeight = targetHeight;
      newWidth = Math.round(targetHeight * originalAspectRatio);
    }

    // Don't upscale images
    if (newWidth > originalWidth || newHeight > originalHeight) {
      newWidth = originalWidth;
      newHeight = originalHeight;
    }

    return {
      width: newWidth,
      height: newHeight,
      crop: false,
    };
  }

  /**
   * Generate thumbnail with blur hash for progressive loading
   */
  async generateThumbnailWithBlurHash(inputPath) {
    try {
      const thumbnailPath = inputPath.replace(/\.[^.]+$/, "_blur_thumb.jpeg");

      // Generate tiny thumbnail for blur hash
      const { data, info } = await sharp(inputPath)
        .resize(32, 32, { fit: "inside" })
        .jpeg({ quality: 20 })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Generate blur hash (simplified implementation)
      const blurHash = this.generateSimpleBlurHash(
        data,
        info.width,
        info.height
      );

      // Generate actual thumbnail
      await sharp(inputPath)
        .resize(200, 200, { fit: "cover" })
        .jpeg({ quality: 80, progressive: true })
        .toFile(thumbnailPath);

      return {
        thumbnailPath,
        blurHash,
      };
    } catch (error) {
      logger.error("Failed to generate thumbnail with blur hash", {
        inputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate simple blur hash (simplified implementation)
   */
  generateSimpleBlurHash(imageData, width, height) {
    // This is a simplified blur hash implementation
    // In production, use a proper blur hash library
    const hash = [];
    const blockSize = 4;

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 3;
            r += imageData[idx];
            g += imageData[idx + 1];
            b += imageData[idx + 2];
            count++;
          }
        }

        if (count > 0) {
          hash.push(Math.round(r / count));
          hash.push(Math.round(g / count));
          hash.push(Math.round(b / count));
        }
      }
    }

    return Buffer.from(hash).toString("base64");
  }

  /**
   * Extract dominant colors from image
   */
  async extractDominantColors(imagePath, colorCount = 5) {
    try {
      const { dominant } = await sharp(imagePath)
        .resize(100, 100)
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Simplified color extraction
      // In production, use a proper color quantization algorithm
      const colors = [];
      for (let i = 0; i < colorCount; i++) {
        const offset = Math.floor((dominant.data.length / colorCount) * i);
        const r = dominant.data[offset];
        const g = dominant.data[offset + 1];
        const b = dominant.data[offset + 2];

        colors.push({
          r,
          g,
          b,
          hex: `#${r.toString(16).padStart(2, "0")}${g
            .toString(16)
            .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
        });
      }

      return colors;
    } catch (error) {
      logger.error("Failed to extract dominant colors", {
        imagePath,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Apply intelligent compression based on image characteristics
   */
  async applyIntelligentCompression(
    inputPath,
    outputPath,
    targetFileSize = null
  ) {
    try {
      const metadata = await this.getImageMetadata(inputPath);
      const originalSize = (await fs.stat(inputPath)).size;

      // Decide initial quality based on format / image type
      let quality = metadata.format === "jpeg" ? 85 : 90;
      let attempts = 0;
      const maxAttempts = 5;

      // Decide compression pipeline
      const pipeline = sharp(inputPath);

      // Handle orientation
      if (metadata.orientation) {
        pipeline.rotate();
      }

      // If transparency, prefer webp to avoid losing alpha channel
      const outputFormat =
        metadata.hasAlpha && metadata.format !== "jpeg" ? "webp" : "jpeg";

      while (attempts < maxAttempts) {
        const tempPath = `${outputPath}.temp`;

        const encoder =
          outputFormat === "jpeg"
            ? pipeline.clone().jpeg({
                quality,
                progressive: true,
                mozjpeg: true,
                optimiseCoding: true,
              })
            : pipeline.clone().webp({ quality });

        await encoder.toFile(tempPath);

        const compressedSize = (await fs.stat(tempPath)).size;

        // Check if we've reached target size or quality is too low
        if (
          !targetFileSize ||
          compressedSize <= targetFileSize ||
          quality <= 60
        ) {
          await fs.move(tempPath, outputPath, { overwrite: true });

          logger.info("Intelligent compression completed", {
            format: metadata.format,
            originalSize,
            compressedSize,
            quality,
            compressionRatio:
              (((originalSize - compressedSize) / originalSize) * 100).toFixed(
                2
              ) + "%",
            attempts: attempts + 1,
          });

          return {
            format: metadata.format,
            originalSize,
            compressedSize,
            quality,
            compressionRatio: (originalSize - compressedSize) / originalSize,
          };
        }

        // Reduce quality for next attempt
        quality -= 10;
        attempts++;

        // Clean up temp file
        await fs.remove(tempPath);
      }

      throw new Error("Could not achieve target compression");
    } catch (error) {
      logger.error("Intelligent compression failed", {
        inputPath,
        outputPath,
        targetFileSize,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process live photo (image + short video)
   */
  async processLivePhoto(imagePath, videoPath, outputDir) {
    try {
      const baseFilename = path.basename(imagePath, path.extname(imagePath));

      // Process the still image
      const imageResult = await this.processImage(imagePath, "post");

      // Process the video component (3 seconds max)
      const videoProcessor = require("./video-processor.service");
      const videoResult = await videoProcessor.processLivePhotoVideo(
        videoPath,
        outputDir,
        baseFilename
      );

      logger.info("Live photo processing completed", {
        imagePath,
        videoPath,
      });

      return {
        image: imageResult,
        video: videoResult,
        isLivePhoto: true,
      };
    } catch (error) {
      logger.error("Live photo processing failed", {
        imagePath,
        videoPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Optimize image for web delivery
   */
  async optimizeForWeb(inputPath, outputPath, options = {}) {
    try {
      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 85,
        format = "jpeg",
        progressive = true,
      } = options;

      let sharpInstance = sharp(inputPath);

      // Resize if needed
      const metadata = await sharpInstance.metadata();
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: "inside",
          withoutEnlargement: false,
        });
      }

      // Apply format-specific optimizations
      switch (format) {
        case "jpeg":
          sharpInstance = sharpInstance.jpeg({
            quality,
            progressive,
            mozjpeg: true,
            optimiseScans: true,
          });
          break;
        case "webp":
          sharpInstance = sharpInstance.webp({
            quality,
            effort: 6,
            smartSubsample: true,
          });
          break;
        case "png":
          sharpInstance = sharpInstance.png({
            compressionLevel: 9,
            adaptiveFiltering: true,
            progressive,
          });
          break;
      }

      // Remove metadata for privacy and smaller file size
      sharpInstance = sharpInstance.withMetadata(false);

      const info = await sharpInstance.toFile(outputPath);

      return {
        width: info.width,
        height: info.height,
        size: info.size,
        format: info.format,
        outputPath,
      };
    } catch (error) {
      logger.error("Web optimization failed", {
        inputPath,
        outputPath,
        options,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create progressive JPEG for better loading experience
   */
  async createProgressiveJpeg(inputPath, outputPath, quality = 85) {
    try {
      const info = await sharp(inputPath)
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true,
          optimiseScans: true,
          quantisationTable: 3, // Better quality for progressive
        })
        .withMetadata(false)
        .toFile(outputPath);

      return {
        width: info.width,
        height: info.height,
        size: info.size,
        outputPath,
      };
    } catch (error) {
      logger.error("Progressive JPEG creation failed", {
        inputPath,
        outputPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Apply watermark to image
   */
  async applyWatermark(inputPath, outputPath, watermarkPath, options = {}) {
    try {
      const {
        position = "bottom-right",
        opacity = 0.7,
        margin = 20,
        scale = 0.2, // 20% of image width
      } = options;

      // Load base image + metadata
      const image = sharp(inputPath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error("Invalid image metadata");
      }

      // Prepare watermark (scaled by % of input width)
      const watermarkBuffer = await sharp(watermarkPath)
        .resize(Math.floor(metadata.width * scale))
        .png()
        .toBuffer();

      const watermarkMeta = await sharp(watermarkBuffer).metadata();

      if (!watermarkMeta.width || !watermarkMeta.height) {
        throw new Error("Invalid watermark metadata");
      }

      // Calculate position (accounting for watermark size)
      const positions = {
        "top-left": { top: margin, left: margin },
        "top-right": {
          top: margin,
          left: metadata.width - watermarkMeta.width - margin,
        },
        "bottom-left": {
          top: metadata.height - watermarkMeta.height - margin,
          left: margin,
        },
        "bottom-right": {
          top: metadata.height - watermarkMeta.height - margin,
          left: metadata.width - watermarkMeta.width - margin,
        },
        center: {
          top: Math.floor((metadata.height - watermarkMeta.height) / 2),
          left: Math.floor((metadata.width - watermarkMeta.width) / 2),
        },
      };

      const pos = positions[position] || positions["bottom-right"];

      const result = await image
        .composite([
          {
            input: watermarkBuffer,
            top: pos.top,
            left: pos.left,
            blend: "over",
            opacity,
          },
        ])
        .toFile(outputPath);

      return result;
    } catch (error) {
      logger.error("Watermark application failed", {
        inputPath,
        outputPath,
        watermarkPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate image file
   */
  async validateImage(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();

      const validation = {
        isValid: true,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: (await fs.stat(filePath)).size,
        errors: [],
      };

      // Check dimensions
      if (metadata.width > config.imageProcessing.maxDimensions.post) {
        validation.errors.push(
          `Width exceeds maximum (${config.imageProcessing.maxDimensions.post}px)`
        );
      }

      if (metadata.height > config.imageProcessing.maxDimensions.post) {
        validation.errors.push(
          `Height exceeds maximum (${config.imageProcessing.maxDimensions.post}px)`
        );
      }

      // Check file size
      if (validation.size > config.maxFileSize) {
        validation.errors.push(
          `File size exceeds maximum (${config.maxFileSize} bytes)`
        );
      }

      // Check format
      if (!this.supportedFormats.includes(metadata.format)) {
        validation.errors.push(`Unsupported format: ${metadata.format}`);
      }

      validation.isValid = validation.errors.length === 0;

      return validation;
    } catch (error) {
      logger.error("Image validation failed", {
        filePath,
        error: error.message,
      });

      return {
        isValid: false,
        errors: ["Invalid image file"],
      };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths) {
    try {
      for (const filePath of filePaths) {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }

      logger.debug("Cleanup completed", { filePaths });
    } catch (error) {
      logger.warn("Cleanup failed", {
        filePaths,
        error: error.message,
      });
    }
  }
}

module.exports = new ImageProcessorService();

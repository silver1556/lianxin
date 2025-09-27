const OSS = require("ali-oss");
const path = require("path");
const fs = require("fs-extra");
const crypto = require("crypto");
const config = require("../config/app.config");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * Alibaba Cloud Storage Service
 * Handles file uploads to Alibaba Cloud OSS with CDN integration
 */
class AlibabaStorageService {
  constructor() {
    this.client = null;
    this.bucket = config.alibabaCloud.bucket;
    this.cdnDomain = config.alibabaCloud.cdnDomain;
    this.enableHttps = config.alibabaCloud.enableHttps;
    this.isInitialized = false;
  }

  /**
   * Initialize Alibaba OSS client
   */
  async initialize() {
    try {
      if (config.enableMockStorage) {
        logger.info("Using mock storage service");
        this.isInitialized = true;
        return;
      }

      this.client = new OSS({
        region: config.alibabaCloud.region,
        accessKeyId: config.alibabaCloud.accessKeyId,
        accessKeySecret: config.alibabaCloud.accessKeySecret,
        bucket: this.bucket,
        endpoint: config.alibabaCloud.endpoint,
        secure: this.enableHttps,
        timeout: 60000, // 60 seconds
      });

      // Test connection
      await this.testConnection();

      this.isInitialized = true;
      logger.info("Alibaba OSS client initialized successfully", {
        region: config.alibabaCloud.region,
        bucket: this.bucket,
        endpoint: config.alibabaCloud.endpoint,
      });
    } catch (error) {
      logger.error("Failed to initialize Alibaba OSS client", {
        error: error.message,
        config: {
          region: config.alibabaCloud.region,
          bucket: this.bucket,
        },
      });
      throw new AppError(
        "Storage service initialization failed",
        500,
        "STORAGE_INIT_ERROR"
      );
    }
  }

  /**
   * Upload file to Alibaba OSS
   */
  async uploadFile(localPath, remotePath, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Use mock upload if enabled
      if (config.enableMockStorage) {
        return this.mockUpload(localPath, remotePath, options);
      }

      const startTime = Date.now();

      // Prepare upload options
      const uploadOptions = {
        headers: {
          "Cache-Control": options.cacheControl || "public, max-age=31536000", // 1 year
          "Content-Type": options.contentType || this.getMimeType(localPath),
        },
        ...options.ossOptions,
      };

      // Upload file
      const result = await this.client.put(
        remotePath,
        localPath,
        uploadOptions
      );

      const uploadTime = Date.now() - startTime;
      const fileStats = await fs.stat(localPath);

      logger.info("File uploaded to Alibaba OSS", {
        localPath,
        remotePath,
        fileSize: fileStats.size,
        uploadTime,
        etag: result.etag,
      });

      return {
        success: true,
        remotePath,
        url: this.buildCdnUrl(remotePath),
        etag: result.etag,
        uploadTime,
        fileSize: fileStats.size,
      };
    } catch (error) {
      logger.error("File upload to Alibaba OSS failed", {
        localPath,
        remotePath,
        error: error.message,
      });
      throw new AppError("File upload failed", 500, "STORAGE_UPLOAD_ERROR");
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(fileList) {
    try {
      const results = [];
      const errors = [];

      for (const fileInfo of fileList) {
        try {
          const result = await this.uploadFile(
            fileInfo.localPath,
            fileInfo.remotePath,
            fileInfo.options || {}
          );
          results.push({
            ...fileInfo,
            ...result,
          });
        } catch (error) {
          errors.push({
            ...fileInfo,
            error: error.message,
          });
        }
      }

      logger.info("Batch file upload completed", {
        totalFiles: fileList.length,
        successfulUploads: results.length,
        failedUploads: errors.length,
      });

      return {
        results,
        errors,
        summary: {
          total: fileList.length,
          successful: results.length,
          failed: errors.length,
        },
      };
    } catch (error) {
      logger.error("Batch file upload failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete file from Alibaba OSS
   */
  async deleteFile(remotePath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (config.enableMockStorage) {
        return this.mockDelete(remotePath);
      }

      const result = await this.client.delete(remotePath);

      logger.info("File deleted from Alibaba OSS", {
        remotePath,
        success: result.res.status === 204,
      });

      return {
        success: true,
        remotePath,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("File deletion from Alibaba OSS failed", {
        remotePath,
        error: error.message,
      });
      throw new AppError("File deletion failed", 500, "STORAGE_DELETE_ERROR");
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(remotePaths) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (config.enableMockStorage) {
        return this.mockBatchDelete(remotePaths);
      }

      const result = await this.client.deleteMulti(remotePaths);

      logger.info("Batch file deletion completed", {
        totalFiles: remotePaths.length,
        deletedFiles: result.deleted ? result.deleted.length : 0,
      });

      return {
        success: true,
        deletedFiles: result.deleted || [],
        totalFiles: remotePaths.length,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Batch file deletion failed", {
        remotePaths,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(remotePath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (config.enableMockStorage) {
        return this.mockGetMetadata(remotePath);
      }

      const result = await this.client.head(remotePath);

      return {
        size: parseInt(result.res.headers["content-length"]),
        contentType: result.res.headers["content-type"],
        lastModified: result.res.headers["last-modified"],
        etag: result.res.headers.etag,
        url: this.buildCdnUrl(remotePath),
      };
    } catch (error) {
      logger.error("Failed to get file metadata", {
        remotePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate signed URL for temporary access
   */
  async generateSignedUrl(remotePath, expiresIn = 3600) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (config.enableMockStorage) {
        return this.mockSignedUrl(remotePath, expiresIn);
      }

      const url = this.client.signatureUrl(remotePath, {
        expires: expiresIn,
        method: "GET",
      });

      return {
        url,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    } catch (error) {
      logger.error("Failed to generate signed URL", {
        remotePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Build CDN URL for file
   */
  buildCdnUrl(remotePath) {
    if (this.cdnDomain) {
      const protocol = this.enableHttps ? "https" : "http";
      return `${protocol}://${this.cdnDomain}/${remotePath}`;
    }

    // Fallback to OSS URL
    const protocol = this.enableHttps ? "https" : "http";
    return `${protocol}://${this.bucket}.${config.alibabaCloud.region}.aliyuncs.com/${remotePath}`;
  }

  /**
   * Generate storage path for file
   */
  generateStoragePath(userId, mediaType, filename, variant = null) {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    // Create organized folder structure
    let basePath = `media/${mediaType}/${year}/${month}/${day}/${userId}`;

    if (variant) {
      basePath += `/${variant}`;
    }

    // Generate unique filename
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    const uniqueFilename = `${name}_${timestamp}_${random}${ext}`;

    return `${basePath}/${uniqueFilename}`;
  }

  /**
   * Get MIME type for file
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".avi": "video/avi",
      ".mov": "video/quicktime",
    };

    return mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * Test connection to Alibaba OSS
   */
  async testConnection() {
    try {
      if (config.enableMockStorage) {
        return true;
      }

      // Test by listing bucket info
      const result = await this.client.getBucketInfo();

      logger.info("Alibaba OSS connection test successful", {
        bucket: result.bucket.name,
        region: result.bucket.region,
      });

      return true;
    } catch (error) {
      logger.error("Alibaba OSS connection test failed", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mock upload for development
   */
  async mockUpload(localPath, remotePath, options = {}) {
    const fileStats = await fs.stat(localPath);
    const uploadTime = Math.min(1000, fileStats.size / 10000); // Simulate upload time

    await new Promise((resolve) => setTimeout(resolve, uploadTime));

    return {
      success: true,
      remotePath,
      url: `https://mock-cdn.lianxin.com/${remotePath}`,
      etag: crypto.createHash("md5").update(remotePath).digest("hex"),
      uploadTime,
      fileSize: fileStats.size,
    };
  }

  /**
   * Mock delete for development
   */
  async mockDelete(remotePath) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      remotePath,
      deletedAt: new Date().toISOString(),
    };
  }

  /**
   * Mock batch delete for development
   */
  async mockBatchDelete(remotePaths) {
    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      success: true,
      deletedFiles: remotePaths,
      totalFiles: remotePaths.length,
      deletedAt: new Date().toISOString(),
    };
  }

  /**
   * Mock get metadata for development
   */
  async mockGetMetadata(remotePath) {
    return {
      size: 1024000, // 1MB mock size
      contentType: this.getMimeType(remotePath),
      lastModified: new Date().toISOString(),
      etag: crypto.createHash("md5").update(remotePath).digest("hex"),
      url: `https://mock-cdn.lianxin.com/${remotePath}`,
    };
  }

  /**
   * Mock signed URL for development
   */
  async mockSignedUrl(remotePath, expiresIn) {
    const signature = crypto.randomBytes(16).toString("hex");
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      url: `https://mock-cdn.lianxin.com/${remotePath}?expires=${expiresAt}&signature=${signature}`,
      expiresIn,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }
}

module.exports = new AlibabaStorageService();

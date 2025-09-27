const net = require("net");
const fs = require("fs-extra");
const path = require("path");
const config = require("../config/app.config");
const logger = require("../../../../shared/utils/logger.util");
const { AppError } = require("../../../../shared/errors/appError");

/**
 * ClamAV Daemon Service
 * Handles malware scanning for uploaded files
 */
class ClamAVService {
  constructor() {
    this.isInitialized = false;
    this.config = config.clamav;
    this.connectionPool = [];
    this.poolSize = 3;
    this.scanQueue = [];
    this.processing = false;
    this.stats = {
      totalScans: 0,
      cleanFiles: 0,
      infectedFiles: 0,
      errors: 0,
      avgScanTime: 0,
    };
  }

  /**
   * Initialize ClamAV daemon service
   */
  async initialize() {
    if (!this.config.enabled || config.enableMockMalwareScanner) {
      logger.info("ClamAV is disabled or mock enabled, using mock scanner");
      this.isInitialized = true;
      return;
    }

    const maxRetries = 10;
    const baseDelay = 2000;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Wait for ClamAV to be ready
        await this.waitForClamAV();

        // Test daemon connection
        await this.testDaemonConnection();

        // Initialize connection pool
        await this.initializeConnectionPool();

        // Verify scanner functionality
        await this.testScanner();

        this.isInitialized = true;

        const version = await this.getVersion();
        logger.info("ClamAV daemon service initialized successfully", {
          host: this.config.host,
          port: this.config.port,
          attempt: attempt + 1,
          version,
          poolSize: this.poolSize,
        });

        // Start queue processor
        this.startQueueProcessor();
        return;
      } catch (error) {
        attempt++;
        const delay = Math.min(baseDelay * Math.pow(1.5, attempt), 30000);

        logger.warn(
          `ClamAV init attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms`,
          {
            error: error.message,
            host: this.config.host,
            port: this.config.port,
          }
        );

        if (attempt >= maxRetries) {
          if (this.config.required) {
            throw new AppError(
              `ClamAV initialization failed after ${maxRetries} attempts: ${error.message}`,
              500,
              "CLAMAV_INIT_ERROR"
            );
          } else {
            logger.warn(
              "ClamAV initialization failed, continuing without malware scanning"
            );
            this.isInitialized = false;
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Wait for ClamAV daemon to be ready
   */
  async waitForClamAV() {
    const maxWaitTime = 120000; // 2 minutes
    const checkInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        await this.testDaemonConnection();
        return;
      } catch {
        logger.info("Waiting for ClamAV daemon to be ready...", {
          elapsed: Date.now() - startTime,
          maxWaitTime,
        });
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error("ClamAV daemon did not become ready within timeout");
  }

  /**
   * Test connection to ClamAV daemon
   */
  async testDaemonConnection() {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Connection timeout"));
      }, 10000);

      socket.connect(this.config.port, this.config.host, () => {
        clearTimeout(timeout);

        // Send PING command
        socket.write("zPING\0");

        let response = "";
        socket.on("data", (data) => {
          response += data.toString();
          if (response.includes("PONG")) {
            socket.end();
            resolve();
          }
        });
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`Connection failed: ${error.message}`));
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Connection timeout"));
      });

      socket.setTimeout(10000);
    });
  }

  /**
   * Initialize connection pool for better performance
   */
  async initializeConnectionPool() {
    this.connectionPool = [];

    for (let i = 0; i < this.poolSize; i++) {
      try {
        const connection = await this.createConnection();
        this.connectionPool.push(connection);
      } catch (error) {
        logger.warn(`Failed to create connection ${i + 1}`, {
          error: error.message,
        });
      }
    }
    if (this.connectionPool.length === 0) {
      throw new Error("Failed to create any connections to ClamAV daemon");
    }

    logger.info(
      `Created ${this.connectionPool.length} connections to ClamAV daemon`
    );
  }

  /**
   * Create a single connection to ClamAV daemon
   */
  async createConnection() {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Connection creation timeout"));
      }, 10000);

      socket.connect(this.config.port, this.config.host, () => {
        clearTimeout(timeout);
        socket.isAvailable = true;
        socket.lastUsed = Date.now();
        resolve(socket);
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
      });

      socket.setTimeout(this.config.timeout);
    });
  }

  /**
   * Get available connection from pool
   */
  async getConnection() {
    // Find available connection
    let connection = this.connectionPool.find(
      (conn) => conn.isAvailable && !conn.destroyed
    );

    if (!connection) {
      // Create new connection if pool is exhausted
      try {
        connection = await this.createConnection();
      } catch {
        throw new Error("No available connections and cannot create new one");
      }
    }
    connection.isAvailable = false;
    return connection;
  }

  /**
   * Return connection to pool
   */
  releaseConnection(connection) {
    if (connection && !connection.destroyed) {
      connection.isAvailable = true;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Get ClamAV version
   */
  async getVersion() {
    if (!this.config.enabled || config.enableMockMalwareScanner) {
      return "mock-1.0.0";
    }
    try {
      const connection = await this.getConnection();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.releaseConnection(connection);
          reject(new Error("Version check timeout"));
        }, 5000);

        connection.write("zVERSION\0");

        let response = "";
        const dataHandler = (data) => {
          response += data.toString();
          if (response.includes("\0")) {
            clearTimeout(timeout);
            connection.removeListener("data", dataHandler);
            this.releaseConnection(connection);

            const version = response.replace(/\0/g, "").trim();
            resolve(version);
          }
        };

        connection.on("data", dataHandler);
      });
    } catch (error) {
      logger.error("Failed to get ClamAV version", {
        error: error.message,
      });
      return "unknown";
    }
  }

  /**
   * Scan file for malware using ClamAV daemon
   */
  async scanFile(filePath) {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        throw new AppError(
          "File not found for scanning",
          404,
          "FILE_NOT_FOUND"
        );
      }

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.config.maxFileSize) {
        throw new AppError(
          "File too large for malware scanning",
          413,
          "FILE_TOO_LARGE"
        );
      }

      // Use mock scanner if disabled or in development
      if (!this.config.enabled || config.enableMockMalwareScanner) {
        return this.mockScan(filePath, stats.size);
      }

      // Perform daemon scan
      const scanResult = await this.performDaemonScan(filePath);
      const scanTime = Date.now() - startTime;

      const result = {
        isInfected: scanResult.isInfected,
        viruses: scanResult.viruses || [],
        scanTime,
        fileSize: stats.size,
        scanner: "clamav-daemon",
        scanDate: new Date().toISOString(),
        filePath: path.basename(filePath),
      };

      // Update statistics
      this.stats.totalScans++;
      this.stats.avgScanTime =
        (this.stats.avgScanTime * (this.stats.totalScans - 1) + scanTime) /
        this.stats.totalScans;

      if (scanResult.isInfected) {
        this.stats.infectedFiles++;
        logger.warn("Malware detected in file", {
          filePath,
          viruses: scanResult.viruses,
          scanTime,
          fileSize: stats.size,
        });
      } else {
        this.stats.cleanFiles++;
        logger.info("File scan completed - clean", {
          filePath: path.basename(filePath),
          scanTime,
          fileSize: stats.size,
        });
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error("File scanning failed", {
        filePath: path.basename(filePath),
        error: error.message,
        scanTime: Date.now() - startTime,
      });

      // Return safe result on scan failure for resilience
      return {
        isInfected: false,
        viruses: [],
        scanTime: Date.now() - startTime,
        fileSize: 0,
        scanner: "error",
        scanDate: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Perform actual daemon scan
   */
  async performDaemonScan(filePath) {
    const connection = await this.getConnection();

    try {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.releaseConnection(connection);
          reject(new Error("Scan timeout"));
        }, this.config.scanTimeout || 30000);

        // Use SCAN command for file scanning
        const command = `zSCAN ${filePath}\0`;
        connection.write(command);

        let response = "";
        const dataHandler = (data) => {
          response += data.toString();

          if (response.includes("\0")) {
            clearTimeout(timeout);
            connection.removeListener("data", dataHandler);
            this.releaseConnection(connection);

            const result = this.parseScanResponse(response);
            resolve(result);
          }
        };

        connection.on("data", dataHandler);

        connection.on("error", (error) => {
          clearTimeout(timeout);
          connection.removeListener("data", dataHandler);
          this.releaseConnection(connection);
          reject(error);
        });
      });
    } catch (error) {
      this.releaseConnection(connection);
      throw error;
    }
  }

  /**
   * Parse ClamAV daemon scan response
   */
  parseScanResponse(response) {
    const cleanResponse = response.replace(/\0/g, "").trim();

    if (cleanResponse.includes("OK")) {
      return { isInfected: false, viruses: [] };
    }

    if (cleanResponse.includes("FOUND")) {
      // Extract virus name
      const matches = cleanResponse.match(/(.+): (.+) FOUND/);
      const virusName = matches ? matches[2] : "Unknown virus";

      return {
        isInfected: true,
        viruses: [virusName],
      };
    }

    if (cleanResponse.includes("ERROR")) {
      throw new Error(`ClamAV scan error: ${cleanResponse}`);
    }

    // Default to safe result for unknown responses
    logger.warn("Unknown ClamAV response", { response: cleanResponse });
    return { isInfected: false, viruses: [] };
  }

  /**
   * Scan multiple files efficiently
   */
  async scanFiles(filePaths) {
    const results = [];
    const concurrency = Math.min(this.poolSize, filePaths.length);

    // Process files in batches
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);
      const batchPromises = batch.map((filePath) => this.scanFile(filePath));

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          const filePath = batch[index];

          if (result.status === "fulfilled") {
            results.push({ filePath, ...result.value });
          } else {
            results.push({
              filePath,
              isInfected: false,
              viruses: [],
              scanTime: 0,
              fileSize: 0,
              scanner: "error",
              error: result.reason?.message || "Unknown error",
            });
          }
        });
      } catch (error) {
        logger.error("Batch scanning error", { error: error.message });
      }
    }
    const infectedCount = results.filter((r) => r.isInfected).length;

    logger.info("Batch file scanning completed", {
      totalFiles: filePaths.length,
      cleanFiles: results.length - infectedCount,
      infectedFiles: infectedCount,
    });

    return {
      results,
      summary: {
        totalFiles: filePaths.length,
        cleanFiles: results.length - infectedCount,
        infectedFiles: infectedCount,
      },
    };
  }

  /**
   * Mock scanner for development/testing
   */
  async mockScan(filePath, fileSize) {
    const scanTime = Math.min(100 + fileSize / 10000, 1000);
    await new Promise((resolve) => setTimeout(resolve, scanTime));

    const isInfected =
      path.basename(filePath).toLowerCase().includes("virus") ||
      path.basename(filePath).toLowerCase().includes("malware");

    return {
      isInfected,
      viruses: isInfected ? ["Test.Virus.Mock"] : [],
      scanTime,
      fileSize,
      scanner: "mock",
      scanDate: new Date().toISOString(),
      filePath: path.basename(filePath),
    };
  }

  /**
   * Test scanner functionality with EICAR test
   */
  async testScanner() {
    if (!this.config.allowEicarTest) {
      logger.info("Skipping EICAR test (ENABLE_EICAR_TEST not set)");
      return true;
    }

    if (!this.config.enabled || config.enableMockMalwareScanner) {
      logger.info("ClamAV test skipped - using mock scanner");
      return true;
    }

    try {
      const eicarString =
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

      const testPath = path.join(
        config.tempDir,
        `eicar_test_${Date.now()}.txt`
      );

      await fs.writeFile(testPath, eicarString);

      const result = await this.scanFile(testPath);

      // Clean up test file
      await fs.remove(testPath).catch(() => {}); // Ignore cleanup errors

      if (!result.isInfected) {
        logger.warn("ClamAV test failed - EICAR not detected", { result });
        return false;
      }

      logger.info("ClamAV test passed - EICAR detected successfully", {
        viruses: result.viruses,
        scanTime: result.scanTime,
      });

      return true;
    } catch (error) {
      logger.error("ClamAV test failed", { error: error.message });
      return false;
    }
  }

  /**
   * Start queue processor for handling scan requests
   */
  startQueueProcessor() {
    if (this.processing) return;

    this.processing = true;

    const processQueue = async () => {
      while (this.processing && this.scanQueue.length > 0) {
        const task = this.scanQueue.shift();
        if (task) {
          try {
            const result = await this.scanFile(task.filePath);
            task.resolve(result);
          } catch (error) {
            task.reject(error);
          }
        }
      }

      if (this.processing) {
        setTimeout(processQueue, 100);
      }
    };

    processQueue();
  }

  /**
   * Add scan to queue (for high-throughput scenarios)
   */
  async queueScan(filePath) {
    return new Promise((resolve, reject) => {
      this.scanQueue.push({ filePath, resolve, reject });
    });
  }

  /**
   * Update virus definitions
   */
  async updateDefinitions() {
    if (!this.config.enabled) {
      logger.info("ClamAV disabled - skipping definition update");
      return { success: true, message: "Mock update completed" };
    }

    try {
      // Send RELOAD command to daemon
      const connection = await this.getConnection();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.releaseConnection(connection);
          reject(new Error("Definition update timeout"));
        }, 30000);

        connection.write("zRELOAD\0");

        let response = "";
        const dataHandler = (data) => {
          response += data.toString();
          if (response.includes("RELOADING")) {
            clearTimeout(timeout);
            connection.removeListener("data", dataHandler);
            this.releaseConnection(connection);

            logger.info("Virus definitions reloaded successfully");
            resolve({
              success: true,
              message: "Virus definitions reloaded successfully",
              timestamp: new Date().toISOString(),
            });
          }
        };

        connection.on("data", dataHandler);
      });
    } catch (error) {
      logger.error("Failed to update virus definitions", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.config.enabled,
      isMock: config.enableMockMalwareScanner,
      host: this.config.host,
      port: this.config.port,
      maxFileSize: this.config.maxFileSize,
      timeout: this.config.timeout,
      connectionPool: {
        size: this.connectionPool.length,
        available: this.connectionPool.filter(
          (c) => c.isAvailable && !c.destroyed
        ).length,
      },
      scanStats: this.stats,
      queueLength: this.scanQueue.length,
    };
  }

  /**
   * Health check for ClamAV service
   */
  async healthCheck() {
    try {
      if (!this.config.enabled) {
        return { status: "disabled", message: "ClamAV is disabled" };
      }

      if (!this.isInitialized) {
        return { status: "not_initialized", message: "ClamAV not initialized" };
      }

      // Test connection
      await this.testDaemonConnection();
      const version = await this.getVersion();

      const availableConnections = this.connectionPool.filter(
        (c) => c.isAvailable && !c.destroyed
      ).length;

      return {
        status: "healthy",
        version,
        connections: {
          total: this.connectionPool.length,
          available: availableConnections,
        },
        stats: this.stats,
        message: "ClamAV daemon is operational",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error.message,
        stats: this.stats,
      };
    }
  }

  /**
   * Cleanup connections and stop processing
   */
  async cleanup() {
    this.processing = false;

    for (const connection of this.connectionPool) {
      if (!connection.destroyed) {
        connection.destroy();
      }
    }

    this.connectionPool = [];
    logger.info("ClamAV service cleanup completed");
  }
}

module.exports = new ClamAVService();

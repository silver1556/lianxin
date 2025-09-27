class ApiResponse {
  constructor(success = true, message = null, data = null, meta = {}) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.meta = {
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
      ...meta,
    };
  }

  generateRequestId() {
    return `req_${crypto.randomUUID()}`;
  }

  // Success responses
  static success(message = "Operation successful", data = null, meta = {}) {
    return new ApiResponse(true, message, data, meta);
  }

  static created(
    message = "Resource created successfully",
    data = null,
    meta = {}
  ) {
    const response = new ApiResponse(true, message, data, meta);
    response.statusCode = 201;
    return response;
  }

  static updated(
    message = "Resource updated successfully",
    data = null,
    meta = {}
  ) {
    return new ApiResponse(true, message, data, meta);
  }

  static deleted(message = "Resource deleted successfully", meta = {}) {
    return new ApiResponse(true, message, null, meta);
  }

  static noContent(message = "No content", meta = {}) {
    const response = new ApiResponse(true, message, null, meta);
    response.statusCode = 204;
    return response;
  }

  // Paginated responses
  static paginated(data, pagination, message = "Data retrieved successfully") {
    const meta = {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages:
          pagination.totalPages ||
          Math.ceil(pagination.total / pagination.limit),
        hasNextPage: pagination.hasNextPage || false,
        hasPrevPage: pagination.hasPrevPage || false,
      },
    };
    return new ApiResponse(true, message, data, meta);
  }

  // List responses with metadata
  static list(
    data,
    totalCount,
    message = "List retrieved successfully",
    filters = {}
  ) {
    const meta = {
      totalCount,
      count: Array.isArray(data) ? data.length : 0,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };
    return new ApiResponse(true, message, data, meta);
  }

  // Error responses
  static error(
    message = "An error occurred",
    errorCode = null,
    statusCode = 500,
    details = null
  ) {
    const response = new ApiResponse(false, message, null, {
      error: {
        code: errorCode,
        details: details,
      },
    });
    response.statusCode = statusCode;
    return response;
  }

  static badRequest(
    message = "Bad request",
    errorCode = "BAD_REQUEST",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 400, details);
  }

  static unauthorized(
    message = "Unauthorized",
    errorCode = "UNAUTHORIZED",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 401, details);
  }

  static forbidden(
    message = "Forbidden",
    errorCode = "FORBIDDEN",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 403, details);
  }

  static notFound(
    message = "Resource not found",
    errorCode = "NOT_FOUND",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 404, details);
  }

  static conflict(
    message = "Resource conflict",
    errorCode = "CONFLICT",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 409, details);
  }

  static validationError(
    message = "Validation failed",
    errors = [],
    errorCode = "VALIDATION_ERROR"
  ) {
    return ApiResponse.error(message, errorCode, 422, {
      validationErrors: errors,
    });
  }

  static authError(
    message = "Auth error occurred",
    errorCode = null,
    statusCode = null,
    details = null
  ) {
    const response = new ApiResponse(false, message, null, {
      error: {
        code: errorCode,
        details: details,
      },
    });
    response.statusCode = statusCode;
    return response;
  }

  static appError(
    message = "App error occurred",
    errorCode = null,
    statusCode = 500,
    data = null,
    details = null
  ) {
    const response = new ApiResponse(false, message, data, {
      error: {
        code: errorCode,
        details: details,
      },
    });
    response.statusCode = statusCode;
    return response;
  }

  static tooManyRequests(
    message = "Too many requests",
    errorCode = "RATE_LIMIT_EXCEEDED",
    retryAfter = null
  ) {
    const details = retryAfter ? { retryAfter } : null;
    return ApiResponse.error(message, errorCode, 429, details);
  }

  static internalServerError(
    message = "Internal server error",
    errorCode = "INTERNAL_SERVER_ERROR",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 500, details);
  }

  static serviceUnavailable(
    message = "Service unavailable",
    errorCode = "SERVICE_UNAVAILABLE",
    details = null
  ) {
    return ApiResponse.error(message, errorCode, 503, details);
  }

  // Authentication responses
  static loginSuccess(user, session, authMethod, message = "Login successful") {
    return ApiResponse.success(
      message,
      {
        user,
        ...session,
      },
      {
        authMethod: authMethod,
      }
    );
  }

  static logoutSuccess(message = "Logout successful") {
    return ApiResponse.success(message, null, {
      action: "logout",
    });
  }

  static tokenRefreshed(tokens, message = "Token refreshed successfully") {
    return ApiResponse.success(message, tokens, {
      action: "token_refresh",
    });
  }

  // File upload responses
  static fileUploaded(fileInfo, message = "File uploaded successfully") {
    return ApiResponse.created(message, fileInfo, {
      uploadedAt: new Date().toISOString(),
    });
  }

  static multipleFilesUploaded(files, message = "Files uploaded successfully") {
    return ApiResponse.created(message, files, {
      uploadedCount: files.length,
      uploadedAt: new Date().toISOString(),
    });
  }

  // Batch operation responses
  static batchSuccess(results, message = "Batch operation completed") {
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.length - successCount;

    return ApiResponse.success(message, results, {
      batch: {
        total: results.length,
        successful: successCount,
        failed: errorCount,
        successRate: ((successCount / results.length) * 100).toFixed(2) + "%",
      },
    });
  }

  static partialSuccess(
    results,
    message = "Operation completed with some failures"
  ) {
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.length - successCount;

    const response = new ApiResponse(true, message, results, {
      batch: {
        total: results.length,
        successful: successCount,
        failed: errorCount,
        successRate: ((successCount / results.length) * 100).toFixed(2) + "%",
      },
    });
    response.statusCode = 207; // Multi-Status
    return response;
  }

  // Health check responses
  static healthCheck(services = {}) {
    const allHealthy = Object.values(services).every(
      (service) => service.status === "healthy"
    );
    const overallStatus = allHealthy ? "healthy" : "degraded";

    return ApiResponse.success(`System is ${overallStatus}`, {
      status: overallStatus,
      services,
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
    });
  }

  // Utility methods
  setStatusCode(statusCode) {
    this.statusCode = statusCode;
    return this;
  }

  addMetadata(key, value) {
    this.meta[key] = value;
    return this;
  }

  setRequestId(requestId) {
    this.meta.requestId = requestId;
    return this;
  }

  // Express.js integration
  send(res) {
    const statusCode = this.statusCode || (this.success ? 200 : 500);
    return res.status(statusCode).json(this);
  }

  // Convert to plain object
  toJSON() {
    return {
      success: this.success,
      message: this.message,
      data: this.data,
      meta: this.meta,
    };
  }

  // Static method to handle different error types
  static fromError(error) {
    if (error.name === "ValidationError") {
      return ApiResponse.validationError(
        error.message,
        error.errors,
        error.errorCode
      );
    }

    if (error.name === "AuthError") {
      return ApiResponse.error(
        error.message,
        error.errorCode,
        error.statusCode
      );
    }

    if (error.name === "AppError") {
      return ApiResponse.error(
        error.message,
        error.errorCode,
        error.statusCode
      );
    }

    // Handle JSON parsing errors
    if (error.type === "entity.parse.failed") {
      return ApiResponse.badRequest("Invalid JSON format", "INVALID_JSON");
    }

    // Default to internal server error
    return ApiResponse.internalServerError(
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
      "INTERNAL_SERVER_ERROR",
      process.env.NODE_ENV === "development" ? { stack: error.stack } : null
    );
  }
}

module.exports = ApiResponse;

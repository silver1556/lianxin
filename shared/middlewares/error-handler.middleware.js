const AuthError = require("../errors/authError");
const AppError = require("../errors/appError");
const ValidationError = require("../errors/validationError");
const ApiResponse = require("../utils/api.response");
const logger = require("../utils/logger.util");

class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      logErrors: options.logErrors !== false,
      includeStack:
        options.includeStack || process.env.NODE_ENV === "development",
      trustProxy: true,
      ...options,
    };
  }

  // Main error handling middleware
  handleError() {
    return (err, req, res, next) => {
      // Set default error properties
      let error = err;

      // Convert non-operational errors to AppError
      if (!error.isOperational) {
        error = this.normalizeError(error);
      }

      // Log error if enabled
      if (this.options.logErrors) {
        this.logError(error, req);
      }

      // Generate API response
      const response = this.generateErrorResponse(error, req);

      // Send response
      return response.send(res);
    };
  }

  // Normalize different error types to operational errors
  normalizeError(error) {
    // Handle specific error types
    if (error.name === "CastError") {
      return AppError.badRequest(
        `Invalid ${error.path}: ${error.value}`,
        "INVALID_ID"
      );
    }

    if (error.name === "JsonWebTokenError") {
      return AuthError.invalidToken("Invalid token");
    }

    if (error.name === "TokenExpiredError") {
      return AuthError.tokenExpired("Token has expired");
    }

    // Handle multer file upload errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return AppError.fileSizeExceeded("File size too large");
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return AppError.badRequest("Too many files uploaded");
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return AppError.badRequest("Unexpected file field");
    }

    // Handle body parser errors
    if (error.type === "entity.parse.failed") {
      return AppError.badRequest("Invalid JSON format");
    }

    if (error.type === "entity.too.large") {
      return AppError.badRequest("Request entity too large");
    }

    // Handle CORS errors
    if (error.code === "EBADCSRFTOKEN") {
      return AuthError.invalidToken("Invalid CSRF token");
    }

    // Default to internal server error
    return AppError.internalServerError(
      this.options.includeStack ? error.message : "Something went wrong",
      "INTERNAL_SERVER_ERROR"
    );
  }

  // Generate appropriate API response based on error type
  generateErrorResponse(error) {
    // Handle different error types
    if (error instanceof ValidationError) {
      return ApiResponse.validationError(
        error.message,
        error.errors,
        error.errorCode
      );
    }

    if (error instanceof AuthError) {
      return ApiResponse.authError(
        error.message,
        error.errorCode,
        error.statusCode,
        error.details
      );
    }

    if (error instanceof AppError) {
      return ApiResponse.appError(
        error.statusCode >= 500
          ? "Something went wrong. Please try again later."
          : error.message,
        error.errorCode,
        error.statusCode,
        error.publicData,
        this.options.includeStack ? { stack: error.stack } : null
      );
    }

    // Fallback for unknown errors
    return ApiResponse.internalServerError(
      "Something went wrong. Please try again later.",
      "UNKNOWN_ERROR",
      this.options.includeStack
        ? {
            originalError: error.message,
            stack: error.stack,
          }
        : null
    );
  }

  // Log errors with structured logging
  logError(error, req) {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        stack: error.stack,
        isOperational: error.isOperational,
      },
      request: {
        id: req.id,
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        ip: this.getClientIp(req),
        userAgent: req.get("User-Agent"),
        userId: req.user?.id,
        body: this.sanitizeRequestBody(req.body),
        query: req.query,
        params: req.params,
      },
      timestamp: new Date().toISOString(),
      level: error.statusCode >= 500 ? "error" : "warn",
    };

    if (error.statusCode >= 500) {
      logger.error(error.message, logData);
    } else {
      logger.warn(error.message, logData);
    }
  }

  // 404 handler for unmatched routes
  handleNotFound() {
    return (req, res, next) => {
      const error = AppError.notFound(
        `Route ${req.method} ${req.originalUrl} not found`
      );
      next(error);
    };
  }

  // Utility methods
  getClientIp(req) {
    if (this.options.trustProxy) {
      return req.ip || req.connection.remoteAddress;
    }
    return req.connection.remoteAddress || req.socket.remoteAddress;
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

module.exports = {
  ErrorHandler,
  errorHandler,
  // Export individual middlewares for convenience
  handleError: errorHandler.handleError.bind(errorHandler),
  handleNotFound: errorHandler.handleNotFound.bind(errorHandler),
};

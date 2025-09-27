const { AppError } = require("../../shared/errors/appError");
const { ValidationError } = require("../errors/validation.error");
const logger = require("../utils/logger.util");

/**
 * Global error handling middleware for Express
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userId: req.user?.userId,
  });

  // Handle custom application errors
  if (err instanceof AppError || err instanceof ValidationError) {
    return res.status(err.statusCode || 500).json(err.toJSON());
  }

  // Handle Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: "File size exceeds maximum allowed size",
      },
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
    });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      error: {
        code: "TOO_MANY_FILES",
        message: "Too many files in request",
      },
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      error: {
        code: "UNEXPECTED_FILE",
        message: "Unexpected file field",
      },
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
    });
  }

  // Handle Sequelize errors
  if (err.name === "SequelizeValidationError") {
    const validationError = ValidationError.multipleFields(
      "Database validation failed",
      err.errors.map((e) => ({
        field: e.path,
        message: e.message,
        value: e.value,
        constraint: e.validatorKey,
      }))
    );
    return res.status(422).json(validationError.toJSON());
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_RESOURCE",
        message: "Resource already exists",
      },
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
    });
  }

  // Handle axios errors (external service calls)
  if (err.response) {
    return res.status(err.response.status || 500).json({
      success: false,
      error: {
        code: "EXTERNAL_SERVICE_ERROR",
        message: "External service error",
        details: err.response.data,
      },
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
    });
  }

  // Handle network errors
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "External service unavailable",
      },
      timestamp: new Date().toISOString(),
      request_id: req.requestId,
    });
  }

  // Fallback for unexpected errors
  const fallbackError = AppError.internalServerError("Something went wrong", {
    originalError: err.message,
  });

  return res.status(500).json(fallbackError.toJSON());
}

module.exports = errorHandler;

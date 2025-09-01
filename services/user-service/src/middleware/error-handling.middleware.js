// middlewares/error-handling.middleware.js
const { AppError } = require("../errors/AppError");
const { AuthError } = require("../errors/authError");
const { ValidationError } = require("../errors/validationError");

/**
 * Global error handling middleware for Express
 */
function errorHandler(err, req, res, next) {
  // If the error is already one of our custom AppError types
  if (
    err instanceof AppError ||
    err instanceof AuthError ||
    err instanceof ValidationError
  ) {
    return res.status(err.statusCode || 500).json(err.toJSON());
  }

  // If it's a Joi validation error (not wrapped yet)
  if (err.isJoi) {
    const validationError = ValidationError.multipleFields(
      "Validation failed",
      err.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
        value: d.context?.value,
        constraint: d.type,
      }))
    );
    return res.status(400).json(validationError.toJSON());
  }

  // Handle Sequelize unique/constraint errors gracefully
  if (
    err.name === "SequelizeUniqueConstraintError" ||
    err.name === "SequelizeValidationError"
  ) {
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

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      errorCode: "INVALID_TOKEN",
      message: "Invalid authentication token",
      statusCode: 401,
      name: "AuthError",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      errorCode: "TOKEN_EXPIRED",
      message: "Authentication token has expired",
      statusCode: 401,
      name: "AuthError",
    });
  }

  // Handle rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      errorCode: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests, please try again later",
      statusCode: 429,
      name: "RateLimitError",
    });
  }

  // Fallback for unexpected/unhandled errors
  console.error("Unhandled error:", err);
  const fallback = AppError.internalServerError("Something went wrong", {
    originalError: err.message,
  });
  return res.status(500).json(fallback.toJSON());
}

module.exports = errorHandler;

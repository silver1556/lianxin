const {
  BaseError,
  ValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  DatabaseError,
} = require("sequelize");

/**
 * Custom Application Error Class
 * Base error class for all application-specific errors
 */
class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    errorCode = "INTERNAL_SERVER_ERROR",
    publicData = null, // Can send to the client
    isOperational = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.publicData = publicData;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  // Client Errors (4xx)
  static badRequest(message = "Bad request", errorCode = "BAD_REQUEST") {
    return new AppError(message, 400, errorCode);
  }

  static notFound(message = "Resource not found", errorCode = "NOT_FOUND") {
    return new AppError(message, 404, errorCode);
  }

  static conflict(message = "Resource conflict", errorCode = "CONFLICT") {
    return new AppError(message, 409, errorCode);
  }

  static gone(message = "Resource no longer available", errorCode = "GONE") {
    return new AppError(message, 410, errorCode);
  }

  static unprocessableEntity(
    message = "Unprocessable entity",
    errorCode = "UNPROCESSABLE_ENTITY"
  ) {
    return new AppError(message, 422, errorCode);
  }

  static tooManyRequests(
    message = "Too many requests",
    errorCode = "RATE_LIMIT_EXCEEDED",
    retryAfter = null
  ) {
    return new AppError(message, 429, errorCode, { retryAfter: retryAfter });
  }

  // Server Errors (5xx)
  static internalServerError(
    message = "Internal server error",
    errorCode = "INTERNAL_SERVER_ERROR"
  ) {
    return new AppError(message, 500, errorCode, null, false);
  }

  static notImplemented(
    message = "Not implemented",
    errorCode = "NOT_IMPLEMENTED"
  ) {
    return new AppError(message, 501, errorCode);
  }

  static badGateway(message = "Bad gateway", errorCode = "BAD_GATEWAY") {
    return new AppError(message, 502, errorCode, null, false);
  }

  static serviceUnavailable(
    message = "Service unavailable",
    errorCode = "SERVICE_UNAVAILABLE"
  ) {
    return new AppError(message, 503, errorCode, null, false);
  }

  static gatewayTimeout(
    message = "Gateway timeout",
    errorCode = "GATEWAY_TIMEOUT"
  ) {
    return new AppError(message, 504, errorCode, null, false);
  }

  // Database Errors
  static sequelizeError(error) {
    if (!(error instanceof BaseError)) {
      return AppError.internalServerError(error.message);
    }

    if (error instanceof ValidationError) {
      return new AppError(error.message, 400, "VALIDATION_ERROR");
    }

    if (error instanceof UniqueConstraintError) {
      return new AppError(error.message, 409, "DUPLICATE_KEY_ERROR");
    }

    if (error instanceof ForeignKeyConstraintError) {
      return new AppError(error.message, 404, "FOREIGN_KEY_CONSTRAINT_ERROR");
    }

    if (error instanceof DatabaseError) {
      return new AppError(error.message, 500, "DATABASE_ERROR", null, false);
    }

    // fallback
    return new AppError("Database error", 500, "DATABASE_ERROR", null, false);
  }

  // File System Errors
  static fileNotFound(message = "File not found") {
    return new AppError(message, 404, "FILE_NOT_FOUND");
  }

  static fileUploadError(message = "File upload failed") {
    return new AppError(message, 400, "FILE_UPLOAD_ERROR");
  }

  static fileTypeNotAllowed(message = "File type not allowed") {
    return new AppError(message, 400, "FILE_TYPE_NOT_ALLOWED");
  }

  static fileSizeExceeded(message = "File size exceeds limit") {
    return new AppError(message, 413, "FILE_SIZE_EXCEEDED");
  }

  static storageQuotaExceeded(message = "Storage quota exceeded") {
    return new AppError(message, 507, "STORAGE_QUOTA_EXCEEDED");
  }

  // Network/External Service Errors
  static externalServiceError(
    message = "External service error",
    service = "unknown"
  ) {
    return new AppError(
      message,
      502,
      `EXTERNAL_SERVICE_ERROR_${service.toUpperCase()}`,
      null,
      false
    );
  }

  static networkTimeout(message = "Network request timeout") {
    return new AppError(message, 504, "NETWORK_TIMEOUT", null, false);
  }

  static dnsResolutionError(message = "DNS resolution failed") {
    return new AppError(message, 502, "DNS_RESOLUTION_ERROR", null, false);
  }

  // Business Logic Errors
  static businessRuleViolation(
    message = "Business rule violation",
    rule = null
  ) {
    const errorCode = rule
      ? `BUSINESS_RULE_${rule.toUpperCase()}`
      : "BUSINESS_RULE_VIOLATION";
    return new AppError(message, 422, errorCode);
  }

  static insufficientFunds(message = "Insufficient funds") {
    return new AppError(message, 402, "INSUFFICIENT_FUNDS");
  }

  static quotaExceeded(message = "Quota exceeded", quotaType = "unknown") {
    return new AppError(
      message,
      429,
      `QUOTA_EXCEEDED_${quotaType.toUpperCase()}`
    );
  }

  static featureDisabled(message = "Feature is disabled") {
    return new AppError(message, 503, "FEATURE_DISABLED");
  }

  static maintenanceMode(message = "Application is in maintenance mode") {
    return new AppError(message, 503, "MAINTENANCE_MODE");
  }

  // ========== ENCRYPTION SPECIFIC ERRORS ==========
  // Core Encryption/Decryption Errors
  static encryptionError(message = "Encryption failed") {
    return new AppError(message, 500, "ENCRYPTION_ERROR", null, false);
  }

  static decryptionError(message = "Decryption failed") {
    return new AppError(message, 500, "DECRYPTION_ERROR", null, false);
  }

  // Key Management Errors
  static keyDerivationError(message = "Key derivation failed") {
    return new AppError(message, 500, "KEY_DERIVATION_ERROR", null, false);
  }

  // Hashing & HMAC Errors
  static hashingError(message = "Hashing failed") {
    return new AppError(message, 500, "HASHING_ERROR", null, false);
  }

  static hmacGenerationError(message = "HMAC generation failed") {
    return new AppError(message, 500, "HMAC_GENERATION_ERROR", null, false);
  }

  // Data Format & Processing Errors
  static jsonEncryptionError(message = "JSON encryption failed") {
    return new AppError(message, 500, "JSON_ENCRYPTION_ERROR", null, false);
  }

  static jsonDecryptionError(message = "JSON decryption failed") {
    return new AppError(message, 500, "JSON_DECRYPTION_ERROR", null, false);
  }

  // File Encryption Errors
  static fileEncryptionError(message = "File encryption failed") {
    return new AppError(message, 500, "FILE_ENCRYPTION_ERROR", null, false);
  }

  static fileDecryptionError(message = "File decryption failed") {
    return new AppError(message, 500, "FILE_DECRYPTION_ERROR", null, false);
  }

  // Algorithm & Configuration Errors
  static invalidAlgorithmError(message = "Invalid encryption algorithm") {
    return new AppError(message, 500, "INVALID_ALGORITHM_ERROR", null, false);
  }

  static configurationError(message = "Encryption configuration error") {
    return new AppError(
      message,
      500,
      "ENCRYPTION_CONFIGURATION_ERROR",
      null,
      false
    );
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      isOperational: this.isOperational,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === "development" ? this.stack : undefined,
    };
  }
}

module.exports = AppError;

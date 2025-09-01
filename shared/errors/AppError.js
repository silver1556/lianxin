/**
 * Custom Application Error Class
 * Base error class for all application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert error to JSON format
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  
  /**
   * Static method to create a bad request error
   */
  static badRequest(message, details = null) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }
  
  /**
   * Static method to create an unauthorized error
   */
  static unauthorized(message = 'Unauthorized access', details = null) {
    return new AppError(message, 401, 'UNAUTHORIZED', details);
  }
  
  /**
   * Static method to create a forbidden error
   */
  static forbidden(message = 'Forbidden access', details = null) {
    return new AppError(message, 403, 'FORBIDDEN', details);
  }
  
  /**
   * Static method to create a not found error
   */
  static notFound(message = 'Resource not found', details = null) {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }
  
  /**
   * Static method to create a conflict error
   */
  static conflict(message = 'Resource conflict', details = null) {
    return new AppError(message, 409, 'CONFLICT', details);
  }
  
  /**
   * Static method to create an unprocessable entity error
   */
  static unprocessableEntity(message = 'Unprocessable entity', details = null) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
  
  /**
   * Static method to create a rate limit error
   */
  static rateLimitExceeded(message = 'Rate limit exceeded', details = null) {
    return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
  
  /**
   * Static method to create an internal server error
   */
  static internalServerError(message = 'Internal server error', details = null) {
    return new AppError(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
  
  /**
   * Static method to create a service unavailable error
   */
  static serviceUnavailable(message = 'Service unavailable', details = null) {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
  
  /**
   * Static method to create a gateway timeout error
   */
  static gatewayTimeout(message = 'Gateway timeout', details = null) {
    return new AppError(message, 504, 'GATEWAY_TIMEOUT', details);
  }
}

module.exports = { AppError };
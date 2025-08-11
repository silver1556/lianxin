/**
 * Standardized API Response Utility
 * Provides consistent response format across all microservices
 */
class ApiResponse {
  /**
   * Success response
   */
  static success(data = null, message = 'Operation successful', requestId = null, meta = null) {
    const response = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };

    if (requestId) {
      response.request_id = requestId;
    }

    if (meta) {
      response.meta = meta;
    }

    return response;
  }

  /**
   * Error response
   */
  static error(code, message, requestId = null, details = null, statusCode = 400) {
    const response = {
      success: false,
      error: {
        code,
        message
      },
      timestamp: new Date().toISOString()
    };

    if (requestId) {
      response.request_id = requestId;
    }

    if (details) {
      response.error.details = details;
    }

    return response;
  }

  /**
   * Validation error response
   */
  static validationError(errors, requestId = null) {
    return this.error(
      'VALIDATION_ERROR',
      'Validation failed',
      requestId,
      { validation_errors: errors },
      422
    );
  }

  /**
   * Authentication error response
   */
  static authError(message = 'Authentication failed', requestId = null) {
    return this.error(
      'AUTHENTICATION_ERROR',
      message,
      requestId,
      null,
      401
    );
  }

  /**
   * Authorization error response
   */
  static authorizationError(message = 'Access denied', requestId = null) {
    return this.error(
      'AUTHORIZATION_ERROR',
      message,
      requestId,
      null,
      403
    );
  }

  /**
   * Not found error response
   */
  static notFound(message = 'Resource not found', requestId = null) {
    return this.error(
      'NOT_FOUND',
      message,
      requestId,
      null,
      404
    );
  }

  /**
   * Rate limit error response
   */
  static rateLimitError(message = 'Rate limit exceeded', requestId = null, retryAfter = null) {
    const details = retryAfter ? { retry_after: retryAfter } : null;
    
    return this.error(
      'RATE_LIMIT_EXCEEDED',
      message,
      requestId,
      details,
      429
    );
  }

  /**
   * Server error response
   */
  static serverError(message = 'Internal server error', requestId = null) {
    return this.error(
      'INTERNAL_SERVER_ERROR',
      message,
      requestId,
      null,
      500
    );
  }

  /**
   * Paginated response
   */
  static paginated(data, pagination, message = 'Data retrieved successfully', requestId = null) {
    return this.success(
      data,
      message,
      requestId,
      {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total_count: pagination.total_count,
          total_pages: pagination.total_pages || Math.ceil(pagination.total_count / pagination.limit),
          has_next: pagination.page < Math.ceil(pagination.total_count / pagination.limit),
          has_prev: pagination.page > 1
        }
      }
    );
  }

  /**
   * Created response
   */
  static created(data, message = 'Resource created successfully', requestId = null) {
    const response = this.success(data, message, requestId);
    response.status_code = 201;
    return response;
  }

  /**
   * Updated response
   */
  static updated(data = null, message = 'Resource updated successfully', requestId = null) {
    return this.success(data, message, requestId);
  }

  /**
   * Deleted response
   */
  static deleted(message = 'Resource deleted successfully', requestId = null) {
    return this.success(null, message, requestId);
  }

  /**
   * No content response
   */
  static noContent(requestId = null) {
    const response = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (requestId) {
      response.request_id = requestId;
    }

    return response;
  }

  /**
   * Accepted response (for async operations)
   */
  static accepted(data = null, message = 'Request accepted for processing', requestId = null) {
    const response = this.success(data, message, requestId);
    response.status_code = 202;
    return response;
  }

  /**
   * Conflict error response
   */
  static conflict(message = 'Resource conflict', requestId = null, details = null) {
    return this.error(
      'CONFLICT',
      message,
      requestId,
      details,
      409
    );
  }

  /**
   * Bad request error response
   */
  static badRequest(message = 'Bad request', requestId = null, details = null) {
    return this.error(
      'BAD_REQUEST',
      message,
      requestId,
      details,
      400
    );
  }

  /**
   * Service unavailable error response
   */
  static serviceUnavailable(message = 'Service temporarily unavailable', requestId = null) {
    return this.error(
      'SERVICE_UNAVAILABLE',
      message,
      requestId,
      null,
      503
    );
  }

  /**
   * Custom error response
   */
  static customError(code, message, statusCode = 400, requestId = null, details = null) {
    return this.error(code, message, requestId, details, statusCode);
  }
}

module.exports = ApiResponse;
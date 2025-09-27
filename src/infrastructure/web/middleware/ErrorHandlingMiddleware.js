/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */
class ErrorHandlingMiddleware {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Handle application errors
   */
  handleError() {
    return (err, req, res, next) => {
      // Log error
      this.logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userId: req.user?.userId
      });

      // Handle different error types
      if (err.name === 'ValidationError') {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.errors || []
          }
        });
      }

      if (err.name === 'AuthError') {
        return res.status(err.statusCode || 401).json({
          success: false,
          error: {
            code: err.errorCode || 'AUTHENTICATION_ERROR',
            message: err.message
          }
        });
      }

      if (err.name === 'AppError') {
        return res.status(err.statusCode || 500).json({
          success: false,
          error: {
            code: err.errorCode || 'APPLICATION_ERROR',
            message: err.message
          }
        });
      }

      // Default error response
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : err.message
        }
      });
    };
  }

  /**
   * Handle 404 errors
   */
  handleNotFound() {
    return (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`
        }
      });
    };
  }
}

module.exports = ErrorHandlingMiddleware;
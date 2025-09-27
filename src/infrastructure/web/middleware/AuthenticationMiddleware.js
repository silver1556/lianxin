/**
 * Authentication Middleware
 * Handles JWT token verification using dependency injection
 */
class AuthenticationMiddleware {
  constructor(authenticationService) {
    this.authService = authenticationService;
  }

  /**
   * Authenticate user
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.get('Authorization');
        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authorization header is required'
            }
          });
        }

        const token = authHeader.replace('Bearer ', '');
        const userInfo = await this.authService.verifyToken(token);

        req.user = userInfo;
        next();

      } catch (error) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: error.message
          }
        });
      }
    };
  }

  /**
   * Optional authentication
   */
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const authHeader = req.get('Authorization');
        
        if (authHeader) {
          const token = authHeader.replace('Bearer ', '');
          const userInfo = await this.authService.verifyToken(token);
          req.user = userInfo;
        }

        next();
      } catch (error) {
        // Continue without authentication for optional auth
        next();
      }
    };
  }

  /**
   * Require admin role
   */
  requireAdmin() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      const userRoles = req.user.roles || [];
      if (!userRoles.includes('admin')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ADMIN_REQUIRED',
            message: 'Admin access required'
          }
        });
      }

      next();
    };
  }
}

module.exports = AuthenticationMiddleware;
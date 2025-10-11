const jwt = require("jsonwebtoken");
const logger = require("../logging/logger");
const { AuthError } = require("../../errors/authError");

/**
 * JWT Strategy for Authentication
 * Handles JWT token validation and user authentication
 */
class JWTStrategy {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_TOKEN_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_TOKEN_SECRET;
    this.algorithm = process.env.JWT_ALGORITHM || "HS256";
    this.issuer = process.env.JWT_ISSUER || "lianxin-platform";
    this.audience = process.env.JWT_AUDIENCE || "lianxin-app";
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token) {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret, {
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
      });

      // Verify token type
      if (payload.type !== "access") {
        throw new AuthError("Invalid token type");
      }

      logger.debug("Access token verified", {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return payload;
    } catch (error) {
      logger.warn("Access token verification failed", {
        error: error.message,
        name: error.name,
      });
      if (error.name === "TokenExpiredError") {
        throw AuthError.expiredToken("Access token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw AuthError.invalidToken("Invalid access token");
      } else if (error.name === "NotBeforeError") {
        throw AuthError.invalidToken("Token not active yet");
      }

      throw AuthError.invalidToken("Token verification failed");
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret, {
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
      });

      // Verify token type
      if (payload.type !== "refresh") {
        throw new AuthError("Invalid token type");
      }

      logger.debug("Refresh token verified", {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return payload;
    } catch (error) {
      logger.warn("Refresh token verification failed", {
        error: error.message,
        name: error.name,
      });
      if (error.name === "TokenExpiredError") {
        throw AuthError.expiredToken("Refresh token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw AuthError.invalidToken("Invalid refresh token");
      } else if (error.name === "NotBeforeError") {
        throw AuthError.invalidToken("Token not active yet");
      }

      throw AuthError.invalidToken("Token verification failed");
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader) {
    const [bearer, token] = authHeader.split(" ");

    if (bearer !== "Bearer" || !token) {
      throw AuthError.invalidToken("Invalid authorization header format");
    }

    return token;
  }

  /**
   * Validate token format
   */
  validateTokenFormat(token) {
    const tokenRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    return tokenRegex.test(token);
  }
}

module.exports = new JWTStrategy();

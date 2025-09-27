const jwt = require('jsonwebtoken');

/**
 * JWT Service
 * Handles JWT token operations
 */
class JwtService {
  constructor(config, encryptionService) {
    this.accessTokenSecret = config.jwt.accessTokenSecret;
    this.refreshTokenSecret = config.jwt.refreshTokenSecret;
    this.accessTokenExpiry = config.jwt.accessTokenExpiry || '30m';
    this.refreshTokenExpiry = config.jwt.refreshTokenExpiry || '7d';
    this.algorithm = config.jwt.algorithm || 'HS256';
    this.issuer = config.jwt.issuer || 'lianxin-platform';
    this.audience = config.jwt.audience || 'lianxin-app';
    this.encryptionService = encryptionService;
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload, options = {}) {
    try {
      const tokenPayload = {
        ...payload,
        type: 'access',
        jti: this.encryptionService.generateSecureToken(16),
        iat: Math.floor(Date.now() / 1000)
      };

      const tokenOptions = {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        subject: payload.userId?.toString(),
        ...options
      };

      return jwt.sign(tokenPayload, this.accessTokenSecret, tokenOptions);
    } catch (error) {
      throw new Error(`Failed to generate access token: ${error.message}`);
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload, options = {}) {
    try {
      const tokenPayload = {
        ...payload,
        type: 'refresh',
        jti: this.encryptionService.generateSecureToken(16),
        iat: Math.floor(Date.now() / 1000)
      };

      const tokenOptions = {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        subject: payload.userId?.toString(),
        ...options
      };

      return jwt.sign(tokenPayload, this.refreshTokenSecret, tokenOptions);
    } catch (error) {
      throw new Error(`Failed to generate refresh token: ${error.message}`);
    }
  }

  /**
   * Generate token pair
   */
  generateTokenPair(payload, options = {}) {
    try {
      const accessToken = this.generateAccessToken(payload, options.access);
      const refreshToken = this.generateRefreshToken(payload, options.refresh);

      const accessTokenDecoded = jwt.decode(accessToken);
      const refreshTokenDecoded = jwt.decode(refreshToken);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: this._getExpirationTime(accessTokenDecoded.exp),
        expires_at: new Date(accessTokenDecoded.exp * 1000),
        refresh_expires_in: this._getExpirationTime(refreshTokenDecoded.exp),
        refresh_expires_at: new Date(refreshTokenDecoded.exp * 1000),
        issued_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate token pair: ${error.message}`);
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token, options = {}) {
    try {
      const verifyOptions = {
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
        ...options
      };

      const decoded = jwt.verify(token, this.accessTokenSecret, verifyOptions);

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token, options = {}) {
    try {
      const verifyOptions = {
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
        ...options
      };

      const decoded = jwt.verify(token, this.refreshTokenSecret, verifyOptions);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader) {
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      throw new Error('Invalid authorization header format');
    }

    return token;
  }

  /**
   * Decode token without verification
   */
  decode(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  // Private helper methods
  _getExpirationTime(exp) {
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, exp - currentTime);
  }
}

module.exports = JwtService;
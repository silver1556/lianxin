const jwt = require('jsonwebtoken');
const JwtService = require('../../core/domain/user/contracts/JwtService');

/**
 * JWT Service Implementation
 * Implements JwtService contract using jsonwebtoken library
 */
class JwtServiceImpl extends JwtService {
  constructor(config, encryptionService) {
    super();
    this.accessTokenSecret = config.jwt.accessTokenSecret;
    this.refreshTokenSecret = config.jwt.refreshTokenSecret;
    this.passwordResetTokenSecret = config.jwt.passwordResetTokenSecret;
    this.accessTokenExpiry = config.jwt.accessTokenExpiry || '30m';
    this.refreshTokenExpiry = config.jwt.refreshTokenExpiry || '7d';
    this.algorithm = config.jwt.algorithm || 'HS256';
    this.issuer = config.jwt.issuer || 'lianxin-platform';
    this.audience = config.jwt.audience || 'lianxin-app';
    this.clockTolerance = config.jwt.clockTolerance || 30;
    this.encryptionService = encryptionService;
  }

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

  verifyAccessToken(token, options = {}) {
    try {
      const verifyOptions = {
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
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
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      }

      throw new Error('Token verification failed');
    }
  }

  verifyRefreshToken(token, options = {}) {
    try {
      const verifyOptions = {
        algorithm: this.algorithm,
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
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
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      }

      throw new Error('Refresh token verification failed');
    }
  }

  generatePasswordResetToken(payload) {
    try {
      const tokenPayload = {
        ...payload,
        type: 'password_reset',
        iat: Math.floor(Date.now() / 1000)
      };

      return jwt.sign(tokenPayload, this.passwordResetTokenSecret, {
        expiresIn: '10m',
        issuer: this.issuer,
        audience: this.audience
      });
    } catch (error) {
      throw new Error(`Failed to generate password reset token: ${error.message}`);
    }
  }

  verifyPasswordResetToken(token) {
    try {
      const decoded = jwt.verify(token, this.passwordResetTokenSecret, {
        issuer: this.issuer,
        audience: this.audience
      });

      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Password reset token has expired');
      }
      throw new Error('Invalid password reset token');
    }
  }

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

module.exports = JwtServiceImpl;
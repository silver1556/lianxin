const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const securityConfig = require('../config/security.config');
const logger = require('./logger.util');
const { AuthError } = require('../errors/authError');

/**
 * JWT Utility Class
 * Handles JWT token creation, verification, and management
 */
class JWTUtil {
  constructor() {
    this.accessTokenSecret = securityConfig.jwt.accessTokenSecret;
    this.refreshTokenSecret = securityConfig.jwt.refreshTokenSecret;
    this.accessTokenExpiry = securityConfig.jwt.accessTokenExpiry;
    this.refreshTokenExpiry = securityConfig.jwt.refreshTokenExpiry;
    this.algorithm = securityConfig.jwt.algorithm;
    this.issuer = securityConfig.jwt.issuer;
    this.audience = securityConfig.jwt.audience;
    this.clockTolerance = securityConfig.jwt.clockTolerance;
    this.enablePayloadEncryption = securityConfig.jwt.enablePayloadEncryption;
    this.payloadEncryptionKey = securityConfig.jwt.payloadEncryptionKey;
  }
  
  /**
   * Generate access token
   */
  generateAccessToken(payload, options = {}) {
    try {
      const tokenPayload = {
        ...payload,
        type: 'access',
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000)
      };
      
      // Encrypt payload if enabled
      const finalPayload = this.enablePayloadEncryption ? 
        this.encryptPayload(tokenPayload) : tokenPayload;
      
      const tokenOptions = {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        subject: payload.userId?.toString() || payload.sub?.toString(),
        ...options
      };
      
      const token = jwt.sign(finalPayload, this.accessTokenSecret, tokenOptions);
      
      logger.debug('Access token generated', {
        userId: payload.userId,
        jti: tokenPayload.jti,
        expiresIn: tokenOptions.expiresIn
      });
      
      return token;
    } catch (error) {
      logger.error('Failed to generate access token', {
        error: error.message,
        userId: payload.userId
      });
      throw new AuthError('Failed to generate access token');
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
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000)
      };
      
      // Encrypt payload if enabled
      const finalPayload = this.enablePayloadEncryption ? 
        this.encryptPayload(tokenPayload) : tokenPayload;
      
      const tokenOptions = {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        subject: payload.userId?.toString() || payload.sub?.toString(),
        ...options
      };
      
      const token = jwt.sign(finalPayload, this.refreshTokenSecret, tokenOptions);
      
      logger.debug('Refresh token generated', {
        userId: payload.userId,
        jti: tokenPayload.jti,
        expiresIn: tokenOptions.expiresIn
      });
      
      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token', {
        error: error.message,
        userId: payload.userId
      });
      throw new AuthError('Failed to generate refresh token');
    }
  }
  
  /**
   * Generate token pair (access + refresh)
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
        expires_in: this.getExpirationTime(accessTokenDecoded.exp),
        refresh_expires_in: this.getExpirationTime(refreshTokenDecoded.exp),
        issued_at: new Date().toISOString(),
        access_token_jti: accessTokenDecoded.jti,
        refresh_token_jti: refreshTokenDecoded.jti
      };
    } catch (error) {
      logger.error('Failed to generate token pair', {
        error: error.message,
        userId: payload.userId
      });
      throw new AuthError('Failed to generate token pair');
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
        clockTolerance: this.clockTolerance,
        ...options
      };
      
      const decoded = jwt.verify(token, this.accessTokenSecret, verifyOptions);
      
      // Decrypt payload if needed
      const payload = this.enablePayloadEncryption ? 
        this.decryptPayload(decoded) : decoded;
      
      // Verify token type
      if (payload.type !== 'access') {
        throw new AuthError('Invalid token type');
      }
      
      logger.debug('Access token verified', {
        userId: payload.userId,
        jti: payload.jti
      });
      
      return payload;
    } catch (error) {
      logger.warn('Access token verification failed', {
        error: error.message,
        name: error.name
      });
      
      if (error.name === 'TokenExpiredError') {
        throw AuthError.expiredToken('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw AuthError.invalidToken('Invalid access token');
      } else if (error.name === 'NotBeforeError') {
        throw AuthError.invalidToken('Token not active yet');
      }
      
      throw AuthError.invalidToken('Token verification failed');
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
        clockTolerance: this.clockTolerance,
        ...options
      };
      
      const decoded = jwt.verify(token, this.refreshTokenSecret, verifyOptions);
      
      // Decrypt payload if needed
      const payload = this.enablePayloadEncryption ? 
        this.decryptPayload(decoded) : decoded;
      
      // Verify token type
      if (payload.type !== 'refresh') {
        throw new AuthError('Invalid token type');
      }
      
      logger.debug('Refresh token verified', {
        userId: payload.userId,
        jti: payload.jti
      });
      
      return payload;
    } catch (error) {
      logger.warn('Refresh token verification failed', {
        error: error.message,
        name: error.name
      });
      
      if (error.name === 'TokenExpiredError') {
        throw AuthError.expiredToken('Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw AuthError.invalidToken('Invalid refresh token');
      } else if (error.name === 'NotBeforeError') {
        throw AuthError.invalidToken('Token not active yet');
      }
      
      throw AuthError.invalidToken('Token verification failed');
    }
  }
  
  /**
   * Decode token without verification
   */
  decode(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.warn('Token decode failed', {
        error: error.message
      });
      throw AuthError.invalidToken('Invalid token format');
    }
  }
  
  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader) {
    if (!authHeader) {
      throw AuthError.missingToken('Authorization header is missing');
    }
    
    const [bearer, token] = authHeader.split(' ');
    
    if (bearer !== 'Bearer' || !token) {
      throw AuthError.invalidToken('Invalid authorization header format');
    }
    
    return token;
  }
  
  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    try {
      const decoded = this.decode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      return decoded.payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }
  
  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decode(token);
      return new Date(decoded.payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get token issued time
   */
  getTokenIssuedAt(token) {
    try {
      const decoded = this.decode(token);
      return new Date(decoded.payload.iat * 1000);
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get token JTI (JWT ID)
   */
  getTokenJTI(token) {
    try {
      const decoded = this.decode(token);
      return decoded.payload.jti;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken, newPayload = {}) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Create new payload with updated data
      const payload = {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        deviceId: decoded.deviceId,
        roles: decoded.roles,
        permissions: decoded.permissions,
        ...newPayload
      };
      
      // Generate new access token
      const newAccessToken = this.generateAccessToken(payload);
      
      logger.info('Access token refreshed', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        oldJti: decoded.jti,
        newJti: this.getTokenJTI(newAccessToken)
      });
      
      return {
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: this.getExpirationTime(this.decode(newAccessToken).payload.exp),
        issued_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to refresh access token', {
        error: error.message
      });
      throw AuthError.tokenRefreshFailed('Failed to refresh access token');
    }
  }
  
  /**
   * Encrypt payload
   */
  encryptPayload(payload) {
    if (!this.enablePayloadEncryption) {
      return payload;
    }
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.payloadEncryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted: true,
        data: encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      logger.error('Failed to encrypt payload', {
        error: error.message
      });
      throw new AuthError('Failed to encrypt payload');
    }
  }
  
  /**
   * Decrypt payload
   */
  decryptPayload(payload) {
    if (!this.enablePayloadEncryption || !payload.encrypted) {
      return payload;
    }
    
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.payloadEncryptionKey);
      
      let decrypted = decipher.update(payload.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt payload', {
        error: error.message
      });
      throw new AuthError('Failed to decrypt payload');
    }
  }
  
  /**
   * Get expiration time in seconds
   */
  getExpirationTime(exp) {
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, exp - currentTime);
  }
  
  /**
   * Create JWT for password reset
   */
  generatePasswordResetToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'password_reset',
      jti: crypto.randomUUID()
    };
    
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '15m',
      issuer: this.issuer,
      audience: this.audience
    });
  }
  
  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience
      });
      
      if (decoded.type !== 'password_reset') {
        throw new AuthError('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AuthError.expiredToken('Password reset token has expired');
      }
      throw AuthError.invalidToken('Invalid password reset token');
    }
  }
  
  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'email_verification',
      jti: crypto.randomUUID()
    };
    
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '24h',
      issuer: this.issuer,
      audience: this.audience
    });
  }
  
  /**
   * Verify email verification token
   */
  verifyEmailVerificationToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience
      });
      
      if (decoded.type !== 'email_verification') {
        throw new AuthError('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AuthError.expiredToken('Email verification token has expired');
      }
      throw AuthError.invalidToken('Invalid email verification token');
    }
  }
}

module.exports = new JWTUtil();
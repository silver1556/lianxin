const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const securityConfig = require("../config/security.config");
const logger = require("../../../../shared/utils/logger.util");
const AuthError = require("../../../../shared/errors/authError");

/**
 * JWT Utility Class
 * Handles JWT token creation, verification, and management
 */
class JWTUtil {
  constructor() {
    this.accessTokenSecret = securityConfig.jwt.accessTokenSecret;
    this.refreshTokenSecret = securityConfig.jwt.refreshTokenSecret;
    this.passwordResetTokenSecret = securityConfig.jwt.passwordResetTokenSecret;
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
        type: "access",
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000),
      };

      // Encrypt payload if enabled
      const finalPayload = this.enablePayloadEncryption
        ? this.encryptPayload(tokenPayload)
        : tokenPayload;

      const tokenOptions = {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        subject: payload.userId?.toString() || payload.sub?.toString(),
        ...options,
      };

      const token = jwt.sign(
        finalPayload,
        this.accessTokenSecret,
        tokenOptions
      );

      logger.debug("Access token generated", {
        userId: payload.userId,
        jti: tokenPayload.jti,
        expiresIn: tokenOptions.expiresIn,
      });

      return token;
    } catch (error) {
      logger.error("Failed to generate access token", {
        error: error.message,
        userId: payload.userId,
      });
      throw AuthError.invalidToken("Failed to generate access token");
    }
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload, options = {}) {
    try {
      const tokenPayload = {
        ...payload,
        type: "refresh",
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000),
      };

      // Encrypt payload if enabled
      const finalPayload = this.enablePayloadEncryption
        ? this.encryptPayload(tokenPayload)
        : tokenPayload;

      const tokenOptions = {
        algorithm: this.algorithm,
        expiresIn: options.expiresIn || this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        subject: payload.userId?.toString() || payload.sub?.toString(),
        ...options,
      };

      const token = jwt.sign(
        finalPayload,
        this.refreshTokenSecret,
        tokenOptions
      );

      logger.debug("Refresh token generated", {
        userId: payload.userId,
        jti: tokenPayload.jti,
        expiresIn: tokenOptions.expiresIn,
      });

      return token;
    } catch (error) {
      logger.error("Failed to generate refresh token", {
        error: error.message,
        userId: payload.userId,
      });
      throw AuthError.invalidToken("Failed to generate refresh token");
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
        access_token: accessToken, //raw token
        refresh_token: refreshToken, //raw token
        token_type: "Bearer",
        expires_in: this.getExpirationTime(accessTokenDecoded.exp),
        expires_at: new Date(accessTokenDecoded.exp * 1000),
        refresh_expires_in: this.getExpirationTime(refreshTokenDecoded.exp),
        refresh_expires_at: new Date(refreshTokenDecoded.exp * 1000),
        issued_at: new Date().toISOString(),
        access_token_jti: accessTokenDecoded.jti,
        refresh_token_jti: refreshTokenDecoded.jti,
      };
    } catch (error) {
      logger.error("Failed to generate token pair", {
        error: error.message,
        userId: payload.userId,
      });
      throw AuthError.invalidToken("Failed to generate token pair");
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
        ...options,
      };

      const decoded = jwt.verify(token, this.accessTokenSecret, verifyOptions);

      // Decrypt payload if needed
      const payload = this.enablePayloadEncryption
        ? this.decryptPayload(decoded)
        : decoded;

      // Verify token type
      if (payload.type !== "access") {
        throw AuthError.invalidTokenType("Invalid token type");
      }

      logger.debug("Access token verified", {
        sessionId: payload.sessionId,
        userId: payload.userId,
        jti: payload.jti,
      });

      return payload;
    } catch (error) {
      logger.warn("Access token verification failed", {
        error: error.message,
        name: error.name,
      });

      if (error.name === "TokenExpiredError") {
        throw AuthError.tokenExpired("Access token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw AuthError.invalidToken("Invalid access token");
      } else if (error.name === "NotBeforeError") {
        throw AuthError.invalidToken("Token not active yet");
      }

      // If it's already an AuthError, re-throw it
      if (error instanceof AuthError) {
        throw error;
      }

      throw AuthError.invalidToken("Token verification failed");
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
        ...options,
      };

      const decoded = jwt.verify(token, this.refreshTokenSecret, verifyOptions);

      // Decrypt payload if needed
      const payload = this.enablePayloadEncryption
        ? this.decryptPayload(decoded)
        : decoded;

      // Verify token type
      if (payload.type !== "refresh") {
        throw AuthError.invalidTokenType("Invalid token type");
      }

      logger.debug("Refresh token verified", {
        userId: payload.userId,
        jti: payload.jti,
      });

      return payload;
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw AuthError.tokenExpired("Refresh token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw AuthError.invalidToken("Invalid refresh token");
      } else if (error.name === "NotBeforeError") {
        throw AuthError.invalidToken("Token not active yet");
      }

      // If it's already an AuthError, re-throw it
      if (error instanceof AuthError) {
        throw error;
      }

      throw AuthError.invalidToken("Refresh token verification failed");
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader) {
    if (!authHeader) {
      throw AuthError.tokenMissing("Authorization header is missing");
    }

    const [bearer, token] = authHeader.split(" ");

    if (bearer !== "Bearer" || !token) {
      throw AuthError.invalidToken("Invalid authorization header format");
    }

    return token;
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
        ...newPayload,
      };

      // Generate new access token
      const newAccessToken = this.generateAccessToken(payload);

      logger.info("Access token refreshed", {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        oldJti: decoded.jti,
        newJti: this.getTokenJTI(newAccessToken),
      });

      return {
        access_token: newAccessToken,
        token_type: "Bearer",
        expires_in: this.getExpirationTime(
          this.decode(newAccessToken).payload.exp
        ),
        issued_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to refresh access token", {
        error: error.message,
      });

      // If it's already an AuthError, re-throw it
      if (error instanceof AuthError) {
        throw error;
      }

      throw AuthError.invalidToken("Failed to refresh access token");
    }
  }

  /**
   * Create JWT token for password reset
   */
  generatePasswordResetToken(phone, verification_id) {
    try {
      const payload = {
        phone,
        verification_id,
        type: "password_reset",
        iat: Math.floor(Date.now() / 1000), // issued at
      };

      return jwt.sign(payload, this.passwordResetTokenSecret, {
        expiresIn: "10m",
        issuer: this.issuer,
        audience: this.audience,
      });
    } catch (error) {
      logger.error("Failed to generate password reset token", {
        error: error.message,
        phone: phone,
      });
      throw AuthError.invalidToken("Failed to generate password reset token");
    }
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token) {
    try {
      const decoded = jwt.verify(token, this.passwordResetTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return decoded;
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw AuthError.tokenExpired("Password reset token has expired");
      }
      throw AuthError.invalidToken("Invalid password reset token");
    }
  }

  /**
   * Encrypt payload if needed
   */
  encryptPayload(payload) {
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(this.payloadEncryptionKey, "hex"),
        iv
      );

      let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag().toString("hex");

      return {
        encrypted: true,
        data: encrypted,
        iv: iv.toString("hex"),
        tag: authTag,
      };
    } catch (error) {
      logger.error("Failed to encrypt payload", {
        error: error.message,
      });
      throw new AuthError("Failed to encrypt payload", 500, "ENCRYPTION_ERROR");
    }
  }

  /**
   * Decrypt payload
   */
  decryptPayload({ data, iv, tag }) {
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(this.payloadEncryptionKey, "hex"),
        Buffer.from(iv, "hex")
      );
      decipher.setAuthTag(Buffer.from(tag, "hex"));

      let decrypted = decipher.update(data, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);
    } catch (error) {
      logger.error("Failed to decrypt payload", {
        error: error.message,
      });
      throw new AuthError("Failed to decrypt payload", 500, "DECRYPTION_ERROR");
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
   * Get token JTI (JWT ID)
   */
  getTokenJTI(token) {
    try {
      const decoded = this.decode(token);
      return decoded.payload.jti;
    } catch {
      return null;
    }
  }

  /**
   * Decode token without verification
   */
  decode(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.warn("Token decode failed", {
        error: error.message,
      });
      throw AuthError.invalidToken("Invalid token format");
    }
  }
}

module.exports = new JWTUtil();

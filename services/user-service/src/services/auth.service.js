const {
  User,
  OtpVerification,
  UserSetting,
  UserPrivacySetting,
  UserProfile,
  sequelize,
} = require("../models");
const sessionService = require("./session.service");
const encryptionService = require("./encryption.service");
const otpService = require("./otp.service");
const jwtUtil = require("../utils/jwt.util");
const passwordUtil = require("../utils/password.util");
const phoneUtil = require("../utils/phone.util");
const logger = require("../../../../shared/utils/logger.util");
const AuthError = require("../../../../shared/errors/authError");
const ValidationError = require("../../../../shared/errors/validationError");
const redisClient = require("../../../../shared/libraries/cache/redis.client");
const AppError = require("../../../../shared/errors/appError");

/**
 * Authentication Service
 * Handles user registration, login, logout, and password management
 */
class AuthService {
  /**
   * Register new user
   */
  async registerUser(registrationData) {
    let user, profile, session;
    const {
      phone, //without country code
      country_code,
      password,
      verification_id,
      otp_code,
      device_id,
      device_type,
      device_name,
      ipAddress,
      userAgent,
    } = registrationData;

    try {
      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(
        phone,
        country_code
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // // Generate phone hash to search for hashed number
      const phoneHash = encryptionService.hashData(formattedPhoneE164);

      // Verify OTP
      await otpService.verifyOtp(verification_id, otp_code, phoneHash);

      // Validate password strength
      passwordUtil.validatePassword(password);

      // Prepare user data
      const userData = {
        phone: formattedPhoneE164,
        phone_hash: phoneHash,
        password_hash: password, // password is hashed inside user model
        registration_ip: ipAddress,
        last_ip: ipAddress,
        status: "active",
      };

      // Encrypt sensitive fields
      const encryptedUserData = await encryptionService.encryptUserData(
        userData
      );

      logger.info(`encryptedUserData:${encryptedUserData}`);

      // Start transaction
      await sequelize.transaction(async (t) => {
        // Create user
        user = await User.create(encryptedUserData, { transaction: t });

        // Create user settings with default values
        await UserSetting.createDefault(user.id, { transaction: t });

        // Create user profile with default values
        profile = await UserProfile.createDefault(user.id, { transaction: t });

        // Create user privacy settings with default values
        await UserPrivacySetting.createDefault(user.id, { transaction: t });

        // Create device info and session
        const deviceInfo = {
          device_id: device_id,
          device_type,
          device_name,
          os: this.extractOSFromUserAgent(userAgent),
          browser: this.extractBrowserFromUserAgent(userAgent),
        };

        session = await sessionService.createSession(
          user.id,
          deviceInfo,
          ipAddress,
          userAgent,
          t
        );
      });

      // Update OTP record with user_id
      await OtpVerification.update(
        { user_id: user.id },
        { where: { verification_id: verification_id } }
      );

      logger.info("User registered successfully", {
        userId: user.id,
        sessionId: session.session_id,
        ipAddress,
      });

      return {
        user: {
          uuid: user.uuid,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          is_verified: user.is_verified,
        },
        tokens: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
      };
    } catch (error) {
      logger.error("User registration failed", {
        phone: registrationData.phone,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Login user
   */
  async loginUser(loginData) {
    const startTime = Date.now();
    const {
      phone,
      country_code,
      password,
      verification_id,
      otp_code,
      device_id,
      device_type,
      device_name,
      ipAddress,
      userAgent,
    } = loginData;
    try {
      // Check pre-login lock
      const lockStatus = await this.checkLockStatus(device_id, ipAddress);
      const retryAfter = Math.max(
        lockStatus.device.unlocksIn || 0,
        lockStatus.ip.unlocksIn || 0
      );

      if (lockStatus.locked) {
        throw AppError.tooManyRequests(
          "Too many failed login attempts. Try again later.",
          "RATE_LIMIT_EXCEEDED",
          retryAfter
        );
      }

      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(
        phone,
        country_code
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // Generate phone hash to search for hashed number
      const phoneHash = encryptionService.hashData(formattedPhoneE164);

      // Find user by phone hash
      const user = await User.findByPhoneHash(phoneHash);
      if (!user) {
        throw AuthError.invalidCredentials("Phone number not found");
      }

      // Authenticate user
      let authenticationSuccess = false;

      if (password) {
        // Password-based login
        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
          await this.recordFailedLogin(device_id, ipAddress);
          throw AuthError.invalidCredentials("Invalid password");
        }

        authenticationSuccess = true;
      } else if (verification_id && otp_code) {
        try {
          // OTP-based login
          // Verify OTP
          await otpService.verifyOtp(verification_id, otp_code, phoneHash);

          await OtpVerification.update(
            { user_id: user.id },
            { where: { verification_id: verification_id } }
          );

          authenticationSuccess = true;
        } catch (error) {
          await this.recordFailedLogin(device_id, ipAddress);
          throw error;
        }
      } else {
        throw ValidationError.requiredField(
          "authentication",
          "Either password or OTP is required for login"
        );
      }

      // Check account status
      if (user.isSuspended()) {
        throw AuthError.accountSuspended("Account is suspended", {
          suspensionUntil: user.suspension_until,
          reason: user.suspension_reason,
        });
      }

      // Reactivate if status is pending_deletion or deactivated
      if (["pending_deletion", "deactivated"].includes(user.status)) {
        await this.reactivateAccount(user);
      }

      // Successful login
      if (authenticationSuccess) {
        // Reset failed login counters
        await this.resetLoginAttempts(device_id, ipAddress);

        // Update login tracking
        await user.update({
          last_login: new Date(),
          last_ip: ipAddress,
        });

        // Create device info
        const deviceInfo = {
          device_id,
          device_type,
          device_name,
          os: this.extractOSFromUserAgent(userAgent),
          browser: this.extractBrowserFromUserAgent(userAgent),
        };

        // Create session
        const session = await sessionService.createSession(
          user.id,
          deviceInfo,
          ipAddress,
          userAgent
        );

        // Fetch user profile from database
        const profileData = await UserProfile.findOne({
          where: { user_id: user.id },
          attributes: ["display_name", "avatar_url", "gender", "birth_date"],
          raw: true, // plain JavaScript object
        });

        // Include is_verified from User table
        profileData.is_verified = user.is_verified;

        // Hot cache in Redis
        await redisClient.cacheUserProfile(user.id, profileData, "hot");

        logger.info("User logged in successfully", {
          userId: user.id,
          sessionId: session.session_id,
          ipAddress,
          loginMethod: password ? "password" : "otp",
        });

        return {
          user: {
            uuid: user.uuid,
            display_name: profileData.display_name,
            avatar_url: profileData.avatar_url,
            location: decryptedUser.location,
            is_verified: profileData.is_verified,
          },
          session: {
            expires_at: session.expires_at, //access token expiration
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
          loginMethod: password ? "password" : "otp",
        };
      }
    } catch (error) {
      logger.error("User login failed", {
        phone: phone,
        error: error.message,
        ipAddress: ipAddress,
        totalTime: `${Date.now() - startTime}ms`,
      });

      throw error;
    }
  }

  /**
   * Refresh access token and rotate refresh tokens
   */
  async refreshAndRotateTokens(refreshToken) {
    try {
      // refresh token cryptographic validation
      const payload = jwtUtil.verifyRefreshToken(refreshToken);

      // Call session service to Verify and Get session by refresh token
      const session = await sessionService.getSessionByRefreshToken(
        refreshToken
      );

      // Generate new tokens
      const newTokenPayload = {
        userId: payload.userId,
        sessionId: session.session_id,
        deviceId: payload.deviceId,
        roles: payload.roles || ["user"],
        permissions: payload.permissions || [],
      };

      const tokens = jwtUtil.generateTokenPair(newTokenPayload);

      // Hash new refresh token
      const newRefreshTokenHash = encryptionService.hashData(
        tokens.refresh_token
      );

      // Update session with new refresh token
      session.refresh_token = newRefreshTokenHash;
      session.expires_at = tokens.refresh_expires_at;
      session.refresh_issued_at = tokens.issued_at;
      await session.save();

      logger.info("Tokens refreshed successfully", {
        userId: payload.userId,
        sessionId: session.session_id,
      });

      return tokens;
    } catch (error) {
      logger.error("Token refresh failed", {
        error: error.message,
      });

      throw AuthError.tokenRefreshFailed("Failed to refresh tokens");
    }
  }

  /**
   * Logout user
   */
  async logoutUser(accessToken) {
    try {
      // Verify access token
      const payload = jwtUtil.verifyAccessToken(accessToken);

      // Revoke session
      await sessionService.revokeSession(payload.sessionId, payload.userId);

      logger.info("User logged out successfully", {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return { success: true };
    } catch (error) {
      logger.error("Logout failed", {
        error: error.message,
      });

      throw AuthError.logoutFailed("Failed to logout user");
    }
  }

  /**
   * Verify otp for Reset password
   */
  async verifyResetOtp(otpData) {
    try {
      const { phone, country_code, verification_id, otp_code } = otpData;

      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(
        phone,
        country_code
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // Generate phone hash to search for hashed number
      const phoneHash = await encryptionService.hashData(formattedPhoneE164);

      // Verify OTP
      await otpService.verifyOtp(verification_id, otp_code, phoneHash);

      // Generate reset token
      const resetToken = await jwtUtil.generatePasswordResetToken(
        formattedPhoneE164,
        verification_id
      );

      return resetToken;
    } catch (error) {
      logger.error("OTP verification failed", {
        phone: otpData.phone,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(resetData) {
    const t = await sequelize.transaction();

    try {
      const { formattedPhoneE164, reset_token, new_password } = resetData;

      // Verify reset token
      const tokenPayload = jwtUtil.verifyPasswordResetToken(reset_token);
      if (!tokenPayload) {
        throw AuthError.invalidToken("Invalid reset token");
      }

      if (tokenPayload.type !== "password_reset") {
        throw new AuthError("Invalid token type");
      }

      if (!tokenPayload.phone || !tokenPayload.verification_id) {
        throw new AuthError("Invalid token payload");
      }

      if (tokenPayload.phone !== formattedPhoneE164) {
        throw new AuthError("Invalid phone number");
      }

      // Validate new password
      passwordUtil.validatePassword(new_password);

      // Generate phone hash to search user by hashed number
      const phoneHash = await encryptionService.hashData(formattedPhoneE164);

      // Find user by phone hash
      const user = await User.findByPhoneHash(phoneHash);
      if (!user) {
        throw AuthError.userNotFound("User not found");
      }

      // Check if the token is already used
      // If the token's issued at time is less than or equal to the user's last password change time, it means the token is already used
      // get user password_last_changed_at
      const password_last_changed_at = Math.floor(
        (user.password_changed_at instanceof Date
          ? user.password_changed_at
          : new Date(user.password_changed_at)
        ).getTime() / 1000
      );

      // compare user password_last_changed_at with token issued at
      if (tokenPayload.iat <= password_last_changed_at) {
        throw AuthError.invalidToken(
          "Token already used or password already changed"
        );
      }

      // Check account status
      if (user.status === "suspended") {
        throw AuthError.accountSuspended(
          "Cannot reset password for suspended account"
        );
      }

      // Throw error if new password is same as current password
      const compareNewPassword = await user.validatePassword(new_password);
      if (compareNewPassword) {
        throw ValidationError.passwordReuse(
          "New password can not be same as current password"
        );
      }

      // Check password history if password is reused
      if (await user.isPasswordReused(new_password)) {
        throw ValidationError.passwordReuse(
          "New password cannot be same as old passwords"
        );
      }

      // Update password
      await user.update(
        {
          password_hash: new_password,
          failed_login_attempts: 0,
          last_failed_login: null,
        },
        { transaction: t }
      );

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(user.id, null, null, t);

      await t.commit();

      await OtpVerification.update(
        { user_id: user.id },
        { where: { verification_id: tokenPayload.verification_id } }
      );

      logger.info("Password reset successfully", {
        userId: user.id,
      });

      return true;
    } catch (error) {
      await t.rollback();
      logger.error("Password reset failed, roll back transaction", {
        phone: resetData.phone,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Helper function to Record failed login attempt
   */
  async recordFailedLogin(deviceId, ipAddress) {
    const lockTime = 30 * 60; // 30 min
    const deviceKey = `user:login:fail:device:${deviceId}`;
    const ipKey = `user:login:fail:ip:${ipAddress}`;

    const [deviceAttempts, ipAttempts] = await Promise.all([
      redisClient.incr(deviceKey),
      redisClient.incr(ipKey),
    ]);

    // First failure → set expiry window
    if (deviceAttempts === 1) await redisClient.expire(deviceKey, lockTime);
    if (ipAttempts === 1) await redisClient.expire(ipKey, lockTime);

    return { deviceAttempts, ipAttempts };
  }

  /**
   * Reset failed login attempts
   */
  async resetLoginAttempts(deviceId, ipAddress) {
    const deviceKey = `user:login:fail:device:${deviceId}`;
    const ipKey = `user:login:fail:ip:${ipAddress}`;

    await Promise.all([redisClient.del(deviceKey), redisClient.del(ipKey)]);
  }

  /**
   *  Check if locked and return remaining time
   */
  async checkLockStatus(deviceId, ipAddress) {
    const maxAttempts = 5;

    const deviceKey = `user:login:fail:device:${deviceId}`;
    const ipKey = `user:login:fail:ip:${ipAddress}`;

    const [deviceAttempts, ipAttempts, deviceTTL, ipTTL] = await Promise.all([
      redisClient.get(deviceKey),
      redisClient.get(ipKey),
      redisClient.ttl(deviceKey),
      redisClient.ttl(ipKey),
    ]);

    const isDeviceLocked = parseInt(deviceAttempts || "0") >= maxAttempts;
    const isIpLocked = parseInt(ipAttempts || "0") >= maxAttempts;

    return {
      locked: isDeviceLocked || isIpLocked,
      device: {
        attempts: parseInt(deviceAttempts || "0"),
        unlocksIn: deviceTTL,
      },
      ip: { attempts: parseInt(ipAttempts || "0"), unlocksIn: ipTTL },
    };
  }

  /**
   * Reactivate account
   */
  async reactivateAccount(user) {
    await user.update({
      status: "active",
      deactivated_at: null,
      pending_deletion_at: null,
    });

    logger.info("Account reactivated", {
      userId: user.id,
      phone: user.phone,
    });
  }

  /**
   * Extract OS from User-Agent
   */
  extractOSFromUserAgent(userAgent) {
    if (!userAgent) return "Unknown";

    if (userAgent.includes("iPhone")) return "iOS";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Macintosh")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";

    return "Unknown";
  }

  /**
   * Extract browser from User-Agent
   */
  extractBrowserFromUserAgent(userAgent) {
    if (!userAgent) return "Unknown";

    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";

    return "Unknown";
  }
}

module.exports = new AuthService();

const {
  User,
  OtpVerification,
  UserSettings,
  UserPrivacySettings,
  UserProfile,
} = require("../models");
const sessionService = require("./session.service");
const encryptionService = require("./encryption.service");
const otpService = require("./otp.service");
const jwtUtil = require("../utils/jwt.util");
const passwordUtil = require("../utils/password.util");
const phoneUtil = require("../utils/phone.util");
const logger = require("../utils/logger.util");
const { AuthError } = require("../errors/authError");
const { ValidationError } = require("../errors/validationError");
const { sequelize } = require("../models");

/**
 * Authentication Service
 * Handles user registration, login, logout, and password management
 */
class AuthService {
  /**
   * Register new user
   */
  async registerUser(registrationData) {
    let user, session;
    const {
      phone, //without country code
      country_code,
      password,
      verification_id,
      otp_code,
      device_id,
      device_type,
      device_name,
      display_name,
      avatar_url,
      gender,
      birth_date,
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

      // Verify OTP
      const otpVerification = await otpService.verifyOtp(
        verification_id,
        otp_code,
        phone,
        country_code
      );

      if (otpVerification.otp_type !== "registration") {
        throw AuthError.invalidOTP("Invalid OTP type for registration");
      }

      // // Generate phone hash to search for hashed number
      const phoneHash = await encryptionService.hashData(formattedPhoneE164);

      // Validate password strength
      passwordUtil.validatePassword(password);

      // Prepare user data
      const userData = {
        phone: formattedPhoneE164,
        country_code: phoneValidation.countryCode,
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

      // Start transaction
      await sequelize.transaction(async (t) => {
        // Create user
        user = await User.create(encryptedUserData, { transaction: t });

        // Create user settings with default values
        await UserSettings.createDefault(user.id, { transaction: t });

        // Create user profile with default values
        await UserProfile.createDefault(
          user.id,
          {
            display_name: display_name,
            avatar_url: avatar_url,
            gender: gender,
            birth_date: birth_date,
          },
          { transaction: t }
        );

        // Create user privacy settings with default values
        await UserPrivacySettings.createDefault(user.id, { transaction: t });

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
          display_name: display_name,
          avatar_url: avatar_url,
          gender: gender,
          birth_date: birth_date,
        },
        tokens: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        session: {
          id: session.session_id,
          expires_at: session.expires_at, // Access token expiration
        },
      };
    } catch (error) {
      logger.error("User registration failed", {
        phone: registrationData.phone,
        error: error.message,
        stack: error.stack,
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
      logger.debug("Login started", { took: `${Date.now() - startTime}ms` });
      // Validate phone number format
      const phoneValidationStart = Date.now();
      const phoneValidation = phoneUtil.validatePhoneNumber(
        phone,
        country_code
      );
      const formattedPhoneE164 = phoneValidation.e164;
      logger.debug("Phone validation done", {
        took: `${Date.now() - phoneValidationStart}ms`,
      });

      const phoneHashStart = Date.now();
      // Generate phone hash to search for hashed number
      const phoneHash = await encryptionService.hashData(formattedPhoneE164);
      logger.debug("Phone hash done", {
        took: `${Date.now() - phoneHashStart}ms`,
      });

      // Find user by phone hash
      const userLookupStart = Date.now();
      const user = await User.findByPhoneHash(phoneHash);
      if (!user) {
        throw AuthError.invalidCredentials("Phone number not registered");
      }
      logger.debug("User lookup done", {
        took: `${Date.now() - userLookupStart}ms`,
      });
      if (!user) {
        throw AuthError.invalidCredentials("Phone number not registered");
      }

      // Decrypt user data
      const decryptStart = Date.now();
      const decryptedUser = await encryptionService.decryptUserData(
        user.toJSON()
      );
      logger.debug("User decryption done", {
        took: `${Date.now() - decryptStart}ms`,
      });

      // Authenticate user
      const authStart = Date.now();
      let authenticationSuccess = false;

      if (password) {
        // Password-based login
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          await this.handleFailedLogin(user);
          throw AuthError.invalidCredentials("Invalid password");
        }
        authenticationSuccess = true;
      } else if (verification_id && otp_code) {
        // OTP-based login
        // Verify OTP
        const otpVerification = await otpService.verifyOtp(
          verification_id,
          otp_code,
          phone,
          country_code
        );

        if (otpVerification.otp_type !== "login") {
          throw AuthError.invalidOTP("Invalid OTP type for login");
        }

        await OtpVerification.update(
          { user_id: user.id },
          { where: { verification_id: verification_id } }
        );

        authenticationSuccess = true;
      } else {
        throw ValidationError.requiredField(
          "authentication",
          "Either password or OTP is required"
        );
      }
      logger.debug("Authentication step done", {
        took: `${Date.now() - authStart}ms`,
      });

      // Check if account can login
      if (user.isAccountLocked()) {
        throw AuthError.accountLocked(
          "Account is temporarily locked due to failed login attempts"
        );
      }
      if (user.isSuspended()) {
        throw AuthError.accountSuspended("Account is suspended", {
          suspensionUntil: user.suspension_until,
          reason: user.suspension_reason,
        });
      }

      const reactivateStart = Date.now();
      // Reactivate if status is pending_deletion or deactivated
      if (user.status === "pending_deletion") {
        // Reactivate account from pending deletion
        await this.reactivateAccount(user);
      } else if (user.status === "deactivated") {
        // Reactivate deactivated account
        await this.reactivateAccount(user);
      }
      logger.debug("Reactivation check done", {
        took: `${Date.now() - reactivateStart}ms`,
      });

      const updateStart = Date.now();
      if (authenticationSuccess) {
        // Reset failed login attempts
        if (user.failed_login_attempts > 0) {
          await user.update({
            failed_login_attempts: 0,
            last_failed_login: null,
          });
        }

        // Update login tracking
        await user.update({
          last_login: new Date(),
          login_count: user.login_count + 1,
          last_ip: ipAddress,
        });
        logger.debug("User update done", {
          took: `${Date.now() - updateStart}ms`,
        });

        // Create device info
        const sessionStart = Date.now();
        const deviceInfo = {
          device_id: device_id,
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
        logger.debug("Session creation done", {
          took: `${Date.now() - sessionStart}ms`,
        });

        logger.info("User logged in successfully", {
          userId: user.id,
          phone: formattedPhoneE164,
          sessionId: session.session_id,
          ipAddress,
          loginMethod: password ? "password" : "otp",
          totalTime: `${Date.now() - startTime}ms`,
        });

        return {
          user: {
            uuid: decryptedUser.uuid,
            display_name: decryptedUser.display_name,
            avatar_url: decryptedUser.avatar_url,
            location: decryptedUser.location,
            is_verified: decryptedUser.is_verified,
            status: decryptedUser.status,
            suspension_reason: decryptedUser.suspension_reason,
            suspension_until: decryptedUser.suspension_until,
          },
          tokens: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
          session: {
            id: session.session_id,
            expires_at: session.expires_at, //access token expiration
          },
        };
      }
    } catch (error) {
      logger.error("User login failed", {
        phone: loginData.phone,
        error: error.message,
        ipAddress: loginData.ipAddress,
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

      // Verify and Get session by refresh token
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
      const newRefreshTokenHash = await encryptionService.hashData(
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

      return { tokens };
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

      // Verify OTP
      const otpVerification = await otpService.verifyOtp(
        verification_id,
        otp_code,
        phone,
        country_code
      );

      if (otpVerification.otp_type !== "password_reset") {
        throw AuthError.invalidOTP("Invalid OTP type for password reset");
      }

      // Generate reset token
      const resetToken = await jwtUtil.generatePasswordResetToken(
        otpVerification.phone,
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
      const phoneHash = await encryptionService.hashData(tokenPayload.phone);

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
      logger.warn("Password reset token already used", {
        userId: user.id,
        phone: user.phone,
        tokenIssuedAt: tokenPayload.iat,
        passwordLastChangedAt: password_last_changed_at,
      });
      // compare user password_last_changed_at with token issued at
      if (tokenPayload.iat <= password_last_changed_at) {
        logger.warn("Password reset token already used", {
          userId: user.id,
          phone: user.phone,
          tokenIssuedAt: tokenPayload.iat,
          passwordLastChangedAt: password_last_changed_at,
        });
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

      return { message: "Password reset successful" };
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
   * Handle failed login attempt
   */
  async handleFailedLogin(user) {
    const failedAttempts = user.failed_login_attempts + 1;

    await user.update({
      failed_login_attempts: failedAttempts,
      last_failed_login: new Date(),
    });

    logger.warn("Failed login attempt", {
      userId: user.id,
      phone: user.phone,
      attempts: failedAttempts,
    });
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

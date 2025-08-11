const { User, UserSession, OtpVerification, UserSettings } = require('../models');
const sessionService = require('./session.service');
const encryptionService = require('./encryption.service');
const otpService = require('./otp.service');
const jwtUtil = require('../utils/jwt.util');
const passwordUtil = require('../utils/password.util');
const validationUtil = require('../utils/validation.util');
const phoneUtil = require('../utils/phone.util');
const logger = require('../utils/logger.util');
const { AuthError } = require('../errors/authError');
const { ValidationError } = require('../errors/validationError');
const { AppError } = require('../errors/AppError');
const { sequelize } = require('../models');

/**
 * Authentication Service
 * Handles user registration, login, logout, and password management
 */
class AuthService {
  /**
   * Register new user
   */
  async registerUser(registrationData) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        phone,
        password,
        verification_id,
        otp_code,
        device_id,
        device_type,
        device_name,
        ipAddress,
        userAgent
      } = registrationData;

      // Verify OTP first
      const otpVerification = await otpService.verifyOtp(verification_id, otp_code, phone);
      
      if (otpVerification.otp_type !== 'registration') {
        throw AuthError.invalidOTP('Invalid OTP type for registration');
      }

      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(phone);
      const formattedPhone = phoneValidation.formatted;

      // Check if phone number already exists
      const existingUser = await User.findByPhone(formattedPhone);
      if (existingUser) {
        throw AuthError.duplicatePhone('Phone number already registered', formattedPhone);
      }

      // Validate password strength
      passwordUtil.validatePassword(password);

      // Hash password
      const passwordHash = await passwordUtil.hashPassword(password);

      // Create user
      const userData = {
        phone: formattedPhone,
        country_code: phoneValidation.countryCode,
        password_hash: passwordHash,
        phone_verified: true,
        phone_verified_at: new Date(),
        registration_ip: ipAddress,
        last_ip: ipAddress,
        status: 'active'
      };

      // Encrypt sensitive data
      const encryptedUserData = await encryptionService.encryptUserData(userData);
      
      const user = await User.create(encryptedUserData, { transaction });

      // Create default user settings
      await UserSettings.createDefault(user.id, { transaction });

      // Create device info
      const deviceInfo = {
        device_id,
        device_type,
        device_name,
        os: this.extractOSFromUserAgent(userAgent),
        browser: this.extractBrowserFromUserAgent(userAgent)
      };

      // Create session
      const session = await sessionService.createSession(
        user.id,
        deviceInfo,
        ipAddress,
        userAgent
      );

      // Generate JWT tokens
      const tokenPayload = {
        userId: user.id,
        sessionId: session.session_id,
        deviceId: device_id,
        roles: ['user'],
        permissions: []
      };

      const tokens = jwtUtil.generateTokenPair(tokenPayload);

      await transaction.commit();

      // Decrypt user data for response
      const decryptedUser = await encryptionService.decryptUserData(user.toJSON());

      logger.info('User registered successfully', {
        userId: user.id,
        phone: formattedPhone,
        sessionId: session.session_id,
        ipAddress
      });

      return {
        user: this.sanitizeUserForResponse(decryptedUser),
        tokens,
        session: {
          id: session.session_id,
          expires_at: session.expires_at
        }
      };
    } catch (error) {
      await transaction.rollback();
      
      logger.error('User registration failed', {
        phone: registrationData.phone,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * Login user
   */
  async loginUser(loginData) {
    try {
      const {
        phone,
        password,
        verification_id,
        otp_code,
        device_id,
        device_type,
        device_name,
        ipAddress,
        userAgent
      } = loginData;

      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(phone);
      const formattedPhone = phoneValidation.formatted;

      // Find user by phone
      const user = await User.findByPhone(formattedPhone);
      if (!user) {
        throw AuthError.invalidCredentials('Phone number not registered');
      }

      // Decrypt user data
      const decryptedUser = await encryptionService.decryptUserData(user.toJSON());

      // Check if account can login
      if (!user.canLogin()) {
        if (user.isAccountLocked()) {
          throw AuthError.accountLocked('Account is temporarily locked due to failed login attempts');
        }
        if (user.isSuspended()) {
          throw AuthError.accountSuspended('Account is suspended', {
            suspensionUntil: user.suspension_until,
            reason: user.suspension_reason
          });
        }
        if (user.status === 'pending_deletion') {
          // Reactivate account from pending deletion
          await this.reactivateAccount(user);
        } else if (user.status === 'deactivated') {
          // Reactivate deactivated account
          await this.reactivateAccount(user);
        }
      }

      // Authenticate user
      let authenticationSuccess = false;

      if (password) {
        // Password-based login
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          await this.handleFailedLogin(user);
          throw AuthError.invalidCredentials('Invalid password');
        }
        authenticationSuccess = true;
      } else if (verification_id && otp_code) {
        // OTP-based login
        const otpVerification = await otpService.verifyOtp(verification_id, otp_code, phone);
        
        if (otpVerification.otp_type !== 'login') {
          throw AuthError.invalidOTP('Invalid OTP type for login');
        }
        authenticationSuccess = true;
      } else {
        throw ValidationError.requiredField('authentication', 'Either password or OTP is required');
      }

      if (authenticationSuccess) {
        // Reset failed login attempts
        if (user.failed_login_attempts > 0) {
          await user.update({
            failed_login_attempts: 0,
            last_failed_login: null
          });
        }

        // Update login tracking
        await user.update({
          last_login: new Date(),
          login_count: user.login_count + 1,
          last_ip: ipAddress
        });

        // Create device info
        const deviceInfo = {
          device_id,
          device_type,
          device_name,
          os: this.extractOSFromUserAgent(userAgent),
          browser: this.extractBrowserFromUserAgent(userAgent)
        };

        // Create session
        const session = await sessionService.createSession(
          user.id,
          deviceInfo,
          ipAddress,
          userAgent
        );

        // Generate JWT tokens
        const tokenPayload = {
          userId: user.id,
          sessionId: session.session_id,
          deviceId: device_id,
          roles: ['user'],
          permissions: []
        };

        const tokens = jwtUtil.generateTokenPair(tokenPayload);

        logger.info('User logged in successfully', {
          userId: user.id,
          phone: formattedPhone,
          sessionId: session.session_id,
          ipAddress,
          loginMethod: password ? 'password' : 'otp'
        });

        return {
          user: this.sanitizeUserForResponse(decryptedUser),
          tokens,
          session: {
            id: session.session_id,
            expires_at: session.expires_at
          }
        };
      }
    } catch (error) {
      logger.error('User login failed', {
        phone: loginData.phone,
        error: error.message,
        ipAddress: loginData.ipAddress
      });
      
      throw error;
    }
  }

  /**
   * Refresh JWT tokens
   */
  async refreshTokens(refreshToken) {
    try {
      // Verify refresh token
      const payload = jwtUtil.verifyRefreshToken(refreshToken);
      
      // Get session
      const session = await sessionService.getSessionByRefreshToken(refreshToken);
      
      // Generate new tokens
      const newTokenPayload = {
        userId: payload.userId,
        sessionId: session.session_id,
        deviceId: payload.deviceId,
        roles: payload.roles || ['user'],
        permissions: payload.permissions || []
      };

      const tokens = jwtUtil.generateTokenPair(newTokenPayload);

      // Update session with new refresh token
      session.refresh_token = tokens.refresh_token;
      await session.save();

      logger.info('Tokens refreshed successfully', {
        userId: payload.userId,
        sessionId: session.session_id
      });

      return { tokens };
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error.message
      });
      
      throw AuthError.tokenRefreshFailed('Failed to refresh tokens');
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

      logger.info('User logged out successfully', {
        userId: payload.userId,
        sessionId: payload.sessionId
      });

      return { success: true };
    } catch (error) {
      logger.error('Logout failed', {
        error: error.message
      });
      
      throw AuthError.logoutFailed('Failed to logout user');
    }
  }

  /**
   * Reset password
   */
  async resetPassword(resetData) {
    try {
      const { phone, verification_id, otp_code, new_password } = resetData;

      // Verify OTP
      const otpVerification = await otpService.verifyOtp(verification_id, otp_code, phone);
      
      if (otpVerification.otp_type !== 'password_reset') {
        throw AuthError.invalidOTP('Invalid OTP type for password reset');
      }

      // Validate phone number format
      const phoneValidation = phoneUtil.validatePhoneNumber(phone);
      const formattedPhone = phoneValidation.formatted;

      // Find user
      const user = await User.findByPhone(formattedPhone);
      if (!user) {
        throw AuthError.phoneNotFound('Phone number not found');
      }

      // Check account status
      if (user.status === 'suspended') {
        throw AuthError.accountSuspended('Cannot reset password for suspended account');
      }
      if (user.status === 'pending_deletion') {
        throw AuthError.accountPendingDeletion('Cannot reset password for account scheduled for deletion');
      }

      // Validate new password
      passwordUtil.validatePassword(new_password);

      // Hash new password
      const newPasswordHash = await passwordUtil.hashPassword(new_password);

      // Update password
      await user.update({
        password_hash: newPasswordHash,
        password_changed_at: new Date(),
        failed_login_attempts: 0,
        last_failed_login: null
      });

      // Revoke all user sessions
      await sessionService.revokeAllUserSessions(user.id);

      logger.info('Password reset successfully', {
        userId: user.id,
        phone: formattedPhone
      });

      return { message: 'Password reset successful' };
    } catch (error) {
      logger.error('Password reset failed', {
        phone: resetData.phone,
        error: error.message
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
      last_failed_login: new Date()
    });

    logger.warn('Failed login attempt', {
      userId: user.id,
      phone: user.phone,
      attempts: failedAttempts
    });
  }

  /**
   * Reactivate account
   */
  async reactivateAccount(user) {
    await user.update({
      status: 'active',
      deactivated_at: null,
      pending_deletion_at: null
    });

    logger.info('Account reactivated', {
      userId: user.id,
      phone: user.phone
    });
  }

  /**
   * Sanitize user data for response
   */
  sanitizeUserForResponse(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    delete sanitized.verification_data;
    delete sanitized.failed_login_attempts;
    delete sanitized.last_failed_login;
    delete sanitized.registration_ip;
    delete sanitized.last_ip;
    return sanitized;
  }

  /**
   * Extract OS from User-Agent
   */
  extractOSFromUserAgent(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('iPhone')) return 'iOS';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    
    return 'Unknown';
  }

  /**
   * Extract browser from User-Agent
   */
  extractBrowserFromUserAgent(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Unknown';
  }
}

module.exports = new AuthService();
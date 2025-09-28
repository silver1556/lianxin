/**
 * Authentication Application Service
 * Orchestrates authentication use cases using domain contracts
 */
class AuthenticationApplicationService {
  constructor({
    userRepository,
    sessionRepository,
    encryptionService,
    cacheService,
    eventPublisher,
    otpService,
    passwordService,
    phoneService,
    jwtService
  }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.encryptionService = encryptionService;
    this.cacheService = cacheService;
    this.eventPublisher = eventPublisher;
    this.otpService = otpService;
    this.passwordService = passwordService;
    this.phoneService = phoneService;
    this.jwtService = jwtService;
  }

  /**
   * Request registration OTP
   */
  async requestRegistrationOtp(phone, countryCode) {
    // Validate phone number
    const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
    const phoneHash = this.encryptionService.hash(phoneValidation.e164);

    // Check if user already exists
    const existingUser = await this.userRepository.findByPhoneHash(phoneHash);
    if (existingUser) {
      throw new Error('Phone number already registered');
    }

    // Send OTP
    const otpResult = await this.otpService.sendOtp(
      phone, 
      countryCode, 
      'registration'
    );

    return otpResult;
  }

  /**
   * Register new user
   */
  async registerUser({
    phone,
    countryCode,
    password,
    verificationId,
    otpCode,
    deviceInfo,
    ipAddress,
    userAgent
  }) {
    const transaction = await this.userRepository.beginTransaction();

    try {
      // Validate phone number
      const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
      const phoneHash = this.encryptionService.hash(phoneValidation.e164);

      // Check if user already exists
      const existingUser = await this.userRepository.findByPhoneHash(phoneHash);
      if (existingUser) {
        throw new Error('Phone number already registered');
      }

      // Verify OTP
      await this.otpService.verifyOtp(verificationId, otpCode, phoneHash);

      // Validate and hash password
      this.passwordService.validatePassword(password);
      const passwordHash = await this.passwordService.hashPassword(password);

      // Create user entity
      const User = require('../../domain/user/entities/User');
      const user = User.create({
        phone: phoneValidation.e164,
        phoneHash,
        passwordHash,
        registrationIp: ipAddress
      });

      // Save user
      const savedUser = await this.userRepository.save(user);

      // Create session
      const sessionData = await this._createUserSession(
        savedUser.id,
        deviceInfo,
        ipAddress,
        userAgent
      );

      await this.userRepository.commitTransaction(transaction);

      // Publish domain events
      await this._publishDomainEvents(savedUser);

      return {
        user: savedUser,
        session: sessionData
      };

    } catch (error) {
      await this.userRepository.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * Request login OTP
   */
  async requestLoginOtp(phone, countryCode) {
    // Validate phone number
    const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
    const phoneHash = this.encryptionService.hash(phoneValidation.e164);

    // Check if user exists
    const user = await this.userRepository.findByPhoneHash(phoneHash);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.canLogin()) {
      throw new Error('User cannot login');
    }

    // Send OTP
    const otpResult = await this.otpService.sendOtp(
      phone, 
      countryCode, 
      'login',
      user.id
    );

    return otpResult;
  }

  /**
   * Login user
   */
  async loginUser({
    phone,
    countryCode,
    password,
    verificationId,
    otpCode,
    deviceInfo,
    ipAddress,
    userAgent
  }) {
    // Validate phone number
    const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
    const phoneHash = this.encryptionService.hash(phoneValidation.e164);

    // Find user
    const user = await this.userRepository.findByPhoneHash(phoneHash);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user can login
    if (!user.canLogin()) {
      throw new Error('User cannot login');
    }

    // Authenticate
    let authSuccess = false;
    if (password) {
      authSuccess = await this.passwordService.comparePassword(password, user.passwordHash);
    } else if (verificationId && otpCode) {
      await this.otpService.verifyOtp(verificationId, otpCode, phoneHash);
      authSuccess = true;
    }

    if (!authSuccess) {
      const lockEvent = user.recordFailedLogin(ipAddress);
      await this.userRepository.save(user);
      
      if (lockEvent) {
        await this.eventPublisher.publish(lockEvent);
      }
      
      throw new Error('Invalid credentials');
    }

    // Successful login
    const loginEvent = user.recordSuccessfulLogin(ipAddress);
    
    // Reactivate account if needed
    if (['pending_deletion', 'deactivated'].includes(user.status)) {
      const reactivateEvent = user.reactivate();
      if (reactivateEvent) {
        await this.eventPublisher.publish(reactivateEvent);
      }
    }

    await this.userRepository.save(user);

    // Revoke existing sessions for same device
    await this._revokeDeviceSessions(user.id, deviceInfo.device_id);

    // Create new session
    const sessionData = await this._createUserSession(
      user.id,
      deviceInfo,
      ipAddress,
      userAgent
    );

    // Publish events
    await this.eventPublisher.publish(loginEvent);

    return {
      user,
      session: sessionData,
      loginMethod: password ? 'password' : 'otp'
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    // Verify refresh token
    const payload = this.jwtService.verifyRefreshToken(refreshToken);

    // Get session
    const session = await this.sessionRepository.findBySessionId(payload.sessionId);
    if (!session || !session.isValid()) {
      throw new Error('Invalid session');
    }

    // Generate new tokens
    const newTokens = this.jwtService.generateTokenPair({
      userId: payload.userId,
      sessionId: session.sessionId,
      deviceId: payload.deviceId,
      roles: payload.roles || ['user']
    });

    // Update session with new refresh token
    const refreshTokenHash = this.encryptionService.hash(newTokens.refresh_token);
    const updateEvent = session.updateRefreshToken(refreshTokenHash, newTokens.refresh_expires_at);
    
    await this.sessionRepository.save(session);
    await this.eventPublisher.publish(updateEvent);

    return {
      tokens: {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newTokens.expires_at
      }
    };
  }

  /**
   * Logout user
   */
  async logout(accessToken) {
    const payload = this.jwtService.verifyAccessToken(accessToken);
    
    const session = await this.sessionRepository.findBySessionId(payload.sessionId);
    if (session && session.canBeRevoked()) {
      const revokeEvent = session.revoke('user_logout');
      await this.sessionRepository.save(session);
      await this.eventPublisher.publish(revokeEvent);
    }

    return true;
  }

  /**
   * Request password reset OTP
   */
  async requestPasswordResetOtp(phone, countryCode) {
    // Validate phone number
    const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
    const phoneHash = this.encryptionService.hash(phoneValidation.e164);

    // Check if user exists
    const user = await this.userRepository.findByPhoneHash(phoneHash);
    if (!user) {
      throw new Error('User not found');
    }

    // Send OTP
    const otpResult = await this.otpService.sendOtp(
      phone, 
      countryCode, 
      'password_reset',
      user.id
    );

    return otpResult;
  }

  /**
   * Verify reset OTP and generate reset token
   */
  async verifyResetOtp(phone, countryCode, verificationId, otpCode) {
    // Validate phone number
    const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
    const phoneHash = this.encryptionService.hash(phoneValidation.e164);

    // Verify OTP
    await this.otpService.verifyOtp(verificationId, otpCode, phoneHash);

    // Generate reset token
    const resetToken = this.jwtService.generatePasswordResetToken({
      phone: phoneValidation.e164,
      verificationId
    });

    return resetToken;
  }

  /**
   * Reset password
   */
  async resetPassword(phone, countryCode, resetToken, newPassword) {
    const transaction = await this.userRepository.beginTransaction();

    try {
      // Verify reset token
      const tokenPayload = this.jwtService.verifyPasswordResetToken(resetToken);
      
      // Validate phone number
      const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
      const phoneHash = this.encryptionService.hash(phoneValidation.e164);

      // Find user
      const user = await this.userRepository.findByPhoneHash(phoneHash);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate new password
      this.passwordService.validatePassword(newPassword);
      
      // Check password history
      const isInHistory = await this.passwordService.isPasswordInHistory(
        newPassword, 
        user.passwordHistory
      );
      if (isInHistory) {
        throw new Error('Password cannot be reused');
      }

      const newPasswordHash = await this.passwordService.hashPassword(newPassword);

      // Update password
      const passwordEvent = user.changePassword(newPasswordHash);
      await this.userRepository.save(user);

      // Revoke all sessions
      await this.sessionRepository.revokeAllForUser(user.id);

      await this.userRepository.commitTransaction(transaction);

      // Publish event
      await this.eventPublisher.publish(passwordEvent);

      return true;

    } catch (error) {
      await this.userRepository.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * Verify JWT token (for middleware)
   */
  async verifyToken(token) {
    const payload = this.jwtService.verifyAccessToken(token);
    
    const session = await this.sessionRepository.findBySessionId(payload.sessionId);
    if (!session || !session.isValid()) {
      throw new Error('Invalid session');
    }

    return {
      userId: payload.userId,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      roles: payload.roles || ['user']
    };
  }

  // Private helper methods
  async _createUserSession(userId, deviceInfo, ipAddress, userAgent) {
    const UserSession = require('../../domain/user/entities/UserSession');
    
    // Generate tokens
    const tokenPayload = {
      userId,
      deviceId: deviceInfo.device_id,
      roles: ['user']
    };

    const tokens = this.jwtService.generateTokenPair(tokenPayload);
    const refreshTokenHash = this.encryptionService.hash(tokens.refresh_token);

    // Create session entity
    const session = UserSession.create({
      userId,
      refreshToken: refreshTokenHash,
      deviceInfo,
      ipAddress,
      userAgent,
      expiresAt: tokens.refresh_expires_at
    });

    // Save session
    const savedSession = await this.sessionRepository.save(session);

    // Publish domain events
    await this._publishDomainEvents(savedSession);

    return {
      ...tokens,
      session_id: savedSession.sessionId
    };
  }

  async _revokeDeviceSessions(userId, deviceId) {
    const existingSessions = await this.sessionRepository.findByDeviceId(userId, deviceId);
    
    for (const session of existingSessions) {
      if (session.canBeRevoked()) {
        const revokeEvent = session.revoke('new_device_login');
        await this.sessionRepository.save(session);
        await this.eventPublisher.publish(revokeEvent);
      }
    }
  }

  async _publishDomainEvents(entity) {
    const events = entity.getDomainEvents();
    
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
    
    entity.clearDomainEvents();
  }
}

module.exports = AuthenticationApplicationService;
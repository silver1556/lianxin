/**
 * Authentication Application Service
 * Handles authentication-related use cases
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

    // Generate new access token
    const newTokens = this.jwtService.generateTokenPair({
      userId: payload.userId,
      sessionId: session.sessionId,
      deviceId: payload.deviceId
    });

    // Update session with new refresh token
    session.refreshToken = this.encryptionService.hash(newTokens.refresh_token);
    await this.sessionRepository.update(session);

    return {
      access_token: newTokens.access_token,
      expires_in: newTokens.expires_in
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
      await this.sessionRepository.update(session);
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
   * Reset password
   */
  async resetPassword(phone, countryCode, verificationId, otpCode, newPassword) {
    const transaction = await this.userRepository.beginTransaction();

    try {
      // Validate phone number
      const phoneValidation = this.phoneService.validatePhoneNumber(phone, countryCode);
      const phoneHash = this.encryptionService.hash(phoneValidation.e164);

      // Verify OTP
      await this.otpService.verifyOtp(verificationId, otpCode, phoneHash);

      // Find user
      const user = await this.userRepository.findByPhoneHash(phoneHash);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate new password
      this.passwordService.validatePassword(newPassword);
      const newPasswordHash = await this.passwordService.hashPassword(newPassword);

      // Update password
      const passwordEvent = user.changePassword(newPasswordHash);
      await this.userRepository.update(user);

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
}

module.exports = AuthenticationApplicationService;
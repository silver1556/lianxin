const User = require('../../../domain/user/entities/User');
const UserProfile = require('../../../domain/user/entities/UserProfile');

/**
 * User Application Service
 * Orchestrates user-related use cases
 */
class UserApplicationService {
  constructor({
    userRepository,
    sessionRepository,
    encryptionService,
    cacheService,
    eventPublisher,
    otpService,
    passwordService,
    phoneService
  }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.encryptionService = encryptionService;
    this.cacheService = cacheService;
    this.eventPublisher = eventPublisher;
    this.otpService = otpService;
    this.passwordService = passwordService;
    this.phoneService = phoneService;
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

      // Validate password
      this.passwordService.validatePassword(password);
      const passwordHash = await this.passwordService.hashPassword(password);

      // Create user entity
      const userData = {
        phone: phoneValidation.e164,
        passwordHash,
        status: 'active'
      };

      const user = User.create(userData);
      const savedUser = await this.userRepository.create(user);

      // Create default profile
      const profile = UserProfile.createDefault(savedUser.id);
      
      // Create session
      const sessionData = await this._createUserSession(
        savedUser.id,
        deviceInfo,
        ipAddress,
        userAgent
      );

      await this.userRepository.commitTransaction(transaction);

      // Publish events
      await this.eventPublisher.publish({
        type: 'UserRegistered',
        userId: savedUser.id,
        phone: phoneValidation.e164,
        registeredAt: new Date()
      });

      return {
        user: savedUser,
        profile,
        session: sessionData
      };

    } catch (error) {
      await this.userRepository.rollbackTransaction(transaction);
      throw error;
    }
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
      const lockEvent = user.recordFailedLogin();
      await this.userRepository.update(user);
      
      if (lockEvent) {
        await this.eventPublisher.publish(lockEvent);
      }
      
      throw new Error('Invalid credentials');
    }

    // Successful login
    const loginEvent = user.recordSuccessfulLogin();
    await this.userRepository.update(user);

    // Revoke existing sessions for same device
    await this._revokeDeviceSessions(user.id, deviceInfo.device_id);

    // Create new session
    const sessionData = await this._createUserSession(
      user.id,
      deviceInfo,
      ipAddress,
      userAgent
    );

    // Cache user profile
    await this._cacheUserProfile(user.id);

    // Publish events
    await this.eventPublisher.publish(loginEvent);

    return {
      user,
      session: sessionData
    };
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId, requestingUserId = null) {
    // Try cache first
    let profile = await this.cacheService.getUserProfile(userId, 'full');
    
    if (!profile) {
      // Load from repository
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      profile = user.profile;
      
      // Cache for future requests
      await this.cacheService.cacheUserProfile(userId, profile, 'full');
    }

    // Determine viewer type
    const viewerType = this._determineViewerType(userId, requestingUserId);
    
    return profile.toPublicView(viewerType);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, profileData) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const updateEvent = user.updateProfile(profileData);
    await this.userRepository.update(user);

    // Invalidate cache
    await this.cacheService.invalidateUserCache(userId);

    // Publish event
    await this.eventPublisher.publish(updateEvent);

    return user.profile;
  }

  /**
   * Change user password
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidCurrent = await this.passwordService.comparePassword(
      currentPassword, 
      user.passwordHash
    );
    
    if (!isValidCurrent) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    this.passwordService.validatePassword(newPassword);
    const newPasswordHash = await this.passwordService.hashPassword(newPassword);

    // Update password
    const passwordEvent = user.changePassword(newPasswordHash);
    await this.userRepository.update(user);

    // Revoke all other sessions
    await this.sessionRepository.revokeAllForUser(userId);

    // Publish event
    await this.eventPublisher.publish(passwordEvent);

    return true;
  }

  /**
   * Suspend user (Admin)
   */
  async suspendUser(userId, reason, durationDays, suspendedBy) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const suspensionEvent = user.suspend(reason, durationDays, suspendedBy);
    await this.userRepository.update(user);

    // Revoke all user sessions
    await this.sessionRepository.revokeAllForUser(userId);

    // Invalidate cache
    await this.cacheService.invalidateUserCache(userId);

    // Publish event
    await this.eventPublisher.publish(suspensionEvent);

    return suspensionEvent;
  }

  /**
   * Verify user (Admin)
   */
  async verifyUser(userId, verificationType, verificationData, verifiedBy) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const verificationEvent = user.verify(verificationType, verificationData, verifiedBy);
    await this.userRepository.update(user);

    // Invalidate cache
    await this.cacheService.invalidateUserCache(userId);

    // Publish event
    await this.eventPublisher.publish(verificationEvent);

    return verificationEvent;
  }

  // Private helper methods
  async _createUserSession(userId, deviceInfo, ipAddress, userAgent) {
    const sessionId = this.encryptionService.generateSecureToken();
    const refreshToken = this.encryptionService.generateSecureToken();
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const session = UserSession.create({
      userId,
      sessionId,
      refreshToken,
      deviceInfo,
      ipAddress,
      userAgent,
      expiresAt
    });

    return await this.sessionRepository.create(session);
  }

  async _revokeDeviceSessions(userId, deviceId) {
    const existingSessions = await this.sessionRepository.findByDeviceId(userId, deviceId);
    
    for (const session of existingSessions) {
      if (session.canBeRevoked()) {
        const revokeEvent = session.revoke('new_device_login');
        await this.sessionRepository.update(session);
        await this.eventPublisher.publish(revokeEvent);
      }
    }
  }

  async _cacheUserProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (user && user.profile) {
      await this.cacheService.cacheUserProfile(userId, user.profile, 'hot');
    }
  }

  _determineViewerType(targetUserId, requestingUserId) {
    if (!requestingUserId) return 'public';
    if (targetUserId === requestingUserId) return 'owner';
    // TODO: Check friendship status
    return 'public';
  }
}

module.exports = UserApplicationService;
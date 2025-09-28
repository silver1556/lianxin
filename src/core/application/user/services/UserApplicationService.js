/**
 * User Application Service
 * Orchestrates user management use cases using domain contracts
 */
class UserApplicationService {
  constructor({
    userRepository,
    sessionRepository,
    encryptionService,
    cacheService,
    eventPublisher,
    passwordService,
    phoneService
  }) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.encryptionService = encryptionService;
    this.cacheService = cacheService;
    this.eventPublisher = eventPublisher;
    this.passwordService = passwordService;
    this.phoneService = phoneService;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId, requestingUserId = null) {
    // Try cache first
    let user = await this.cacheService.get(`user:profile:${userId}`);
    
    if (!user) {
      // Load from repository
      user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Cache for future requests
      await this.cacheService.set(`user:profile:${userId}`, user, 3600);
    }

    // Determine viewer type
    const viewerType = this._determineViewerType(userId, requestingUserId);
    
    return user.profile ? user.profile.toPublicView(viewerType) : null;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, profileData) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update profile through domain entity
    if (user.profile) {
      const updateEvent = user.profile.updateBasicInfo(profileData);
      await this.userRepository.save(user);

      // Invalidate cache
      await this.cacheService.delete(`user:profile:${userId}`);

      // Publish event
      await this.eventPublisher.publish(updateEvent);

      return user.profile;
    }

    throw new Error('User profile not found');
  }

  /**
   * Change user password
   */
  async changePassword(userId, currentPassword, newPassword, sessionId = null) {
    const transaction = await this.userRepository.beginTransaction();

    try {
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

      // Revoke all other sessions except current one
      await this.sessionRepository.revokeAllForUser(userId, sessionId);

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
   * Deactivate user account
   */
  async deactivateAccount(userId, password, reason = null) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await this.passwordService.comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Deactivate account
    const deactivateEvent = user.deactivate(reason);
    await this.userRepository.save(user);

    // Revoke all sessions
    await this.sessionRepository.revokeAllForUser(userId);

    // Invalidate cache
    await this.cacheService.delete(`user:profile:${userId}`);

    // Publish event
    await this.eventPublisher.publish(deactivateEvent);

    return true;
  }

  /**
   * Schedule account for deletion
   */
  async scheduleAccountDeletion(userId, password) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await this.passwordService.comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Schedule for deletion
    const deletionEvent = user.scheduleForDeletion();
    await this.userRepository.save(user);

    // Revoke all sessions
    await this.sessionRepository.revokeAllForUser(userId);

    // Invalidate cache
    await this.cacheService.delete(`user:profile:${userId}`);

    // Publish event
    await this.eventPublisher.publish(deletionEvent);

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
    await this.userRepository.save(user);

    // Revoke all user sessions
    await this.sessionRepository.revokeAllForUser(userId);

    // Invalidate cache
    await this.cacheService.delete(`user:profile:${userId}`);

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
    await this.userRepository.save(user);

    // Invalidate cache
    await this.cacheService.delete(`user:profile:${userId}`);

    // Publish event
    await this.eventPublisher.publish(verificationEvent);

    return verificationEvent;
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    const stats = {
      total: await this.userRepository.countByStatus('active'),
      active: await this.userRepository.countByStatus('active'),
      suspended: await this.userRepository.countByStatus('suspended'),
      deactivated: await this.userRepository.countByStatus('deactivated'),
      pending_deletion: await this.userRepository.countByStatus('pending_deletion')
    };

    return stats;
  }

  /**
   * Search users
   */
  async searchUsers(query, options = {}) {
    return await this.userRepository.search(query, options);
  }

  // Private helper methods
  _determineViewerType(targetUserId, requestingUserId) {
    if (!requestingUserId) return 'public';
    if (targetUserId === requestingUserId) return 'owner';
    // TODO: Check friendship status when friend module is implemented
    return 'public';
  }
}

module.exports = UserApplicationService;
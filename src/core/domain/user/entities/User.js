/**
 * User Domain Entity
 * Core business logic for User aggregate
 */
class User {
  constructor({
    id,
    uuid,
    phone,
    passwordHash,
    isVerified = false,
    status = 'active',
    profile = null,
    settings = null,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.uuid = uuid;
    this.phone = phone;
    this.passwordHash = passwordHash;
    this.isVerified = isVerified;
    this.status = status;
    this.profile = profile;
    this.settings = settings;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.passwordHistory = [];
    this.failedLoginAttempts = 0;
    this.lastLogin = null;
    this.suspensionUntil = null;
    this.suspensionReason = null;
  }

  // Business Rules
  canLogin() {
    return this.status === 'active' && !this.isSuspended();
  }

  isSuspended() {
    return this.status === 'suspended' && 
           this.suspensionUntil && 
           new Date() < this.suspensionUntil;
  }

  canBeDeleted() {
    return ['active', 'deactivated'].includes(this.status);
  }

  isEligibleForVerification() {
    return !this.isVerified && this.status === 'active';
  }

  // Domain Operations
  suspend(reason, durationDays, suspendedBy) {
    if (this.status === 'suspended') {
      throw new Error('User is already suspended');
    }

    const suspensionUntil = new Date();
    suspensionUntil.setDate(suspensionUntil.getDate() + durationDays);

    this.status = 'suspended';
    this.suspensionReason = reason;
    this.suspensionUntil = suspensionUntil;
    this.updatedAt = new Date();

    return {
      type: 'UserSuspended',
      userId: this.id,
      reason,
      suspensionUntil,
      suspendedBy
    };
  }

  unsuspend(unsuspendedBy) {
    if (this.status !== 'suspended') {
      throw new Error('User is not suspended');
    }

    this.status = 'active';
    this.suspensionReason = null;
    this.suspensionUntil = null;
    this.updatedAt = new Date();

    return {
      type: 'UserUnsuspended',
      userId: this.id,
      unsuspendedBy
    };
  }

  verify(verificationType, verificationData, verifiedBy) {
    if (this.isVerified) {
      throw new Error('User is already verified');
    }

    this.isVerified = true;
    this.updatedAt = new Date();

    return {
      type: 'UserVerified',
      userId: this.id,
      verificationType,
      verificationData,
      verifiedBy
    };
  }

  deactivate(reason) {
    if (this.status === 'deactivated') {
      throw new Error('User is already deactivated');
    }

    this.status = 'deactivated';
    this.updatedAt = new Date();

    return {
      type: 'UserDeactivated',
      userId: this.id,
      reason,
      deactivatedAt: new Date()
    };
  }

  scheduleForDeletion() {
    if (this.status === 'pending_deletion') {
      throw new Error('User is already scheduled for deletion');
    }

    this.status = 'pending_deletion';
    this.updatedAt = new Date();

    return {
      type: 'UserScheduledForDeletion',
      userId: this.id,
      scheduledAt: new Date()
    };
  }

  recordFailedLogin() {
    this.failedLoginAttempts += 1;
    this.updatedAt = new Date();

    if (this.failedLoginAttempts >= 5) {
      return {
        type: 'UserAccountLocked',
        userId: this.id,
        failedAttempts: this.failedLoginAttempts
      };
    }

    return null;
  }

  recordSuccessfulLogin() {
    this.failedLoginAttempts = 0;
    this.lastLogin = new Date();
    this.updatedAt = new Date();

    return {
      type: 'UserLoggedIn',
      userId: this.id,
      loginAt: this.lastLogin
    };
  }

  updateProfile(profileData) {
    this.profile = { ...this.profile, ...profileData };
    this.updatedAt = new Date();

    return {
      type: 'UserProfileUpdated',
      userId: this.id,
      updatedFields: Object.keys(profileData)
    };
  }

  changePassword(newPasswordHash) {
    // Add current password to history
    if (this.passwordHash) {
      this.passwordHistory.push({
        hash: this.passwordHash,
        changedAt: new Date()
      });
    }

    // Keep only last 5 passwords
    this.passwordHistory = this.passwordHistory.slice(-5);

    this.passwordHash = newPasswordHash;
    this.updatedAt = new Date();

    return {
      type: 'UserPasswordChanged',
      userId: this.id,
      changedAt: new Date()
    };
  }

  // Value Objects
  static createPhone(phoneNumber, countryCode) {
    return {
      number: phoneNumber,
      countryCode,
      e164: `${countryCode}${phoneNumber}`,
      isValid: true
    };
  }

  // Factory Methods
  static create(userData) {
    return new User(userData);
  }

  static fromPersistence(data) {
    return new User({
      id: data.id,
      uuid: data.uuid,
      phone: data.phone,
      passwordHash: data.password_hash,
      isVerified: data.is_verified,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });
  }

  toPersistence() {
    return {
      id: this.id,
      uuid: this.uuid,
      phone: this.phone,
      password_hash: this.passwordHash,
      is_verified: this.isVerified,
      status: this.status,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      failed_login_attempts: this.failedLoginAttempts,
      last_login: this.lastLogin,
      suspension_until: this.suspensionUntil,
      suspension_reason: this.suspensionReason
    };
  }
}

module.exports = User;
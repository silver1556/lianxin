const DomainEvent = require('../../shared/events/DomainEvent');
const { v4: uuidv4 } = require('uuid');

/**
 * User Domain Entity
 * Core business logic for User aggregate
 */
class User {
  constructor({
    id = null,
    uuid = null,
    phone,
    phoneHash,
    passwordHash,
    isVerified = false,
    status = 'active',
    suspensionReason = null,
    suspensionUntil = null,
    lastLogin = null,
    registrationIp = null,
    lastIp = null,
    failedLoginAttempts = 0,
    lastFailedLogin = null,
    deactivatedAt = null,
    pendingDeletionAt = null,
    passwordChangedAt = null,
    passwordHistory = [],
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.uuid = uuid || uuidv4();
    this.phone = phone;
    this.phoneHash = phoneHash;
    this.passwordHash = passwordHash;
    this.isVerified = isVerified;
    this.status = status;
    this.suspensionReason = suspensionReason;
    this.suspensionUntil = suspensionUntil;
    this.lastLogin = lastLogin;
    this.registrationIp = registrationIp;
    this.lastIp = lastIp;
    this.failedLoginAttempts = failedLoginAttempts;
    this.lastFailedLogin = lastFailedLogin;
    this.deactivatedAt = deactivatedAt;
    this.pendingDeletionAt = pendingDeletionAt;
    this.passwordChangedAt = passwordChangedAt;
    this.passwordHistory = passwordHistory;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;

    // Domain events
    this.domainEvents = [];
  }

  // Business Rules
  canLogin() {
    return this.status === 'active' && !this.isSuspended() && !this.isLocked();
  }

  isSuspended() {
    return this.status === 'suspended' && 
           this.suspensionUntil && 
           new Date() < this.suspensionUntil;
  }

  isLocked() {
    return this.failedLoginAttempts >= 5;
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

    const event = new DomainEvent('UserSuspended', this.id, {
      reason,
      suspensionUntil,
      suspendedBy
    });

    this.addDomainEvent(event);
    return event;
  }

  unsuspend(unsuspendedBy) {
    if (this.status !== 'suspended') {
      throw new Error('User is not suspended');
    }

    this.status = 'active';
    this.suspensionReason = null;
    this.suspensionUntil = null;
    this.updatedAt = new Date();

    const event = new DomainEvent('UserUnsuspended', this.id, {
      unsuspendedBy
    });

    this.addDomainEvent(event);
    return event;
  }

  verify(verificationType, verificationData, verifiedBy) {
    if (this.isVerified) {
      throw new Error('User is already verified');
    }

    this.isVerified = true;
    this.updatedAt = new Date();

    const event = new DomainEvent('UserVerified', this.id, {
      verificationType,
      verificationData,
      verifiedBy
    });

    this.addDomainEvent(event);
    return event;
  }

  deactivate(reason = null) {
    if (this.status === 'deactivated') {
      throw new Error('User is already deactivated');
    }

    this.status = 'deactivated';
    this.deactivatedAt = new Date();
    this.updatedAt = new Date();

    const event = new DomainEvent('UserDeactivated', this.id, {
      reason,
      deactivatedAt: this.deactivatedAt
    });

    this.addDomainEvent(event);
    return event;
  }

  scheduleForDeletion() {
    if (this.status === 'pending_deletion') {
      throw new Error('User is already scheduled for deletion');
    }

    this.status = 'pending_deletion';
    this.pendingDeletionAt = new Date();
    this.updatedAt = new Date();

    const event = new DomainEvent('UserScheduledForDeletion', this.id, {
      scheduledAt: this.pendingDeletionAt
    });

    this.addDomainEvent(event);
    return event;
  }

  recordFailedLogin(ipAddress) {
    this.failedLoginAttempts += 1;
    this.lastFailedLogin = new Date();
    this.lastIp = ipAddress;
    this.updatedAt = new Date();

    if (this.failedLoginAttempts >= 5) {
      const event = new DomainEvent('UserAccountLocked', this.id, {
        failedAttempts: this.failedLoginAttempts,
        ipAddress
      });

      this.addDomainEvent(event);
      return event;
    }

    return null;
  }

  recordSuccessfulLogin(ipAddress) {
    this.failedLoginAttempts = 0;
    this.lastFailedLogin = null;
    this.lastLogin = new Date();
    this.lastIp = ipAddress;
    this.updatedAt = new Date();

    const event = new DomainEvent('UserLoggedIn', this.id, {
      loginAt: this.lastLogin,
      ipAddress
    });

    this.addDomainEvent(event);
    return event;
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
    this.passwordChangedAt = new Date();
    this.updatedAt = new Date();

    const event = new DomainEvent('UserPasswordChanged', this.id, {
      changedAt: this.passwordChangedAt
    });

    this.addDomainEvent(event);
    return event;
  }

  reactivate() {
    if (this.status === 'active') {
      return null;
    }

    const oldStatus = this.status;
    this.status = 'active';
    this.deactivatedAt = null;
    this.pendingDeletionAt = null;
    this.updatedAt = new Date();

    const event = new DomainEvent('UserReactivated', this.id, {
      previousStatus: oldStatus,
      reactivatedAt: new Date()
    });

    this.addDomainEvent(event);
    return event;
  }

  // Domain Events Management
  addDomainEvent(event) {
    this.domainEvents.push(event);
  }

  getDomainEvents() {
    return [...this.domainEvents];
  }

  clearDomainEvents() {
    this.domainEvents = [];
  }

  // Factory Methods
  static create({
    phone,
    phoneHash,
    passwordHash,
    registrationIp = null
  }) {
    return new User({
      phone,
      phoneHash,
      passwordHash,
      registrationIp,
      lastIp: registrationIp,
      status: 'active'
    });
  }

  static fromPersistence(data) {
    return new User({
      id: data.id,
      uuid: data.uuid,
      phone: data.phone,
      phoneHash: data.phone_hash,
      passwordHash: data.password_hash,
      isVerified: data.is_verified,
      status: data.status,
      suspensionReason: data.suspension_reason,
      suspensionUntil: data.suspension_until,
      lastLogin: data.last_login,
      registrationIp: data.registration_ip,
      lastIp: data.last_ip,
      failedLoginAttempts: data.failed_login_attempts,
      lastFailedLogin: data.last_failed_login,
      deactivatedAt: data.deactivated_at,
      pendingDeletionAt: data.pending_deletion_at,
      passwordChangedAt: data.password_changed_at,
      passwordHistory: data.password_history || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    });
  }

  toPersistence() {
    return {
      id: this.id,
      uuid: this.uuid,
      phone: this.phone,
      phone_hash: this.phoneHash,
      password_hash: this.passwordHash,
      is_verified: this.isVerified,
      status: this.status,
      suspension_reason: this.suspensionReason,
      suspension_until: this.suspensionUntil,
      last_login: this.lastLogin,
      registration_ip: this.registrationIp,
      last_ip: this.lastIp,
      failed_login_attempts: this.failedLoginAttempts,
      last_failed_login: this.lastFailedLogin,
      deactivated_at: this.deactivatedAt,
      pending_deletion_at: this.pendingDeletionAt,
      password_changed_at: this.passwordChangedAt,
      password_history: this.passwordHistory,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  // View Models
  toSafeView() {
    return {
      id: this.id,
      uuid: this.uuid,
      isVerified: this.isVerified,
      status: this.status,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt
    };
  }

  toAdminView() {
    return {
      ...this.toSafeView(),
      phone: this.phone,
      failedLoginAttempts: this.failedLoginAttempts,
      lastFailedLogin: this.lastFailedLogin,
      suspensionReason: this.suspensionReason,
      suspensionUntil: this.suspensionUntil,
      deactivatedAt: this.deactivatedAt,
      pendingDeletionAt: this.pendingDeletionAt
    };
  }
}

module.exports = User;
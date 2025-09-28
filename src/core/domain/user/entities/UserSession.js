const DomainEvent = require('../../shared/events/DomainEvent');
const { v4: uuidv4 } = require('uuid');

/**
 * UserSession Domain Entity
 * Represents user authentication session
 */
class UserSession {
  constructor({
    id = null,
    userId,
    sessionId = null,
    refreshToken,
    deviceInfo,
    ipAddress,
    userAgent,
    location = null,
    isActive = true,
    lastActiveAt = new Date(),
    refreshIssuedAt = new Date(),
    expiresAt,
    revokedAt = null,
    createdAt = new Date()
  }) {
    this.id = id;
    this.userId = userId;
    this.sessionId = sessionId || uuidv4();
    this.refreshToken = refreshToken;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.location = location;
    this.isActive = isActive;
    this.lastActiveAt = lastActiveAt;
    this.refreshIssuedAt = refreshIssuedAt;
    this.expiresAt = expiresAt;
    this.revokedAt = revokedAt;
    this.createdAt = createdAt;

    // Domain events
    this.domainEvents = [];
  }

  // Business Rules
  isValid() {
    return this.isActive && !this.isExpired() && !this.isRevoked();
  }

  isExpired() {
    return new Date() > this.expiresAt;
  }

  isRevoked() {
    return this.revokedAt !== null;
  }

  canBeRevoked() {
    return this.isActive && !this.isRevoked();
  }

  isSameDevice(deviceId) {
    return this.deviceInfo?.device_id === deviceId;
  }

  // Domain Operations
  revoke(reason = 'user_request') {
    if (!this.canBeRevoked()) {
      throw new Error('Session cannot be revoked');
    }

    this.isActive = false;
    this.revokedAt = new Date();

    const event = new DomainEvent('SessionRevoked', this.sessionId, {
      userId: this.userId,
      reason,
      revokedAt: this.revokedAt,
      deviceId: this.deviceInfo?.device_id
    });

    this.addDomainEvent(event);
    return event;
  }

  updateActivity(ipAddress, userAgent) {
    this.lastActiveAt = new Date();
    
    if (ipAddress) this.ipAddress = ipAddress;
    if (userAgent) this.userAgent = userAgent;

    const event = new DomainEvent('SessionActivityUpdated', this.sessionId, {
      userId: this.userId,
      lastActiveAt: this.lastActiveAt,
      ipAddress,
      userAgent
    });

    this.addDomainEvent(event);
    return event;
  }

  extend(newExpiresAt) {
    if (this.isExpired()) {
      throw new Error('Cannot extend expired session');
    }

    this.expiresAt = newExpiresAt;

    const event = new DomainEvent('SessionExtended', this.sessionId, {
      userId: this.userId,
      newExpiresAt
    });

    this.addDomainEvent(event);
    return event;
  }

  updateRefreshToken(newRefreshToken, newExpiresAt) {
    this.refreshToken = newRefreshToken;
    this.refreshIssuedAt = new Date();
    this.expiresAt = newExpiresAt;

    const event = new DomainEvent('SessionRefreshTokenUpdated', this.sessionId, {
      userId: this.userId,
      refreshIssuedAt: this.refreshIssuedAt
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
    userId,
    refreshToken,
    deviceInfo,
    ipAddress,
    userAgent,
    expiresAt,
    location = null
  }) {
    return new UserSession({
      userId,
      refreshToken,
      deviceInfo,
      ipAddress,
      userAgent,
      location,
      expiresAt
    });
  }

  static fromPersistence(data) {
    return new UserSession({
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      refreshToken: data.refresh_token,
      deviceInfo: data.device_info,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      location: data.location,
      isActive: data.is_active,
      lastActiveAt: data.last_active_at,
      refreshIssuedAt: data.refresh_issued_at,
      expiresAt: data.expires_at,
      revokedAt: data.revoked_at,
      createdAt: data.created_at
    });
  }

  toPersistence() {
    return {
      id: this.id,
      user_id: this.userId,
      session_id: this.sessionId,
      refresh_token: this.refreshToken,
      device_info: this.deviceInfo,
      ip_address: this.ipAddress,
      user_agent: this.userAgent,
      location: this.location,
      is_active: this.isActive,
      last_active_at: this.lastActiveAt,
      refresh_issued_at: this.refreshIssuedAt,
      expires_at: this.expiresAt,
      revoked_at: this.revokedAt,
      created_at: this.createdAt
    };
  }

  // View Models
  toSafeView() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo,
      ipAddress: this.ipAddress,
      location: this.location,
      isActive: this.isActive,
      lastActiveAt: this.lastActiveAt,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt
    };
  }
}

module.exports = UserSession;
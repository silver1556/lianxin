/**
 * UserSession Domain Entity
 * Represents user authentication session
 */
class UserSession {
  constructor({
    id,
    userId,
    sessionId,
    refreshToken,
    deviceInfo,
    ipAddress,
    userAgent,
    location,
    isActive = true,
    lastActiveAt = new Date(),
    expiresAt,
    createdAt = new Date()
  }) {
    this.id = id;
    this.userId = userId;
    this.sessionId = sessionId;
    this.refreshToken = refreshToken;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.location = location;
    this.isActive = isActive;
    this.lastActiveAt = lastActiveAt;
    this.expiresAt = expiresAt;
    this.revokedAt = null;
    this.createdAt = createdAt;
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

    return {
      type: 'SessionRevoked',
      sessionId: this.sessionId,
      userId: this.userId,
      reason,
      revokedAt: this.revokedAt
    };
  }

  updateActivity(ipAddress, userAgent) {
    this.lastActiveAt = new Date();
    
    if (ipAddress) this.ipAddress = ipAddress;
    if (userAgent) this.userAgent = userAgent;

    return {
      type: 'SessionActivityUpdated',
      sessionId: this.sessionId,
      userId: this.userId,
      lastActiveAt: this.lastActiveAt
    };
  }

  extend(newExpiresAt) {
    if (this.isExpired()) {
      throw new Error('Cannot extend expired session');
    }

    this.expiresAt = newExpiresAt;

    return {
      type: 'SessionExtended',
      sessionId: this.sessionId,
      userId: this.userId,
      newExpiresAt
    };
  }

  // Factory Methods
  static create({
    userId,
    sessionId,
    refreshToken,
    deviceInfo,
    ipAddress,
    userAgent,
    expiresAt,
    location = null
  }) {
    return new UserSession({
      userId,
      sessionId,
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
      expiresAt: data.expires_at,
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
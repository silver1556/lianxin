const { AppError } = require('./AppError');

/**
 * Authentication Error Class
 * Handles authentication and authorization failure errors
 */
class AuthError extends AppError {
  constructor(message, statusCode = 401, errorCode = 'AUTHENTICATION_ERROR', details = null) {
    super(message, statusCode, errorCode, details);
    
    this.name = 'AuthError';
    this.attemptDetails = {};
  }
  
  /**
   * Add attempt details for security tracking
   */
  addAttemptDetails(details) {
    this.attemptDetails = {
      ...this.attemptDetails,
      ...details,
      timestamp: new Date().toISOString()
    };
    
    return this;
  }
  
  /**
   * Convert to JSON format
   */
  toJSON() {
    return {
      ...super.toJSON(),
      attemptDetails: this.attemptDetails
    };
  }
  
  /**
   * Static method to create invalid credentials error
   */
  static invalidCredentials(message = 'Invalid credentials provided', details = null) {
    return new AuthError(message, 401, 'INVALID_CREDENTIALS', details);
  }
  
  /**
   * Static method to create account locked error
   */
  static accountLocked(message = 'Account is temporarily locked', lockoutUntil = null) {
    return new AuthError(message, 401, 'ACCOUNT_LOCKED', { lockoutUntil });
  }
  
  /**
   * Static method to create account suspended error
   */
  static accountSuspended(message = 'Account is suspended', suspensionDetails = null) {
    return new AuthError(message, 403, 'ACCOUNT_SUSPENDED', suspensionDetails);
  }
  
  /**
   * Static method to create account deactivated error
   */
  static accountDeactivated(message = 'Account is deactivated') {
    return new AuthError(message, 403, 'ACCOUNT_DEACTIVATED');
  }
  
  /**
   * Static method to create account pending deletion error
   */
  static accountPendingDeletion(message = 'Account is scheduled for deletion') {
    return new AuthError(message, 403, 'ACCOUNT_PENDING_DELETION');
  }
  
  /**
   * Static method to create invalid token error
   */
  static invalidToken(message = 'Invalid authentication token') {
    return new AuthError(message, 401, 'INVALID_TOKEN');
  }
  
  /**
   * Static method to create expired token error
   */
  static expiredToken(message = 'Authentication token has expired') {
    return new AuthError(message, 401, 'EXPIRED_TOKEN');
  }
  
  /**
   * Static method to create missing token error
   */
  static missingToken(message = 'Authentication token is required') {
    return new AuthError(message, 401, 'MISSING_TOKEN');
  }
  
  /**
   * Static method to create invalid OTP error
   */
  static invalidOTP(message = 'Invalid or expired OTP', attempts = null) {
    return new AuthError(message, 401, 'INVALID_OTP', { attempts });
  }
  
  /**
   * Static method to create OTP expired error
   */
  static expiredOTP(message = 'OTP has expired') {
    return new AuthError(message, 401, 'EXPIRED_OTP');
  }
  
  /**
   * Static method to create OTP max attempts error
   */
  static otpMaxAttempts(message = 'Maximum OTP attempts exceeded', lockoutUntil = null) {
    return new AuthError(message, 401, 'OTP_MAX_ATTEMPTS', { lockoutUntil });
  }
  
  /**
   * Static method to create insufficient permissions error
   */
  static insufficientPermissions(message = 'Insufficient permissions for this action', requiredPermissions = null) {
    return new AuthError(message, 403, 'INSUFFICIENT_PERMISSIONS', { requiredPermissions });
  }
  
  /**
   * Static method to create session not found error
   */
  static sessionNotFound(message = 'Session not found or expired') {
    return new AuthError(message, 401, 'SESSION_NOT_FOUND');
  }
  
  /**
   * Static method to create session expired error
   */
  static sessionExpired(message = 'Session has expired') {
    return new AuthError(message, 401, 'SESSION_EXPIRED');
  }
  
  /**
   * Static method to create concurrent session limit error
   */
  static sessionLimitExceeded(message = 'Maximum concurrent sessions exceeded') {
    return new AuthError(message, 401, 'SESSION_LIMIT_EXCEEDED');
  }
  
  /**
   * Static method to create password change required error
   */
  static passwordChangeRequired(message = 'Password change required') {
    return new AuthError(message, 403, 'PASSWORD_CHANGE_REQUIRED');
  }
  
  /**
   * Static method to create MFA required error
   */
  static mfaRequired(message = 'Multi-factor authentication required') {
    return new AuthError(message, 403, 'MFA_REQUIRED');
  }
  
  /**
   * Static method to create phone verification required error
   */
  static phoneVerificationRequired(message = 'Phone number verification required') {
    return new AuthError(message, 403, 'PHONE_VERIFICATION_REQUIRED');
  }
  
  /**
   * Static method to create registration not allowed error
   */
  static registrationNotAllowed(message = 'Registration is not allowed', reason = null) {
    return new AuthError(message, 403, 'REGISTRATION_NOT_ALLOWED', { reason });
  }
  
  /**
   * Static method to create login not allowed error
   */
  static loginNotAllowed(message = 'Login is not allowed', reason = null) {
    return new AuthError(message, 403, 'LOGIN_NOT_ALLOWED', { reason });
  }
  
  /**
   * Static method to create device not trusted error
   */
  static deviceNotTrusted(message = 'Device is not trusted', deviceId = null) {
    return new AuthError(message, 403, 'DEVICE_NOT_TRUSTED', { deviceId });
  }
  
  /**
   * Static method to create location not allowed error
   */
  static locationNotAllowed(message = 'Login from this location is not allowed', location = null) {
    return new AuthError(message, 403, 'LOCATION_NOT_ALLOWED', { location });
  }
  
  /**
   * Static method to create rate limit exceeded error
   */
  static rateLimitExceeded(message = 'Too many authentication attempts', retryAfter = null) {
    return new AuthError(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
  
  /**
   * Static method to create duplicate phone error
   */
  static duplicatePhone(message = 'Phone number already registered', phone = null) {
    return new AuthError(message, 409, 'DUPLICATE_PHONE', { phone });
  }
  
  /**
   * Static method to create phone not found error
   */
  static phoneNotFound(message = 'Phone number not found', phone = null) {
    return new AuthError(message, 404, 'PHONE_NOT_FOUND', { phone });
  }
  
  /**
   * Static method to create verification failed error
   */
  static verificationFailed(message = 'Verification failed', verificationId = null) {
    return new AuthError(message, 401, 'VERIFICATION_FAILED', { verificationId });
  }
  
  /**
   * Static method to create token refresh failed error
   */
  static tokenRefreshFailed(message = 'Token refresh failed') {
    return new AuthError(message, 401, 'TOKEN_REFRESH_FAILED');
  }
  
  /**
   * Static method to create logout failed error
   */
  static logoutFailed(message = 'Logout failed') {
    return new AuthError(message, 500, 'LOGOUT_FAILED');
  }
  
  /**
   * Static method to create password reset failed error
   */
  static passwordResetFailed(message = 'Password reset failed') {
    return new AuthError(message, 500, 'PASSWORD_RESET_FAILED');
  }
  
  /**
   * Static method to create account recovery failed error
   */
  static accountRecoveryFailed(message = 'Account recovery failed') {
    return new AuthError(message, 500, 'ACCOUNT_RECOVERY_FAILED');
  }
}

module.exports = { AuthError };
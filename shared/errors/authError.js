/**
 * Authentication Error Class
 * Handles authentication and authorization failure errors
 */
class AuthError extends Error {
  constructor(
    message,
    statusCode = 401,
    errorCode = "AUTHENTICATION_ERROR",
    details = null
  ) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;

    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static invalidToken(message = "Invalid or expired token") {
    return new AuthError(message, 401, "INVALID_TOKEN");
  }

  static invalidTokenType(message = "Invalid token type") {
    return new AuthError(message, 401, "INVALID_TOKEN_TYPE");
  }

  static tokenExpired(message = "Token has expired") {
    return new AuthError(message, 401, "TOKEN_EXPIRED");
  }

  static tokenMissing(message = "Authentication token is required") {
    return new AuthError(message, 401, "TOKEN_MISSING");
  }

  static invalidCredentials(message = "Invalid credentials") {
    return new AuthError(message, 401, "INVALID_CREDENTIALS");
  }

  static passwordReuse(message = "Old password reused") {
    return new AuthError(message, 401, "PASSWORD_REUSED");
  }

  static userNotFound(message = "User not found") {
    return new AuthError(message, 404, "USER_NOT_FOUND");
  }

  static accountSuspended(message = "Account is suspended", details = {}) {
    return new AuthError(message, 403, "ACCOUNT_SUSPENDED", details);
  }

  static accountDeactivated(message = "Account is deactivated") {
    return new AuthError(message, 403, "ACCOUNT_DEACTIVATED");
  }

  static accountPendingDeletion(message = "Account is scheduled for deletion") {
    return new AuthError(message, 403, "ACCOUNT_PENDING_DELETION");
  }

  static sessionNotFound(message = "Session not found or expired") {
    return new AuthError(message, 401, "SESSION_NOT_FOUND");
  }

  static sessionExpired(message = "Session has expired") {
    return new AuthError(message, 401, "SESSION_EXPIRED");
  }

  static sessionLimitExceeded(
    message = "Maximum concurrent sessions exceeded"
  ) {
    return new AuthError(message, 401, "SESSION_LIMIT_EXCEEDED");
  }

  static maxLoginAttemptsExceeded(message = "Maximum login attempts exceeded") {
    return new AuthError(message, 429, "MAX_LOGIN_ATTEMPTS");
  }

  static invalidOTP(message = "Invalid OTP") {
    return new AuthError(message, 401, "INVALID_OTP");
  }

  static expiredOTP(message = "OTP has expired") {
    return new AuthError(message, 401, "EXPIRED_OTP");
  }

  static insufficientPermissions(
    message = "Insufficient permissions for this action"
  ) {
    return new AuthError(message, 403, "INSUFFICIENT_PERMISSIONS");
  }

  static deviceNotTrusted(message = "Device is not trusted", deviceId = null) {
    return new AuthError(message, 403, "DEVICE_NOT_TRUSTED", { deviceId });
  }

  static duplicatePhone(
    message = "Phone number already registered",
    data = {}
  ) {
    return new AuthError(message, 409, "DUPLICATE_PHONE", data);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: new Date().toISOString(),
      isOperational: this.isOperational,
    };
  }
}

module.exports = AuthError;

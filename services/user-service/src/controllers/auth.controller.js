const { validationResult } = require("express-validator");
// Service imports
const authService = require("../services/auth.service");
const otpService = require("../services/otp.service");
// Local utility imports
const validationUtil = require("../utils/validation.util");
const logger = require("../../../../shared/utils/logger.util");
// Shared utilities import
// The shared folder is copied to /app/shared/ in Docker
const ApiResponse = require("../../../../shared/utils/api.response");
// Error imports
const { AuthError } = require("../../../../shared/errors/authError");
const ValidationError = require("../../../../shared/errors/validationError");

/**
 * Handle validation errors
 * @param {Object} req - Express request object
 * @param {string} errorMessage - Custom error message
 * @throws {ValidationError} - Throws validation error with field details
 */
const handleValidationErrors = (req, errorMessage = "Validation failed") => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ValidationError.fromExpressValidator(errors.array(), errorMessage);
  }
};

/**
 * Handle registration OTP request.
 *
 * @async
 * @function requestRegistrationOtp
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.phone - User's phone number (without country code).
 *   Example: `"15680026773"`
 * @param {string} req.body.country_code - Country dialing code.
 *   Example: `"+86"`
 * @param {import("express").Response} res - Express response object used to return the API result.
 * @param {import("express").NextFunction} next - Express next middleware function for error handling.
 *
 * @returns {Promise<void>} Sends a JSON success response or forwards error to error middleware.
 *
 * @example
 * // Request body
 * {
 *   "phone": "15680026773",
 *   "country_code": "+86"
 * }
 *
 * // Successful response
 * {
 *  "success": true,
 *  "status_code": 200,
 *  "data": {
 *      "phone": "+8615680026773",
 *      "verification_id": "74785f2f-b702-4300-89aa-f19c9120cf04",
 *      "expires_in": 300
 * },
 * "message": "OTP sent successfully",
 * "timestamp": "2025-09-22T07:46:07.231Z",
 * "request_id": "59e95877-290a-47c0-b673-35e97c0a49cf"
 * }
 */

const requestRegistrationOtp = async (req, res, next) => {
  try {
    // throws error if unvalid
    handleValidationErrors(req, "Registration validation failed");

    const { phone, country_code } = req.body;

    const result = await otpService.sendOtp(
      phone, //without country code
      country_code,
      "registration"
    );

    logger.info("Registration OTP requested", {
      phone: result.phone, // with country code formattedPhoneE164
      verificationId: result.verification_id,
      requestId: req.requestId,
    });

    ApiResponse.success("OTP sent successfully", result)
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * User Registration (Verify OTP and validate password)
 */

const register = async (req, res, next) => {
  try {
    handleValidationErrors(req, "Registration validation failed");

    const registrationData = validationUtil.validateRegistration(req.body);
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");

    const result = await authService.registerUser({
      ...registrationData,
      ipAddress,
      userAgent,
    });

    logger.info("User registered successfully", {
      userId: result.user.id,
      phone: result.user.phone, // with country code
      ip: ipAddress,
      requestId: req.requestId,
    });

    ApiResponse.created("Registration successful", result)
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Request OTP for Login
 */

const requestLoginOtp = async (req, res, next) => {
  try {
    handleValidationErrors(req, "Login validation failed");

    const { phone, country_code } = req.body;

    const result = await otpService.sendOtp(phone, country_code, "login");

    logger.info("Login OTP requested", {
      phone: result.phone,
      verificationId: result.verification_id,
      requestId: req.requestId,
    });

    ApiResponse.success("OTP sent successfully", result)
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * User Login
 */

const login = async (req, res, next) => {
  try {
    handleValidationErrors(req, "Login validation failed");

    const loginData = validationUtil.validateLogin(req.body);
    const ipAddress = req.ip;
    const userAgent = req.get("User-Agent");

    const result = await authService.loginUser({
      ...loginData,
      ipAddress,
      userAgent,
    });

    logger.info("User logged in successfully", {
      userId: result.user.id,
      phone: result.user.phone,
      sessionId: result.session.id,
      ip: ipAddress,
      requestId: req.requestId,
    });

    ApiResponse.loginSuccess(
      result.user,
      result.session,
      result.loginMethod,
      "Login successful"
    )
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Token Refresh
 */
const refreshToken = async (req, res, next) => {
  try {
    handleValidationErrors(req, "Validation failed");

    const { refresh_token } = req.body;

    const result = await authService.refreshAndRotateTokens(refresh_token);

    let tokens = {
      expires_at: result.tokens.expires_at,
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
    };

    logger.info("Tokens refreshed successfully", {
      requestId: req.requestId,
    });

    ApiResponse.tokenRefreshed(tokens, "Tokens refreshed successfully")
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * User Logout
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
      throw AuthError.missingToken("Authorization header is required");
    }

    const token = authHeader.replace("Bearer ", "");

    await authService.logoutUser(token);

    logger.info("User logged out successfully", {
      requestId: req.requestId,
    });

    ApiResponse.logoutSuccess("Logged out successfully")
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Request OTP for Password Reset
 */
const requestPasswordResetOtp = async (req, res, next) => {
  try {
    handleValidationErrors(req, "Validation failed");

    const { phone, country_code } = req.body;

    const result = await otpService.sendOtp(
      phone,
      country_code,
      "password_reset"
    );

    logger.info("Password reset OTP requested", {
      phone: result.phone,
      verificationId: result.verification_id,
      requestId: req.requestId,
    });

    ApiResponse.success("OTP sent successfully", result)
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Reset OTP
 */
const verifyResetOtp = async (req, res, next) => {
  try {
    handleValidationErrors(req, "OTP verification validation failed");

    const { phone, country_code, verification_id, otp_code } = req.body;

    const resetToken = await authService.verifyResetOtp({
      phone,
      country_code,
      verification_id,
      otp_code,
    });

    ApiResponse.success("OTP verified successfully", {
      reset_token: resetToken,
    })
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password
 */
const resetPassword = async (req, res, next) => {
  try {
    handleValidationErrors(req, "Password reset validation failed");

    const { phone, country_code, reset_token, new_password } = req.body;

    const formattedPhoneE164 = validationUtil.validatePhoneNumber(
      phone,
      country_code
    ).e164;

    await authService.resetPassword({
      formattedPhoneE164,
      reset_token,
      new_password,
    });

    logger.info("Password reset successfully", {
      requestId: req.requestId,
    });

    ApiResponse.success("Password has been reset successfully")
      .setRequestId(req.requestId)
      .send(res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestRegistrationOtp,
  register,
  requestLoginOtp,
  login,
  refreshToken,
  logout,
  requestPasswordResetOtp,
  verifyResetOtp,
  resetPassword,
};

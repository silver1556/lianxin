const express = require("express");
const { body, validationResult } = require("express-validator");
// Service imports
const authService = require("../services/auth.service");
const otpService = require("../services/otp.service");
// Local utility imports
const validationUtil = require("../utils/validation.util");
const logger = require("../utils/logger.util");
// Shared utilities import
// The shared folder is copied to /app/shared/ in Docker
const apiResponse = require("../../shared/utils/api.response");
// Error imports
const { AuthError } = require("../../shared/errors/authError");
const { ValidationError } = require("../errors/validationError");

// Middleware imports
const validateRequest = require("../middleware/validate-request.middleware");
const authMiddleware = require("../middleware/auth.middleware.js");

const router = express.Router();

/**
 * Request OTP for Registration
 * POST /api/v1/auth/register/otp
 */
router.post(
  "/register/otp",
  validateRequest(["phone", "country_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "Registration validation failed",
          fieldErrors
        );
      }

      const { phone, country_code } = req.body;
      const ipAddress = req.ip;

      const result = await otpService.sendRegistrationOtp(
        phone, //without country code
        country_code,
        ipAddress
      );

      logger.info("Registration OTP requested", {
        phone: result.phone, // with country code formattedPhoneE164
        verificationId: result.verification_id,
        ipAddress,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(result, "OTP sent successfully", req.requestId)
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * User Registration
 * POST /api/v1/auth/register
 */
router.post(
  "/register",
  validateRequest([
    "phone",
    "country_code",
    "password",
    "verification_id",
    "otp_code",
    "agree_terms",
    "device_id",
    "device_type",
    "device_name",
    "display_name",
    "avatar_url",
    "gender",
    "birth_date",
  ]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("password").notEmpty().withMessage("Password is required"),
    body("verification_id")
      .isUUID()
      .withMessage("Valid verification ID is required"),
    body("otp_code")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
    body("agree_terms")
      .equals("true")
      .withMessage("You must agree to terms and conditions"),
    body("device_id").notEmpty().withMessage("Device ID is required"),
    body("device_type")
      .isIn(["mobile", "desktop", "tablet"])
      .withMessage("Invalid device type"),
    body("device_name").notEmpty().withMessage("Device name is required"),
    body("display_name")
      .optional()
      .isLength({ min: 1, max: 20 })
      .withMessage("Display name must be 1-20 characters"),
    body("avatar_url")
      .optional()
      .isURL()
      .withMessage("Avatar URL must be a valid URL"),
    body("gender")
      .isIn(["male", "female", "other"])
      .withMessage("Invalid gender"),
    body("birth_date")
      .notEmpty()
      .withMessage("Birth date is required")
      .isDate({ format: "YYYY-MM-DD" })
      .withMessage("Birth date must be in YYYY-MM-DD format")
      .custom((value) => {
        const today = new Date().toISOString().split("T")[0];
        if (value >= today) {
          throw new Error("Birth date must be in the past");
        }
        return true;
      }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "Registration validation failed",
          fieldErrors
        );
      }

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
        ipAddress,
        requestId: req.requestId,
      });

      res
        .status(201)
        .json(
          apiResponse.success(result, "Registration successful", req.requestId)
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Request OTP for Login
 * POST /api/v1/auth/login/otp
 */
router.post(
  "/login/otp",
  validateRequest(["phone", "country_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields("Validation failed", fieldErrors);
      }

      const { phone, country_code } = req.body;
      const ipAddress = req.ip;

      const result = await otpService.sendLoginOtp(
        phone,
        country_code,
        ipAddress
      );

      logger.info("Login OTP requested", {
        phone: result.phone,
        verificationId: result.verification_id,
        ipAddress,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(result, "OTP sent successfully", req.requestId)
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * User Login
 * POST /api/v1/auth/login
 */
router.post(
  "/login",
  validateRequest([
    "phone",
    "country_code",
    "device_id",
    "device_type",
    "device_name",
    "password",
    "verification_id",
    "otp_code",
  ]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("device_id").notEmpty().withMessage("Device ID is required"),
    body("device_type")
      .isIn(["mobile", "desktop", "tablet"])
      .withMessage("Invalid device type"),
    body("device_name").notEmpty().withMessage("Device name is required"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "Login validation failed",
          fieldErrors
        );
      }

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
        ipAddress,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(apiResponse.success(result, "Login successful", req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Token Refresh
 * POST /api/v1/auth/refresh
 */
router.post(
  "/refresh",
  validateRequest(["refresh_token"]),
  [body("refresh_token").notEmpty().withMessage("Refresh token is required")],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields("Validation failed", fieldErrors);
      }

      const { refresh_token } = req.body;

      const result = await authService.refreshAndRotateTokens(refresh_token);

      logger.info("Tokens refreshed successfully", {
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            result,
            "Tokens refreshed successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * User Logout
 * POST /api/v1/auth/logout
 */
router.post("/logout", async (req, res, next) => {
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

    res
      .status(200)
      .json(
        apiResponse.success(null, "Logged out successfully", req.requestId)
      );
  } catch (error) {
    next(error);
  }
});

/**
 * Request OTP for Password Reset
 * POST /api/v1/auth/forgot-password/otp
 */
router.post(
  "/forgot-password/otp",
  validateRequest(["phone", "country_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields("Validation failed", fieldErrors);
      }

      const { phone, country_code } = req.body;
      const ipAddress = req.ip;

      const result = await otpService.sendPasswordResetOtp(
        phone,
        country_code,
        ipAddress
      );

      logger.info("Password reset OTP requested", {
        phone: result.phone,
        verificationId: result.verification_id,
        ipAddress,
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(result, "OTP sent successfully", req.requestId)
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Verify Reset OTP
 * POST /api/v1/auth/verify-reset-otp
 */
router.post(
  "/verify-reset-otp",
  validateRequest(["phone", "country_code", "verification_id", "otp_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("verification_id")
      .isUUID()
      .withMessage("Valid verification ID is required"),
    body("otp_code")
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "OTP verification validation failed",
          fieldErrors
        );
      }

      const { phone, country_code, verification_id, otp_code } = req.body;

      const resetToken = await authService.verifyResetOtp({
        phone,
        country_code,
        verification_id,
        otp_code,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            { reset_token: resetToken },
            "OTP verified successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);
/**
 * Reset Password
 * POST /api/v1/auth/reset-password
 */
router.post(
  "/reset-password",
  validateRequest([
    "phone",
    "country_code",
    "reset_token",
    "new_password",
    "confirm_password",
  ]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
    body("reset_token").notEmpty().withMessage("Reset token is required"),
    body("new_password").notEmpty().withMessage("New password is required"),
    body("confirm_password").custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error("Password confirmation does not match");
      }
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Map the express-validator errors into fieldErrors format
        const fieldErrors = errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
          constraint: null, // optional, can add if needed
        }));

        // Throw a ValidationError with both first error message and all field errors
        throw ValidationError.multipleFields(
          "Password reset validation failed",
          fieldErrors
        );
      }

      const { phone, country_code, reset_token, new_password } = req.body;

      const formattedPhoneE164 = validationUtil.validatePhoneNumber(
        phone,
        country_code
      ).e164;

      const result = await authService.resetPassword({
        formattedPhoneE164,
        reset_token,
        new_password,
      });

      logger.info("Password reset successfully", {
        requestId: req.requestId,
      });

      res
        .status(200)
        .json(
          apiResponse.success(
            result,
            "Password has been reset successfully",
            req.requestId
          )
        );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * verify token
 * Used in other services to authenticate using user service
 * GET /api/v1/auth/verify-token
 */
router.get("/verify-token", authMiddleware.authenticate, (req, res) => {
  return res.json({
    success: true,
    user: req.user, // (payload info) comes from middleware
    request_id: req.requestId,
  });
});

module.exports = router;

const express = require("express");
const { body } = require("express-validator");

// Controller import
const authController = require("../controllers/auth.controller");

// Middleware imports
const validateRequest = require("../middlewares/validate-request.middleware");
const authMiddleware = require("../middlewares/auth.middleware.js");

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  "/register/otp",
  validateRequest(["phone", "country_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  asyncHandler(authController.requestRegistrationOtp)
);

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
  ],
  asyncHandler(authController.register)
);

router.post(
  "/login/otp",
  validateRequest(["phone", "country_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  asyncHandler(authController.requestLoginOtp)
);

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
  asyncHandler(authController.login)
);

router.post(
  "/refresh",
  validateRequest(["refresh_token"]),
  [body("refresh_token").notEmpty().withMessage("Refresh token is required")],
  asyncHandler(authController.refreshToken)
);

router.post("/logout", asyncHandler(authController.logout));

router.post(
  "/forgot-password/otp",
  validateRequest(["phone", "country_code"]),
  [
    body("phone").notEmpty().withMessage("Phone number is required"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
  asyncHandler(authController.requestPasswordResetOtp)
);

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
  asyncHandler(authController.verifyResetOtp)
);

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
  asyncHandler(authController.resetPassword)
);

module.exports = router;

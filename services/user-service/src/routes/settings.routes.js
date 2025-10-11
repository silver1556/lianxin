const express = require("express");
const { body } = require("express-validator");

// Controller import
const settingsController = require("../controllers/settings.controller");

// Middleware imports
const authMiddleware = require("../middlewares/auth.middleware.js");
const { changePhoneNumber } = require("../services/settings.service.js");

const router = express.Router();

// Validation rules
const validationRules = {
  requestPhoneChangeOtp: [
    body("new_phone").notEmpty().withMessage("New phone number is required 1"),
    body("country_code").notEmpty().withMessage("Country code is required"),
  ],
};

/**
 * Get User Settings (protected route)
 * GET /api/v1/user/settings
 */
router.get(
  "/settings",
  authMiddleware.authenticate,
  settingsController.getUserSettings
);

/**
 * Update User Individual Setting (protected route)
 * PATCH /api/v1/user/settings/:category
 */
router.patch(
  "/settings/:category",
  authMiddleware.authenticate,
  settingsController.updateUserSetting
);

/**
 * Change Password(protected route)
 * PUT /api/v1/user/password-change
 * 
 * {
    "current_password":"Silver6453@",
    "new_password":"Silver453@",
    "confirm_password":"Silver453@"
}
 */
router.put(
  "/password-change",
  authMiddleware.authenticate,
  settingsController.changePassword
);

/**
 * Request OTP for Phone Number Change(protected route)
 * POST /api/v1/user/phone-change/otp
 * 
 * {
    "new_phone":"15680026773",
    "country_code":"+86"
}
 */
router.post(
  "/phone-change/otp",
  validationRules.requestPhoneChangeOtp,
  authMiddleware.authenticate,
  settingsController.requestPhoneChangeOtp
);

/**
 * Change Phone Number(protected route)
 * PUT /api/v1/user/phone-number-change
 * 
 * {
    "verification_id": "812f19bf-14af-400f-b7be-64e7d06390f4",
    "otp_code":"314280",
    "new_phone":"15680026773",
    "country_code":"+86",
    "password":"Silver453@"
}
 */
router.put(
  "/phone-number-change",
  authMiddleware.authenticate,
  settingsController.changePhoneNumber
);

/**
 * Deactivate Account(protected route)
 * POST /api/v1/user/deactivate
 */
router.post(
  "/deactivate",
  authMiddleware.authenticate,
  settingsController.deactivateAccount
);

/**
 * Request Account Deletion(protected route)
 * POST /api/v1/user/request-deletion
 */
router.post(
  "/request-deletion",
  authMiddleware.authenticate,
  settingsController.deleteAccount
);

module.exports = router;

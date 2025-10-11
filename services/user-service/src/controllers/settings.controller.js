const { validationResult } = require("express-validator");

const settingsService = require("../services/settings.service");

const validationUtil = require("../utils/validation.util");
const logger = require("../../../../shared/utils/logger.util");
const apiResponse = require("../../../../shared/utils/api.response");
const {
  ValidationError,
} = require("../../../../shared/errors/validationError");

/**
 * Get User Settings (protected route)
 */
const getUserSettings = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const settings = await settingsService.getUserSettings(userId);

    logger.info("User settings retrieved", {
      userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { settings },
          "Settings retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Update User Individual Setting (protected route)
 */
const updateUserSetting = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { category } = req.params;
    const settingData = req.body;

    // Validate that only one field is being updated
    const settingKeys = Object.keys(settingData);

    const settingKey = settingKeys[0];
    const settingValue = settingData[settingKey];

    // Validate the specific setting
    try {
      validationUtil.validateSettingValue(category, settingKey, settingValue);
    } catch (error) {
      logger.error("Setting validation failed", {
        userId,
        category,
        setting: settingKey,
        value: settingValue,
        requestId: req.requestId,
      });
      return res.status(422).json(
        apiResponse.validationError(
          [
            {
              field: settingKey,
              message: error.message,
            },
          ],
          req.requestId
        )
      );
    }

    const result = await settingsService.updateIndividualSetting(
      userId,
      category,
      settingKey,
      settingValue
    );

    logger.info("User setting updated", {
      userId,
      category,
      setting: settingKey,
      value: settingValue,
      requestId: req.requestId,
    });

    res.status(200).json(
      apiResponse.success(
        result, // Return only updated field
        "Setting updated successfully",
        req.requestId
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password(protected route)
 * 
 * {
    "current_password":"Silver6453@",
    "new_password":"Silver453@",
    "confirm_password":"Silver453@"
}
 */
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const sessionId = req.user.sessionId;
    // Use validation utility to validate password change
    const passwordData = validationUtil.validatePasswordChange(req.body);

    await settingsService.changePassword(userId, passwordData, sessionId);

    logger.info("Password changed successfully", {
      userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          null,
          "Password changed successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Request OTP for Phone Number Change(protected route)
 * 
 * {
    "new_phone":"15680026773",
    "country_code":"+86"
}
 */
const requestPhoneChangeOtp = async (req, res, next) => {
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

    const userId = req.user.userId;
    const { new_phone, country_code } = req.body;

    const result = await settingsService.requestPhoneChangeOtp(
      userId,
      new_phone,
      country_code
    );

    logger.info("Phone change OTP requested", {
      userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          result,
          "OTP sent to new phone number",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Change Phone Number(protected route)
 * 
 * {
    "verification_id": "812f19bf-14af-400f-b7be-64e7d06390f4",
    "otp_code":"314280",
    "new_phone":"15680026773",
    "country_code":"+86",
    "password":"Silver453@"
}
 */
const changePhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // Use validation utility
    const phoneChangeData = validationUtil.validatePhoneChange(req.body);

    const result = await settingsService.changePhoneNumber(
      userId,
      phoneChangeData
    );

    logger.info("Phone number changed successfully", {
      userId,
      newPhone: result.new_phone,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          result,
          "Phone number updated successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate Account(protected route)
 */
const deactivateAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // Use validation utility
    const deactivationData = validationUtil.validateAccountDeactivation(
      req.body
    );

    await settingsService.deactivateAccount(
      userId,
      deactivationData.password,
      deactivationData.reason
    );

    logger.info("Account deactivated", {
      userId,
      reason: deactivationData.reason,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          null,
          "Account successfully deactivated. You have been logged out.",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Request Account Deletion(protected route)
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    // Use validation utility
    const deletionData = validationUtil.validateAccountDeletion(req.body);

    await settingsService.requestAccountDeletion(userId, deletionData.password);

    logger.info("Account deletion requested", {
      userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          null,
          "Your account is now scheduled for permanent deletion. You have 15 days to cancel this request by logging in. You have been logged out.",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserSettings,
  updateUserSetting,
  changePassword,
  requestPhoneChangeOtp,
  changePhoneNumber,
  deactivateAccount,
  deleteAccount,
};

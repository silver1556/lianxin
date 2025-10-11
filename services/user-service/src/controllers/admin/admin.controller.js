const { validationResult } = require("express-validator");

const adminService = require("../../services/admin.service");

const logger = require("../../../../../shared/utils/logger.util");
const apiResponse = require("../../../../../shared/utils/api.response");

const {
  ValidationError,
} = require("../../../../../shared/errors/validationError");

/**
 * Get Users List (Admin)
 */
const getUsersList = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Admin user list validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const adminUserId = req.user.userId;
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      status: req.query.status,
      search: req.query.search,
    };

    const result = await adminService.getUserList(filters);

    logger.info("Admin user list retrieved", {
      adminUserId,
      filters,
      resultCount: result.users.length,
      totalCount: result.total_count,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          result,
          "User list retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Details (Admin)
 */
const getUserDetails = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;
    const { userId } = req.params;

    const user = await adminService.getUserDetails(userId);

    logger.info("Admin user details retrieved", {
      adminUserId,
      targetUserId: userId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { user },
          "User details retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend User (Admin)
 */
const suspendUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "User suspension validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const adminUserId = req.user.userId;
    const { userId } = req.params;
    const { reason, duration, admin_note } = req.body;

    const result = await adminService.suspendUser(userId, {
      reason,
      duration,
      admin_note,
      suspended_by: adminUserId,
    });

    logger.info("User suspended by admin", {
      adminUserId,
      targetUserId: userId,
      reason,
      duration,
      suspensionUntil: result.suspension_until,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          result,
          `User ${userId} suspended until ${result.suspension_until}`,
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Unsuspend User (Admin)
 */
const unsuspendUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "User unsuspension validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const adminUserId = req.user.userId;
    const { userId } = req.params;
    const { admin_note } = req.body;

    await adminService.unsuspendUser(userId, {
      admin_note,
      unsuspended_by: adminUserId,
    });

    logger.info("User unsuspended by admin", {
      adminUserId,
      targetUserId: userId,
      adminNote: admin_note,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          null,
          `User ${userId} has been unsuspended`,
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Verify User (Admin)
 */
const verifyUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "User verification validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const adminUserId = req.user.userId;
    const { userId } = req.params;
    const { verification_type, verification_data, admin_note } = req.body;

    await adminService.verifyUser(userId, {
      verification_type,
      verification_data,
      admin_note,
      verified_by: adminUserId,
    });

    logger.info("User verified by admin", {
      adminUserId,
      targetUserId: userId,
      verificationType: verification_type,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          null,
          `User ${userId} has been verified`,
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Statistics (Admin)
 */
const getUserStats = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId;

    const stats = await adminService.getUserStatistics();

    logger.info("Admin statistics retrieved", {
      adminUserId,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          { stats },
          "User statistics retrieved successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Search Users (Admin)
 */
const searchUsers = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ValidationError.multipleFields(
        "Admin search validation failed",
        errors.array().map((err) => ({
          field: err.path,
          message: err.msg,
          value: err.value,
        }))
      );
    }

    const adminUserId = req.user.userId;
    const searchParams = {
      q: req.query.q,
      type: req.query.type || "name",
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0,
    };

    const result = await adminService.searchUsers(searchParams);

    logger.info("Admin user search performed", {
      adminUserId,
      searchParams,
      resultCount: result.users.length,
      requestId: req.requestId,
    });

    res
      .status(200)
      .json(
        apiResponse.success(
          result,
          "User search completed successfully",
          req.requestId
        )
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsersList,
  getUserDetails,
  suspendUser,
  unsuspendUser,
  verifyUser,
  getUserStats,
  searchUsers,
};

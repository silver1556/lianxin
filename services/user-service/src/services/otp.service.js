const crypto = require("crypto");

const securityConfig = require("../config/security.config");

const { OtpVerification, User } = require("../models");

const redisClient = require("../../../../shared/libraries/cache/redis.client");

const encryptionService = require("./encryption.service");
const validationUtil = require("../utils/validation.util");

const logger = require("../../../../shared/utils/logger.util");

const ValidationError = require("../../../../shared/errors/validationError");
const AuthError = require("../../../../shared/errors/authError");
const AppError = require("../../../../shared/errors/appError");

/**
 * OTP Service
 * Handles OTP generation, validation, and SMS integration
 */
class OtpService {
  constructor() {
    this.otpLength = securityConfig.app.otpLength;
    this.otpExpiryMinutes = securityConfig.app.otpExpiryMinutes;
  }

  /**
   * Helper to Generate OTP code
   */
  generateOtpCode() {
    const min = Math.pow(10, this.otpLength - 1);
    const max = Math.pow(10, this.otpLength) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Helper to Calculate expiry time
   */
  calculateExpiryTime() {
    const now = new Date();
    return new Date(now.getTime() + this.otpExpiryMinutes * 60 * 1000);
  }

  // Helper to generate a unique verification_id
  async generateUniqueVerificationId() {
    let verificationId;
    let exists = true;

    while (exists) {
      verificationId = crypto.randomUUID();
      exists = await OtpVerification.findOne({
        where: { verification_id: verificationId },
      });
    }

    return verificationId;
  }

  /**
   * Send OTP for registration, login, password reset, and phone number change
   * @param {string} phoneNumber - Phone number without country code
   * @param {string} countryCode - Country code (e.g., '+86')
   * @param {string} otpType - Type of OTP: 'registration', 'login', 'password_reset', 'phone_number_change'
   * @param {number} userId - User ID (optional, for logged-in users)
   * @returns {Promise<{ phone: string, verification_id: string, expires_in: number }>}
   */
  async sendOtp(phoneNumber, countryCode, otpType, userId = null) {
    // Validate phone number
    const phoneValidation = validationUtil.validatePhoneNumber(
      phoneNumber,
      countryCode
    );
    const formattedPhoneE164 = phoneValidation.e164;

    const phoneHash = encryptionService.hashData(formattedPhoneE164);

    const existingUser = await User.findByPhoneHash(phoneHash, ["phone_hash"]);

    if (otpType === "registration") {
      // Check if phone number already exists
      if (existingUser) {
        throw AuthError.duplicatePhone(
          "Phone number already registered",
          formattedPhoneE164
        );
      }
    } else {
      // Check if phone number is registered
      if (!existingUser) {
        throw AuthError.userNotFound("User not found");
      }
    }
    // Check rate limiting
    await this.checkRateLimit(formattedPhoneE164, otpType);

    // Generate OTP (6 digit)
    const verificationId = await this.generateUniqueVerificationId();
    const otpCode = this.generateOtpCode().toString().padStart(6, "0"); // 6 digit OTP code
    const expiresAt = this.calculateExpiryTime();

    // Store OTP in redis (key-string, value, ttl-sec, shouldCompress-bool, shouldEncrypt-bool)(serialize object as JSON)
    const redisResult = await redisClient.set(
      `user:otp:${verificationId}`,
      { code: otpCode, phone: phoneHash },
      this.otpExpiryMinutes * 60,
      false,
      false
    );

    if (redisResult !== "OK") {
      throw AppError.serviceUnavailable("Redis write failed during send-otp");
    }

    // Store metadata in database
    let otpRecord;
    try {
      otpRecord = await OtpVerification.create({
        user_id: userId,
        verification_id: verificationId,
        phone: formattedPhoneE164,
        otp_type: otpType,
        expires_at: expiresAt,
      });
    } catch (error) {
      throw AppError.sequelizeError(error);
    }

    // IMPORTANT: Send SMS (mock implementation - replace with actual SMS service)
    await this.sendSms(formattedPhoneE164, otpCode, otpType);

    logger.info(`${otpType} OTP sent`, {
      user_id: userId,
      phone: formattedPhoneE164,
    });
    // Mark OTP status in as sent
    try {
      await otpRecord.update({ status: "sent" });
    } catch (error) {
      throw AppError.sequelizeError(error);
    }

    return {
      phone: formattedPhoneE164,
      verification_id: verificationId,
      expires_in: this.otpExpiryMinutes * 60,
    };
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(verificationId, otpCode, expectedPhoneHashed) {
    // Validate inputs
    if (!verificationId) {
      throw ValidationError.requiredField(
        "verification_id",
        "Verification ID is required"
      );
    }
    if (!otpCode) {
      throw ValidationError.requiredField("otp_code", "OTP code is required");
    }
    if (!expectedPhoneHashed) {
      throw ValidationError.requiredField(
        "otp_code",
        "Phone number is required"
      );
    }

    validationUtil.validateOTP(otpCode);

    let otpRecord;
    try {
      // Find OTP record in database
      otpRecord = await OtpVerification.findByVerificationId(verificationId);
    } catch (error) {
      throw AppError.sequelizeError(error);
    }

    if (!otpRecord) {
      throw AuthError.invalidOTP("Invalid verification ID");
    }

    // Get OTP record from redis
    const redisResult = await redisClient.get(`user:otp:${verificationId}`);

    if (!redisResult) {
      throw AuthError.invalidOTP("OTP code expired");
    }

    // Check if phone matches
    if (redisResult.phone !== expectedPhoneHashed) {
      throw AuthError.invalidOTP("Phone number mismatch");
    }

    // Check if OTP can be verified
    if (otpRecord.isVerified()) {
      throw AuthError.invalidOTP("OTP has already been used");
    }

    // Verify OTP code
    if (redisResult.code !== otpCode) {
      throw AuthError.invalidOTP("Invalid OTP code");
    }

    try {
      // Mark as verified
      await otpRecord.markAsVerified();
    } catch (error) {
      throw AppError.sequelizeError(error);
    }

    logger.info("OTP verified successfully", {
      verificationId,
      phone: otpRecord.phone,
      otpType: otpRecord.otp_type,
      userId: otpRecord.user_id,
    });

    return;
  }

  /**
   * Enforces phone number based rate limiting rules for OTP requests.
   *
   * - Restricts users to **1 OTP per minute per phone**.
   * - Restricts users to **5 OTPs per hour per phone**.
   * - Uses `OtpVerification.countRecentOtp()` to query recent OTP records
   *   from the database and enforce limits.
   *
   * @async
   * @function checkRateLimit
   * @param {string} phone - The E.164 formatted phone number.
   * @param {string} otpType - The type of OTP being requested ('registration', 'login', 'password_reset', 'phone_number_change').
   * @throws {AuthError} If the user exceeds the per-minute or hourly OTP request limits.
   *
   * @returns {Promise<void>} Resolves if within allowed limits, otherwise throws.
   */
  async checkRateLimit(phone, otpType) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Count recent OTP requests
    const recentOtps = await OtpVerification.countRecentOtp(
      phone,
      otpType,
      oneMinuteAgo
    );

    if (recentOtps >= 1) {
      throw AppError.tooManyRequests(
        "Please wait before requesting another OTP:60"
      );
    }

    // Check hourly limit
    const hourlyOtps = await OtpVerification.countRecentOtp(
      phone,
      otpType,
      oneHourAgo
    );

    if (hourlyOtps >= 5) {
      throw AuthError.rateLimitExceeded("Hourly OTP limit exceeded:3600");
    }
  }

  /**
   * Send SMS (mock implementation)
   */
  async sendSms(phone, otpCode, type) {
    try {
      // Mock SMS implementation
      // In production, integrate with Alibaba Cloud SMS service

      const messages = {
        registration: `Your Lianxin registration code is: ${otpCode}. Valid for ${this.otpExpiryMinutes} minutes.`,
        login: `Your Lianxin login code is: ${otpCode}. Valid for ${this.otpExpiryMinutes} minutes.`,
        password_reset: `Your Lianxin password reset code is: ${otpCode}. Valid for ${this.otpExpiryMinutes} minutes.`,
        phone_number_change: `Your Lianxin phone change code is: ${otpCode}. Valid for ${this.otpExpiryMinutes} minutes.`,
      };

      const message =
        messages[type] || `Your Lianxin verification code is: ${otpCode}`;

      // Mock SMS sending
      logger.info("SMS sent (mock)", {
        phone,
        message,
        type,
      });

      // In production, replace with actual SMS service call
      // const smsResult = await alibabaCloudSms.send(phone, message);

      return {
        success: true,
        phone,
        message_id: crypto.randomUUID(),
      };
    } catch (error) {
      logger.error("SMS sending failed", {
        phone,
        type,
        error: error.message,
      });
      throw new AppError("Failed to send SMS", 500, "SMS_SEND_ERROR");
    }
  }

  /**
   * Cleanup expired OTPs
   */
  async cleanupExpiredOtps() {
    try {
      const deletedCount = await OtpVerification.cleanupExpired();
      logger.info("Expired OTPs cleaned up", { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup expired OTPs", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cleanup verified OTPs older than specified days
   */
  async cleanupVerifiedOtps(daysOld = 15) {
    try {
      const deletedCount = await OtpVerification.cleanupVerified(daysOld);
      logger.info("Verified OTPs cleaned up", { deletedCount, daysOld });
      return deletedCount;
    } catch (error) {
      logger.error("Failed to cleanup verified OTPs", {
        error: error.message,
        daysOld,
      });
      throw error;
    }
  }
}

module.exports = new OtpService();

const crypto = require("crypto");
const { OtpVerification, User } = require("../models");
const logger = require("../utils/logger.util");
const encryptionService = require("./encryption.service");
const validationUtil = require("../utils/validation.util");
const { ValidationError } = require("../errors/validationError");
const { AuthError } = require("../errors/authError");
const { AppError } = require("../../../../shared/errors/AppError");
const securityConfig = require("../config/security.config");

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
   * Generate OTP code
   */
  generateOtpCode() {
    const min = Math.pow(10, this.otpLength - 1);
    const max = Math.pow(10, this.otpLength) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Calculate expiry time
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
   * Send OTP for registration
   */
  async sendRegistrationOtp(phoneNumber, countryCode, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(
        phoneNumber,
        countryCode
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // Check if phone number type is MOBILE
      if (phoneValidation.type !== "MOBILE") {
        throw new ValidationError("Phone number must be a mobile number");
      }

      // // Generate phone hash to search for hashed number
      const phoneHash = await encryptionService.hashData(formattedPhoneE164);

      // Check if phone number already exists
      const existingUser = await User.findByPhoneHash(phoneHash);
      if (existingUser) {
        throw AuthError.duplicatePhone(
          "Phone number already registered",
          formattedPhoneE164
        );
      }

      // Check rate limiting
      await this.checkRateLimit(formattedPhoneE164, "registration");

      // Generate OTP
      const verificationId = await this.generateUniqueVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, "0");
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      await OtpVerification.create({
        verification_id: verificationId,
        phone: formattedPhoneE164,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: "registration",
        ip_address: ipAddress,
        expires_at: expiresAt,
      });

      // IMPORTANT: Send SMS (mock implementation - replace with actual SMS service)
      await this.sendSms(formattedPhoneE164, otpCode, "registration");

      logger.info("Registration OTP sent", {
        verificationId,
        phone: formattedPhoneE164,
        expiresAt,
        ipAddress,
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        phone: formattedPhoneE164,
      };
    } catch (error) {
      logger.error("Failed to send registration OTP", {
        phone: phoneNumber,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Send OTP for login
   */
  async sendLoginOtp(phoneNumber, countryCode, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(
        phoneNumber,
        countryCode
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // Check if phone number type is MOBILE
      if (phoneValidation.type !== "MOBILE") {
        throw new ValidationError("Phone number must be a mobile number");
      }

      const phoneHash = await encryptionService.hashData(formattedPhoneE164);
      // Check if phone number is registered
      const existingUser = await User.findByPhoneHash(phoneHash);
      if (!existingUser) {
        throw AuthError.userNotFound("User not found");
      }

      // Check rate limiting
      await this.checkRateLimit(formattedPhoneE164, "login");

      // Generate OTP
      const verificationId = await this.generateUniqueVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, "0");
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      await OtpVerification.create({
        verification_id: verificationId,
        phone: formattedPhoneE164,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: "login",
        ip_address: ipAddress,
        expires_at: expiresAt,
      });

      // IMPORTANT: Send SMS (mock implementation - replace with actual SMS service)
      await this.sendSms(formattedPhoneE164, otpCode, "login");

      logger.info("Login OTP sent", {
        verificationId,
        phone: formattedPhoneE164,
        expiresAt,
        ipAddress,
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        phone: formattedPhoneE164,
      };
    } catch (error) {
      logger.error("Failed to send login OTP", {
        phone: phoneNumber,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Send OTP for password reset
   */
  async sendPasswordResetOtp(phoneNumber, countryCode, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(
        phoneNumber,
        countryCode
      );
      const formattedPhoneE164 = phoneValidation.e164;

      // Check if phone number type is MOBILE
      if (phoneValidation.type !== "MOBILE") {
        throw new ValidationError(
          "Phone number must be a correct mobile number"
        );
      }

      // Check rate limiting
      await this.checkRateLimit(formattedPhoneE164, "password_reset");

      // Generate OTP
      const verificationId = await this.generateUniqueVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, "0");
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      await OtpVerification.create({
        verification_id: verificationId,
        phone: formattedPhoneE164,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: "password_reset",
        ip_address: ipAddress,
        expires_at: expiresAt,
      });

      // IMPORTANT: Send SMS (mock implementation - replace with actual SMS service)
      await this.sendSms(formattedPhoneE164, otpCode, "password_reset");

      logger.info("Password reset OTP sent", {
        verificationId,
        phone: formattedPhoneE164,
        expiresAt,
        ipAddress,
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        phone: formattedPhoneE164,
      };
    } catch (error) {
      logger.error("Failed to send password reset OTP", {
        phone: phoneNumber,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Send OTP for phone number change
   */
  async sendPhoneChangeOtp(
    formattedPhoneE164,
    countryCode,
    userId,
    ipAddress = null
  ) {
    try {
      // Check rate limiting
      await this.checkRateLimit(formattedPhoneE164, "phone_number_change");

      // Generate OTP
      const verificationId = await this.generateUniqueVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, "0");
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      await OtpVerification.create({
        verification_id: verificationId,
        user_id: userId,
        phone: formattedPhoneE164,
        country_code: countryCode,
        otp_code: otpCode,
        otp_type: "phone_number_change",
        ip_address: ipAddress,
        expires_at: expiresAt,
      });

      // Send SMS
      await this.sendSms(formattedPhoneE164, otpCode, "phone_number_change");

      logger.info("Phone change OTP sent", {
        verificationId,
        phone: formattedPhoneE164,
        userId,
        expiresAt,
        ipAddress,
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        new_phone: formattedPhoneE164,
      };
    } catch (error) {
      logger.error("Failed to send phone change OTP", {
        formattedPhoneE164,
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(verificationId, otpCode, expectedPhone, countryCode) {
    try {
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
      if (!expectedPhone || !countryCode) {
        throw ValidationError.requiredField(
          "otp_code",
          "Expected phone number and country code are required"
        );
      }

      validationUtil.validateOTP(otpCode);

      // Find OTP record
      const otpRecord = await OtpVerification.findByVerificationId(
        verificationId
      );
      if (!otpRecord) {
        throw AuthError.invalidOTP("Invalid verification ID");
      }

      // Check if phone matches
      const phoneValidation = validationUtil.validatePhoneNumber(
        expectedPhone,
        countryCode
      );
      if (otpRecord.phone !== phoneValidation.e164) {
        throw AuthError.invalidOTP("Phone number mismatch");
      }

      // Check if OTP can be verified
      if (!otpRecord.canVerify()) {
        if (otpRecord.isVerified()) {
          throw AuthError.invalidOTP("OTP has already been used");
        }
        if (otpRecord.isExpired()) {
          throw AuthError.expiredOTP("OTP has expired");
        }
      }

      // Verify OTP code
      if (otpRecord.otp_code !== otpCode) {
        throw AuthError.invalidOTP("Invalid OTP code");
      }

      // Mark as verified
      await otpRecord.markAsVerified();

      logger.info("OTP verified successfully", {
        verificationId,
        phone: otpRecord.phone,
        otpType: otpRecord.otp_type,
        userId: otpRecord.user_id,
      });

      return {
        verified: true,
        phone: otpRecord.phone,
        otp_type: otpRecord.otp_type,
        user_id: otpRecord.user_id,
      };
    } catch (error) {
      logger.warn("OTP verification failed", {
        verificationId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Check rate limiting for OTP requests
   */
  async checkRateLimit(phone, otpType) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check recent OTP requests
    const recentOtps = await OtpVerification.count({
      where: {
        phone,
        otp_type: otpType,
        created_at: { [require("sequelize").Op.gte]: oneMinuteAgo },
      },
    });

    if (recentOtps >= 1) {
      throw AuthError.rateLimitExceeded(
        "Please wait before requesting another OTP",
        60
      );
    }

    // Check hourly limit
    const hourlyOtps = await OtpVerification.count({
      where: {
        phone,
        otp_type: otpType,
        created_at: { [require("sequelize").Op.gte]: oneHourAgo },
      },
    });

    if (hourlyOtps >= 5) {
      throw AuthError.rateLimitExceeded("Hourly OTP limit exceeded", 3600);
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

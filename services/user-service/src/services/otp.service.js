const crypto = require('crypto');
const { OtpVerification } = require('../models');
const logger = require('../utils/logger.util');
const validationUtil = require('../utils/validation.util');
const { ValidationError } = require('../errors/validationError');
const { AuthError } = require('../errors/authError');
const { AppError } = require('../errors/AppError');
const securityConfig = require('../config/security.config');

/**
 * OTP Service
 * Handles OTP generation, validation, and SMS integration
 */
class OtpService {
  constructor() {
    this.otpLength = securityConfig.app.otpLength;
    this.otpExpiryMinutes = securityConfig.app.otpExpiryMinutes;
    this.otpMaxAttempts = securityConfig.app.otpMaxAttempts;
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
   * Generate secure verification ID
   */
  generateVerificationId() {
    return crypto.randomUUID();
  }

  /**
   * Calculate expiry time
   */
  calculateExpiryTime() {
    const now = new Date();
    return new Date(now.getTime() + (this.otpExpiryMinutes * 60 * 1000));
  }

  /**
   * Send OTP for registration
   */
  async sendRegistrationOtp(phone, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(phone);
      const formattedPhone = phoneValidation.formatted;

      // Check rate limiting
      await this.checkRateLimit(formattedPhone, 'registration');

      // Generate OTP
      const verificationId = this.generateVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, '0');
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      const otpRecord = await OtpVerification.create({
        verification_id: verificationId,
        phone: formattedPhone,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: 'registration',
        ip_address: ipAddress,
        expires_at: expiresAt
      });

      // Send SMS (mock implementation - replace with actual SMS service)
      await this.sendSms(formattedPhone, otpCode, 'registration');

      logger.info('Registration OTP sent', {
        verificationId,
        phone: formattedPhone,
        expiresAt,
        ipAddress
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        phone: formattedPhone
      };
    } catch (error) {
      logger.error('Failed to send registration OTP', {
        phone,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send OTP for login
   */
  async sendLoginOtp(phone, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(phone);
      const formattedPhone = phoneValidation.formatted;

      // Check rate limiting
      await this.checkRateLimit(formattedPhone, 'login');

      // Generate OTP
      const verificationId = this.generateVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, '0');
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      const otpRecord = await OtpVerification.create({
        verification_id: verificationId,
        phone: formattedPhone,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: 'login',
        ip_address: ipAddress,
        expires_at: expiresAt
      });

      // Send SMS
      await this.sendSms(formattedPhone, otpCode, 'login');

      logger.info('Login OTP sent', {
        verificationId,
        phone: formattedPhone,
        expiresAt,
        ipAddress
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        phone: formattedPhone
      };
    } catch (error) {
      logger.error('Failed to send login OTP', {
        phone,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send OTP for password reset
   */
  async sendPasswordResetOtp(phone, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(phone);
      const formattedPhone = phoneValidation.formatted;

      // Check rate limiting
      await this.checkRateLimit(formattedPhone, 'password_reset');

      // Generate OTP
      const verificationId = this.generateVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, '0');
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      const otpRecord = await OtpVerification.create({
        verification_id: verificationId,
        phone: formattedPhone,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: 'password_reset',
        ip_address: ipAddress,
        expires_at: expiresAt
      });

      // Send SMS
      await this.sendSms(formattedPhone, otpCode, 'password_reset');

      logger.info('Password reset OTP sent', {
        verificationId,
        phone: formattedPhone,
        expiresAt,
        ipAddress
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        phone: formattedPhone
      };
    } catch (error) {
      logger.error('Failed to send password reset OTP', {
        phone,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send OTP for phone number change
   */
  async sendPhoneChangeOtp(newPhone, userId, ipAddress = null) {
    try {
      // Validate phone number
      const phoneValidation = validationUtil.validatePhoneNumber(newPhone);
      const formattedPhone = phoneValidation.formatted;

      // Check rate limiting
      await this.checkRateLimit(formattedPhone, 'phone_number_change');

      // Generate OTP
      const verificationId = this.generateVerificationId();
      const otpCode = this.generateOtpCode().toString().padStart(6, '0');
      const expiresAt = this.calculateExpiryTime();

      // Store OTP in database
      const otpRecord = await OtpVerification.create({
        verification_id: verificationId,
        user_id: userId,
        phone: formattedPhone,
        country_code: phoneValidation.countryCode,
        otp_code: otpCode,
        otp_type: 'phone_number_change',
        ip_address: ipAddress,
        expires_at: expiresAt
      });

      // Send SMS
      await this.sendSms(formattedPhone, otpCode, 'phone_number_change');

      logger.info('Phone change OTP sent', {
        verificationId,
        phone: formattedPhone,
        userId,
        expiresAt,
        ipAddress
      });

      return {
        verification_id: verificationId,
        expires_in: this.otpExpiryMinutes * 60,
        new_phone: formattedPhone
      };
    } catch (error) {
      logger.error('Failed to send phone change OTP', {
        newPhone,
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(verificationId, otpCode, expectedPhone = null) {
    try {
      // Validate inputs
      if (!verificationId || !otpCode) {
        throw ValidationError.requiredField('otp_code', 'Verification ID and OTP code are required');
      }

      validationUtil.validateOTP(otpCode);

      // Find OTP record
      const otpRecord = await OtpVerification.findByVerificationId(verificationId);
      if (!otpRecord) {
        throw AuthError.invalidOTP('Invalid verification ID');
      }

      // Check if phone matches (if provided)
      if (expectedPhone) {
        const phoneValidation = validationUtil.validatePhoneNumber(expectedPhone);
        if (otpRecord.phone !== phoneValidation.formatted) {
          throw AuthError.invalidOTP('Phone number mismatch');
        }
      }

      // Check if OTP can be verified
      if (!otpRecord.canVerify()) {
        if (otpRecord.is_verified) {
          throw AuthError.invalidOTP('OTP has already been used');
        }
        if (otpRecord.isExpired()) {
          throw AuthError.expiredOTP('OTP has expired');
        }
        if (otpRecord.isMaxAttemptsReached()) {
          throw AuthError.otpMaxAttempts('Maximum OTP attempts exceeded');
        }
      }

      // Verify OTP code
      if (otpRecord.otp_code !== otpCode) {
        await otpRecord.incrementAttempts();

        const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
        throw AuthError.invalidOTP(
          `Invalid OTP code. ${remainingAttempts} attempts remaining`,
          { attempts: otpRecord.attempts + 1 }
        );
      }

      // Mark as verified
      await otpRecord.markAsVerified();

      logger.info('OTP verified successfully', {
        verificationId,
        phone: otpRecord.phone,
        otpType: otpRecord.otp_type,
        userId: otpRecord.user_id
      });

      return {
        verified: true,
        phone: otpRecord.phone,
        otp_type: otpRecord.otp_type,
        user_id: otpRecord.user_id
      };
    } catch (error) {
      logger.warn('OTP verification failed', {
        verificationId,
        error: error.message
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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check recent OTP requests
    const recentOtps = await OtpVerification.count({
      where: {
        phone,
        otp_type: otpType,
        created_at: { [require('sequelize').Op.gte]: oneMinuteAgo }
      }
    });

    if (recentOtps >= 1) {
      throw AuthError.rateLimitExceeded('Please wait before requesting another OTP');
    }

    // Check hourly limit
    const hourlyOtps = await OtpVerification.count({
      where: {
        phone,
        otp_type: otpType,
        created_at: { [require('sequelize').Op.gte]: oneHourAgo }
      }
    });

    if (hourlyOtps >= 5) {
      throw AuthError.rateLimitExceeded('Hourly OTP limit exceeded');
    }

    // Check daily limit
    const dailyOtps = await OtpVerification.count({
      where: {
        phone,
        otp_type: otpType,
        created_at: { [require('sequelize').Op.gte]: oneDayAgo }
      }
    });

    if (dailyOtps >= 20) {
      throw AuthError.rateLimitExceeded('Daily OTP limit exceeded');
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
        phone_number_change: `Your Lianxin phone change code is: ${otpCode}. Valid for ${this.otpExpiryMinutes} minutes.`
      };

      const message = messages[type] || `Your Lianxin verification code is: ${otpCode}`;

      // Mock SMS sending
      logger.info('SMS sent (mock)', {
        phone,
        message,
        type
      });

      // In production, replace with actual SMS service call
      // const smsResult = await alibabaCloudSms.send(phone, message);

      return {
        success: true,
        phone,
        message_id: crypto.randomUUID()
      };
    } catch (error) {
      logger.error('SMS sending failed', {
        phone,
        type,
        error: error.message
      });
      throw new AppError('Failed to send SMS', 500, 'SMS_SEND_ERROR');
    }
  }

  /**
   * Cleanup expired OTPs
   */
  async cleanupExpiredOtps() {
    try {
      const deletedCount = await OtpVerification.cleanupExpired();
      logger.info('Expired OTPs cleaned up', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired OTPs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cleanup verified OTPs older than specified days
   */
  async cleanupVerifiedOtps(daysOld = 90) {
    try {
      const deletedCount = await OtpVerification.cleanupVerified(daysOld);
      logger.info('Verified OTPs cleaned up', { deletedCount, daysOld });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup verified OTPs', {
        error: error.message,
        daysOld
      });
      throw error;
    }
  }

  /**
   * Get OTP statistics
   */
  async getOtpStats(phone = null, timeframe = '24h') {
    try {
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const timeframeMs = timeframes[timeframe] || timeframes['24h'];
      const since = new Date(Date.now() - timeframeMs);

      const where = {
        created_at: { [require('sequelize').Op.gte]: since }
      };

      if (phone) {
        where.phone = phone;
      }

      const stats = await OtpVerification.findAll({
        where,
        attributes: [
          'otp_type',
          [require('sequelize').fn('COUNT', '*'), 'total'],
          [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN is_verified = true THEN 1 ELSE 0 END')), 'verified'],
          [require('sequelize').fn('SUM', require('sequelize').literal('CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END')), 'expired']
        ],
        group: ['otp_type'],
        raw: true
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get OTP statistics', {
        phone,
        timeframe,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new OtpService();
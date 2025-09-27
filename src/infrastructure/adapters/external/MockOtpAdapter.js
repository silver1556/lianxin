const OtpServicePort = require('../../../core/domain/user/ports/OtpServicePort');

/**
 * Mock OTP Adapter
 * Implements OtpServicePort for development/testing
 * Replace with real SMS service adapter in production
 */
class MockOtpAdapter extends OtpServicePort {
  constructor(cacheService, config) {
    super();
    this.cacheService = cacheService;
    this.config = config;
    this.otpLength = config.app.otpLength || 6;
    this.otpExpiryMinutes = config.app.otpExpiryMinutes || 5;
  }

  async sendOtp(phone, countryCode, type, userId = null) {
    // Check rate limits
    await this._checkRateLimit(phone, type);

    // Generate OTP
    const verificationId = this._generateVerificationId();
    const otpCode = this._generateOtpCode();
    const expiresAt = this._calculateExpiryTime();

    // Store in cache
    const otpData = {
      code: otpCode,
      phone: phone,
      type: type,
      userId: userId,
      expiresAt: expiresAt.toISOString()
    };

    await this.cacheService.set(
      `otp:${verificationId}`,
      otpData,
      this.otpExpiryMinutes * 60
    );

    // Mock SMS sending
    console.log(`[MOCK SMS] Sending OTP to ${countryCode}${phone}:`);
    console.log(`[MOCK SMS] Code: ${otpCode}`);
    console.log(`[MOCK SMS] Type: ${type}`);
    console.log(`[MOCK SMS] Expires: ${expiresAt.toISOString()}`);

    return {
      phone: `${countryCode}${phone}`,
      verification_id: verificationId,
      expires_in: this.otpExpiryMinutes * 60
    };
  }

  async verifyOtp(verificationId, otpCode, expectedPhoneHash) {
    // Get OTP data from cache
    const otpData = await this.cacheService.get(`otp:${verificationId}`);
    
    if (!otpData) {
      throw new Error('OTP not found or expired');
    }

    // Check expiry
    const expiresAt = new Date(otpData.expiresAt);
    if (new Date() > expiresAt) {
      throw new Error('OTP has expired');
    }

    // Verify code
    if (otpData.code !== otpCode) {
      throw new Error('Invalid OTP code');
    }

    // Mark as verified by deleting from cache
    await this.cacheService.del(`otp:${verificationId}`);

    return true;
  }

  async checkRateLimit(phone, type) {
    return await this._checkRateLimit(phone, type);
  }

  async cleanupExpired() {
    // In a real implementation, this would clean up expired OTPs
    // For mock adapter, we rely on Redis TTL
    return 0;
  }

  // Private helper methods
  _generateVerificationId() {
    return crypto.randomUUID();
  }

  _generateOtpCode() {
    const min = Math.pow(10, this.otpLength - 1);
    const max = Math.pow(10, this.otpLength) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _calculateExpiryTime() {
    const now = new Date();
    return new Date(now.getTime() + this.otpExpiryMinutes * 60 * 1000);
  }

  async _checkRateLimit(phone, type) {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Check minute limit
    const minuteKey = `otp:rate:minute:${phone}:${type}`;
    const minuteCount = await this.cacheService.get(minuteKey) || 0;
    
    if (minuteCount >= 1) {
      throw new Error('Please wait before requesting another OTP');
    }

    // Check hourly limit
    const hourKey = `otp:rate:hour:${phone}:${type}`;
    const hourCount = await this.cacheService.get(hourKey) || 0;
    
    if (hourCount >= 5) {
      throw new Error('Hourly OTP limit exceeded');
    }

    // Update counters
    await this.cacheService.set(minuteKey, minuteCount + 1, 60);
    await this.cacheService.set(hourKey, hourCount + 1, 3600);

    return true;
  }
}

module.exports = MockOtpAdapter;
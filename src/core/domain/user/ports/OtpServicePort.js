/**
 * OTP Service Port (Interface)
 * Defines the contract for OTP operations
 */
class OtpServicePort {
  /**
   * Generate and send OTP
   * @param {string} phone - Phone number
   * @param {string} countryCode - Country code
   * @param {string} type - OTP type
   * @param {number} userId - User ID (optional)
   * @returns {Promise<{verificationId: string, expiresIn: number}>}
   */
  async sendOtp(phone, countryCode, type, userId = null) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Verify OTP code
   * @param {string} verificationId - Verification ID
   * @param {string} otpCode - OTP code
   * @param {string} phoneHash - Expected phone hash
   * @returns {Promise<boolean>}
   */
  async verifyOtp(verificationId, otpCode, phoneHash) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Check rate limits for OTP
   * @param {string} phone - Phone number
   * @param {string} type - OTP type
   * @returns {Promise<boolean>}
   */
  async checkRateLimit(phone, type) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Cleanup expired OTPs
   * @returns {Promise<number>} Number of cleaned OTPs
   */
  async cleanupExpired() {
    throw new Error('Method must be implemented by adapter');
  }
}

module.exports = OtpServicePort;
/**
 * Phone Service Contract
 * Defines phone number operations interface
 */
class PhoneService {
  /**
   * Validate and parse phone number
   * @param {string} phoneNumber - Phone number
   * @param {string} countryCode - Country code
   * @returns {Object} Validation result
   */
  validatePhoneNumber(phoneNumber, countryCode) {
    throw new Error('Method must be implemented by concrete phone service');
  }

  /**
   * Format phone number for display
   * @param {string} phoneNumber - Phone number
   * @param {string} format - Format type
   * @returns {string}
   */
  formatForDisplay(phoneNumber, format = 'national') {
    throw new Error('Method must be implemented by concrete phone service');
  }

  /**
   * Mask phone number for privacy
   * @param {string} phoneNumber - Phone number
   * @returns {string}
   */
  maskPhoneNumber(phoneNumber) {
    throw new Error('Method must be implemented by concrete phone service');
  }

  /**
   * Get carrier information
   * @param {string} phoneNumber - Phone number
   * @returns {string|null}
   */
  getCarrierInfo(phoneNumber) {
    throw new Error('Method must be implemented by concrete phone service');
  }
}

module.exports = PhoneService;
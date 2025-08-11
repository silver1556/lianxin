const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { ValidationError } = require('../errors/validationError');
const logger = require('./logger.util');

/**
 * Phone Utility Class
 * Handles phone number validation, formatting, and Chinese-specific operations
 */
class PhoneUtil {
  constructor() {
    this.defaultCountryCode = '+86';
    this.supportedCountryCodes = ['+86', '+852', '+853', '+886'];

    // Chinese phone number patterns
    this.chinesePatterns = {
      mobile: /^1[3-9]\d{9}$/, // Chinese mobile numbers
    };

    // Country code to region mapping
    this.countryCodeMapping = {
      '+86': 'CN', // China
      '+852': 'HK', // Hong Kong
      '+853': 'MO', // Macau
      '+886': 'TW'  // Taiwan
    };
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phoneNumber, countryCode = null) {
    try {
      if (!phoneNumber) {
        throw ValidationError.requiredField('phone', 'Phone number is required');
      }

      // Clean the phone number
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);

      // Determine country code
      const finalCountryCode = countryCode || this.extractCountryCode(cleanPhone) || this.defaultCountryCode;

      // Format for validation
      const fullNumber = this.formatWithCountryCode(cleanPhone, finalCountryCode);

      // Parse and validate using libphonenumber-js
      const phoneNumberObj = parsePhoneNumberFromString(fullNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        throw ValidationError.invalidPhoneNumber(phoneNumber, 'Invalid phone number format');
      }

      // Additional validation for Chinese numbers
      if (finalCountryCode === '+86') {
        this.validateChinesePhoneNumber(phoneNumberObj.nationalNumber);
      }

      // Check if country code is supported
      if (!this.supportedCountryCodes.includes(finalCountryCode)) {
        throw ValidationError.custom(
          'phone',
          `Country code ${finalCountryCode} is not supported`,
          phoneNumber,
          'unsupported_country_code'
        );
      }

      const result = {
        isValid: true,
        formatted: phoneNumberObj.formatInternational(),
        national: phoneNumberObj.formatNational(),
        countryCode: phoneNumberObj.countryCallingCode,
        country: phoneNumberObj.country,
        type: phoneNumberObj.getType(),
        carrier: this.getCarrierInfo(phoneNumberObj.nationalNumber, finalCountryCode)
      };

      logger.debug('Phone number validated successfully', {
        original: phoneNumber,
        formatted: result.formatted,
        country: result.country
      });

      return result;

    } catch (error) {
      logger.warn('Phone number validation failed', {
        phoneNumber,
        error: error.message
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw ValidationError.invalidPhoneNumber(phoneNumber, 'Phone number validation failed');
    }
  }

  /**
   * Format phone number for storage
   */
  formatForStorage(phoneNumber, countryCode = null) {
    try {
      const validation = this.validatePhoneNumber(phoneNumber, countryCode);
      return validation.formatted;
    } catch (error) {
      logger.error('Failed to format phone number for storage', {
        phoneNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format phone number for display
   */
  formatForDisplay(phoneNumber, format = 'international') {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        return phoneNumber; // Return original if invalid
      }

      switch (format) {
        case 'national':
          return phoneNumberObj.formatNational();
        case 'international':
          return phoneNumberObj.formatInternational();
        case 'e164':
          return phoneNumberObj.format('E.164');
        case 'rfc3966':
          return phoneNumberObj.format('RFC3966');
        default:
          return phoneNumberObj.formatInternational();
      }
    } catch (error) {
      logger.warn('Failed to format phone number for display', {
        phoneNumber,
        format,
        error: error.message
      });
      return phoneNumber;
    }
  }

  /**
   * Clean phone number (remove spaces, dashes, parentheses)
   */
  cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    return phoneNumber
      .toString()
      .replace(/[\s\-\(\)\.]/g, '') // Remove spaces, dashes, parentheses, dots
      .replace(/^\+/, '') // Remove leading +
      .trim();
  }

  /**
   * Extract country code from phone number
   */
  extractCountryCode(phoneNumber) {
    const cleaned = this.cleanPhoneNumber(phoneNumber);

    // Check for Chinese country code patterns
    if (cleaned.startsWith('86')) {
      return '+86';
    }

    // Check for other supported country codes
    for (const code of this.supportedCountryCodes) {
      const numericCode = code.replace('+', '');
      if (cleaned.startsWith(numericCode)) {
        return code;
      }
    }

    return null;
  }

  /**
   * Format phone number with country code
   */
  formatWithCountryCode(phoneNumber, countryCode) {
    const cleaned = this.cleanPhoneNumber(phoneNumber);
    const numericCode = countryCode.replace('+', '');

    // If phone number already has country code, return as is
    if (cleaned.startsWith(numericCode)) {
      return `+${cleaned}`;
    }

    // Add country code
    return `${countryCode}${cleaned}`;
  }

  /**
   * Validate Chinese phone number specifically
   */
  validateChinesePhoneNumber(nationalNumber) {
    const numberStr = nationalNumber.toString();

    // Check if it's a valid Chinese mobile number
    if (!this.chinesePatterns.mobile.test(numberStr)) {
      throw ValidationError.custom(
        'phone',
        'Invalid Chinese mobile number format',
        nationalNumber,
        'invalid_chinese_mobile'
      );
    }

    // Additional checks for Chinese mobile numbers
    const firstDigit = numberStr.charAt(0);
    const secondDigit = numberStr.charAt(1);

    // Valid Chinese mobile prefixes
    const validPrefixes = ['13', '14', '15', '16', '17', '18', '19'];
    const prefix = firstDigit + secondDigit;

    if (!validPrefixes.includes(prefix)) {
      throw ValidationError.custom(
        'phone',
        'Invalid Chinese mobile number prefix',
        nationalNumber,
        'invalid_chinese_prefix'
      );
    }

    return true;
  }

  /**
   * Get carrier information for Chinese numbers
   */
  getCarrierInfo(nationalNumber, countryCode) {
    if (countryCode !== '+86') {
      return null;
    }

    const numberStr = nationalNumber.toString();
    const prefix = numberStr.substring(0, 3);

    // Chinese carrier mapping
    const carrierMapping = {
      // China Mobile
      134: 'China Mobile', 135: 'China Mobile', 136: 'China Mobile',
      137: 'China Mobile', 138: 'China Mobile', 139: 'China Mobile',
      147: 'China Mobile', 150: 'China Mobile', 151: 'China Mobile',
      152: 'China Mobile', 157: 'China Mobile', 158: 'China Mobile',
      159: 'China Mobile', 178: 'China Mobile', 182: 'China Mobile',
      183: 'China Mobile', 184: 'China Mobile', 187: 'China Mobile',
      188: 'China Mobile', 198: 'China Mobile',

      // China Unicom
      130: 'China Unicom', 131: 'China Unicom', 132: 'China Unicom',
      145: 'China Unicom', 155: 'China Unicom', 156: 'China Unicom',
      166: 'China Unicom', 175: 'China Unicom', 176: 'China Unicom',
      185: 'China Unicom', 186: 'China Unicom',

      // China Telecom
      133: 'China Telecom', 149: 'China Telecom', 153: 'China Telecom',
      173: 'China Telecom', 177: 'China Telecom', 180: 'China Telecom',
      181: 'China Telecom', 189: 'China Telecom', 199: 'China Telecom'
    };

    return carrierMapping[parseInt(prefix)] || 'Unknown';
  }

  /**
   * Generate phone number mask for privacy
   */
  maskPhoneNumber(phoneNumber) {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        return phoneNumber;
      }

      const national = phoneNumberObj.nationalNumber.toString();
      const countryCode = `+${phoneNumberObj.countryCallingCode}`;

      if (national.length >= 7) {
        const start = national.substring(0, 3);
        const end = national.substring(national.length - 2);
        const masked = start + '*'.repeat(national.length - 5) + end;
        return `${countryCode}-${masked}`;
      }

      return phoneNumber;
    } catch (error) {
      logger.warn('Failed to mask phone number', {
        phoneNumber,
        error: error.message
      });
      return phoneNumber;
    }
  }

  /**
   * Check if phone number is Chinese
   */
  isChinesePhoneNumber(phoneNumber) {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);
      return phoneNumberObj && phoneNumberObj.country === 'CN';
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert phone number to E.164 format
   */
  toE164(phoneNumber) {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        throw new Error('Invalid phone number');
      }

      return phoneNumberObj.format('E.164');
    } catch (error) {
      logger.warn('Failed to convert to E.164 format', {
        phoneNumber,
        error: error.message
      });
      throw ValidationError.invalidPhoneNumber(phoneNumber, 'Cannot convert to E.164 format');
    }
  }

  /**
   * Parse phone number components
   */
  parsePhoneComponents(phoneNumber) {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        throw ValidationError.invalidPhoneNumber(phoneNumber, 'Invalid phone number');
      }

      return {
        countryCode: phoneNumberObj.countryCallingCode,
        nationalNumber: phoneNumberObj.nationalNumber,
        country: phoneNumberObj.country,
        type: phoneNumberObj.getType(),
        international: phoneNumberObj.formatInternational(),
        national: phoneNumberObj.formatNational(),
        e164: phoneNumberObj.format('E.164'),
        uri: phoneNumberObj.getURI()
      };
    } catch (error) {
      logger.error('Failed to parse phone number components', {
        phoneNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate phone number variations for search
   */
  generateSearchVariations(phoneNumber) {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        return [phoneNumber];
      }

      const variations = [
        phoneNumberObj.format('E.164'),
        phoneNumberObj.formatInternational(),
        phoneNumberObj.formatNational(),
        phoneNumberObj.nationalNumber.toString(),
        this.cleanPhoneNumber(phoneNumber)
      ];

      // Remove duplicates
      return [...new Set(variations)];
    } catch (error) {
      logger.warn('Failed to generate search variations', {
        phoneNumber,
        error: error.message
      });
      return [phoneNumber];
    }
  }

  /**
   * Validate phone number for SMS
   */
  validateForSMS(phoneNumber) {
    try {
      const validation = this.validatePhoneNumber(phoneNumber);

      // Check if it's a mobile number
      if (validation.type !== 'MOBILE') {
        throw ValidationError.custom(
          'phone',
          'SMS can only be sent to mobile numbers',
          phoneNumber,
          'not_mobile'
        );
      }

      return validation;
    } catch (error) {
      logger.warn('SMS validation failed', {
        phoneNumber,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if phone number is from supported region
   */
  isSupportedRegion(phoneNumber) {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        return false;
      }

      const countryCode = `+${phoneNumberObj.countryCallingCode}`;
      return this.supportedCountryCodes.includes(countryCode);
    } catch (error) {
      return false;
    }
  }

  /**
   * Format phone number for database storage
   */
  formatForDatabase(phoneNumber, countryCode = null) {
    try {
      const validation = this.validatePhoneNumber(phoneNumber, countryCode);

      // Store in E.164 format for consistency
      return this.toE164(validation.formatted);
    } catch (error) {
      logger.error('Failed to format phone number for database', {
        phoneNumber,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PhoneUtil();
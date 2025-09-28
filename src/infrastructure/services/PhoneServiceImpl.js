const { parsePhoneNumberFromString } = require('libphonenumber-js/max');
const PhoneService = require('../../core/domain/user/contracts/PhoneService');

/**
 * Phone Service Implementation
 * Implements PhoneService contract using libphonenumber-js
 */
class PhoneServiceImpl extends PhoneService {
  constructor(config) {
    super();
    this.supportedCountryCodes = ['+86', '+852', '+853', '+886'];
    this.chinesePatterns = {
      mobile: /^1[3-9]\d{9}$/
    };
  }

  validatePhoneNumber(phoneNumber, countryCode) {
    // Validate inputs
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    if (!countryCode) {
      throw new Error('Country code is required');
    }

    if (!this.supportedCountryCodes.includes(countryCode)) {
      throw new Error(`Country code ${countryCode} is not supported`);
    }

    // Format for validation
    const fullNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

    // Parse using libphonenumber-js
    const phoneNumberObj = parsePhoneNumberFromString(fullNumber);

    if (!phoneNumberObj || !phoneNumberObj.isValid()) {
      throw new Error('Invalid phone number format');
    }

    if (phoneNumberObj.getType() !== 'MOBILE') {
      throw new Error('Must be a mobile number');
    }

    // Additional validation for Chinese numbers
    if (countryCode === '+86') {
      this._validateChinesePhoneNumber(phoneNumberObj.nationalNumber);
    }

    return {
      isValid: true,
      formatted: phoneNumberObj.formatInternational(),
      e164: phoneNumberObj.format('E.164'),
      national: phoneNumberObj.formatNational(),
      countryCode: `+${phoneNumberObj.countryCallingCode}`,
      country: phoneNumberObj.country,
      type: phoneNumberObj.getType(),
      carrier: this.getCarrierInfo(phoneNumberObj.nationalNumber.toString())
    };
  }

  formatForDisplay(phoneNumber, format = 'national') {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        return phoneNumber;
      }

      switch (format) {
        case 'national':
          return phoneNumberObj.formatNational();
        case 'international':
          return phoneNumberObj.formatInternational();
        case 'e164':
          return phoneNumberObj.format('E.164');
        default:
          return phoneNumberObj.formatNational();
      }
    } catch (error) {
      return phoneNumber;
    }
  }

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
      return phoneNumber;
    }
  }

  getCarrierInfo(nationalNumber) {
    const prefix = nationalNumber.substring(0, 3);
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

  // Private helper methods
  _validateChinesePhoneNumber(nationalNumber) {
    const numberStr = nationalNumber.toString();

    if (numberStr.length !== 11) {
      throw new Error('Chinese mobile numbers must be 11 digits long');
    }

    if (!this.chinesePatterns.mobile.test(numberStr)) {
      throw new Error('Invalid Chinese mobile number format');
    }

    return true;
  }
}

module.exports = PhoneServiceImpl;
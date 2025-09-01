const { parsePhoneNumberFromString } = require("libphonenumber-js/max");
const { ValidationError } = require("../errors/validationError");
const logger = require("./logger.util");

/**
 * Phone Utility Class
 * Handles phone number validation, formatting, and Chinese-specific operations
 */
class PhoneUtil {
  constructor() {
    this.supportedCountryCodes = ["+86", "+852", "+853", "+886"];

    // Chinese phone number patterns
    this.chinesePatterns = {
      mobile: /^1[3-9]\d{9}$/, // Chinese mobile numbers
    };
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phoneNumber, countryCode) {
    try {
      if (!phoneNumber) {
        throw ValidationError.requiredField(
          "phone",
          "Phone number is required"
        );
      }
      if (!countryCode) {
        throw ValidationError.requiredField(
          "phone",
          "Country code is required"
        );
      }

      if (!this.supportedCountryCodes.includes(countryCode)) {
        throw ValidationError.custom(
          "phone",
          `Country code ${countryCode} is not supported`,
          phoneNumber,
          "unsupported_country_code"
        );
      }

      // Format for validation
      const fullNumber = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;

      // Parse and validate using libphonenumber-js
      const phoneNumberObj = parsePhoneNumberFromString(fullNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        throw ValidationError.invalidPhoneNumber(
          phoneNumber,
          "Invalid phone number format"
        );
      }

      // Additional validation for Chinese numbers
      if (countryCode === "+86") {
        this.validateChinesePhoneNumber(phoneNumberObj.nationalNumber);
      }

      const result = {
        isValid: true,
        formatted: phoneNumberObj.formatInternational(), //+86 138 0013 8000
        e164: phoneNumberObj.format("E.164"), //+8613800138000
        national: phoneNumberObj.formatNational(), //138 0013 8000
        countryCode: `+${phoneNumberObj.countryCallingCode}`, //+86
        country: phoneNumberObj.country,
        type: phoneNumberObj.getType(), // MOBILE, LANDLINE, etc.
        carrier: this.getCarrierInfo(
          phoneNumberObj.nationalNumber,
          countryCode
        ),
      };
      return result;
    } catch (error) {
      logger.warn("Phone number validation failed", {
        phoneNumber,
        error: error.message,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw ValidationError.invalidPhoneNumber(
        phoneNumber,
        "Phone number validation failed"
      );
    }
  }

  /**
   * Format phone number for display
   */
  formatForDisplay(phoneNumber, format = "national") {
    try {
      const phoneNumberObj = parsePhoneNumberFromString(phoneNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        return phoneNumber; // Return original if invalid
      }

      switch (format) {
        case "national":
          return phoneNumberObj.formatNational();
        case "international":
          return phoneNumberObj.formatInternational();
        case "e164":
          return phoneNumberObj.format("E.164");
        case "rfc3966":
          return phoneNumberObj.format("RFC3966");
        default:
          return phoneNumberObj.formatNational();
      }
    } catch (error) {
      logger.warn("Failed to format phone number for display", {
        phoneNumber,
        format,
        error: error.message,
      });
      return phoneNumber;
    }
  }

  /**
   * Validate Chinese phone number specifically
   */
  validateChinesePhoneNumber(nationalNumber) {
    const numberStr = nationalNumber.toString();

    // Check if it's a valid Chinese mobile number
    if (!this.chinesePatterns.mobile.test(numberStr)) {
      throw ValidationError.custom(
        "phone",
        "Invalid Chinese mobile number format",
        nationalNumber,
        "invalid_chinese_mobile"
      );
    }
    return true;
  }

  /**
   * Get carrier information for Chinese numbers
   */
  getCarrierInfo(nationalNumber, countryCode) {
    if (countryCode !== "+86") {
      return null;
    }

    const prefix = nationalNumber.toString().substring(0, 3);

    // Chinese carrier mapping
    const carrierMapping = {
      // China Mobile
      134: "China Mobile",
      135: "China Mobile",
      136: "China Mobile",
      137: "China Mobile",
      138: "China Mobile",
      139: "China Mobile",
      147: "China Mobile",
      150: "China Mobile",
      151: "China Mobile",
      152: "China Mobile",
      157: "China Mobile",
      158: "China Mobile",
      159: "China Mobile",
      178: "China Mobile",
      182: "China Mobile",
      183: "China Mobile",
      184: "China Mobile",
      187: "China Mobile",
      188: "China Mobile",
      198: "China Mobile",

      // China Unicom
      130: "China Unicom",
      131: "China Unicom",
      132: "China Unicom",
      145: "China Unicom",
      155: "China Unicom",
      156: "China Unicom",
      166: "China Unicom",
      175: "China Unicom",
      176: "China Unicom",
      185: "China Unicom",
      186: "China Unicom",

      // China Telecom
      133: "China Telecom",
      149: "China Telecom",
      153: "China Telecom",
      173: "China Telecom",
      177: "China Telecom",
      180: "China Telecom",
      181: "China Telecom",
      189: "China Telecom",
      199: "China Telecom",
    };

    return carrierMapping[parseInt(prefix)] || "Unknown";
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
        const masked = start + "*".repeat(national.length - 5) + end;
        return `${countryCode}-${masked}`;
      }

      return phoneNumber;
    } catch (error) {
      logger.warn("Failed to mask phone number", {
        phoneNumber,
        error: error.message,
      });
      return phoneNumber;
    }
  }
}

module.exports = new PhoneUtil();

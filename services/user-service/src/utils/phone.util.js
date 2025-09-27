const { parsePhoneNumberFromString } = require("libphonenumber-js/max");
const ValidationError = require("../../../../shared/errors/validationError");
const logger = require("../../../../shared/utils/logger.util");

/**
 * Phone Utility Class
 * Handles phone number validation, formatting, and China-specific operations
 */
class PhoneUtil {
  constructor() {
    this.supportedCountryCodes = ["+86", "+852", "+853", "+886"];

    // Chinese phone number patterns
    this.chinesePatterns = {
      mobile: /^1[3-9]\d{9}$/, // Chinese mobile numbers
    };

    this.errorFields = {
      PHONE: "phone",
    };
  }

  /**
   * Validate and parse a phone number against supported country rules.
   *
   * @param {string} phoneNumber - Raw phone number input without the country code.
   *   Example: `"13800138000"`.
   * @param {string} countryCode - Country dialing code (must include `+`).
   *   Example: `"+86"`.
   *   Supported : ["+86", "+852", "+853", "+886"].
   *
   * @returns {Object} Parsed and validated phone number details:
   *   - {boolean} isValid - `true` if validation passes.
   *   - {string} formatted - Formatted in international style (e.g., `"+86 138 0013 8000"`).
   *   - {string} e164 - E.164 format for storage/communication (e.g., `"+8613800138000"`).
   *   - {string} national - Local/national format (e.g., `"138 0013 8000"`).
   *   - {string} countryCode - Country dialing code (e.g., `"+86"`).
   *   - {string} country - ISO 2-letter country code (e.g., `"CN"`).
   *   - {string} type - Phone type (e.g., `"MOBILE"`, `"FIXED_LINE"`).
   *   - {string|null} carrier - Carrier info if available, otherwise `null`.
   *
   * @throws {ValidationError}
   *   - If `phoneNumber` or `countryCode` is missing.
   *   - If the country code is unsupported.
   *   - If parsing or validation fails.
   *   - If country code is "+86", but invalid chinese number
   */
  validatePhoneNumber(phoneNumber, countryCode) {
    try {
      // Validate input parameters
      this.validateInputParameters(phoneNumber, countryCode);

      // Format for validation
      const fullNumber = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;

      // Parse and validate using libphonenumber-js
      const phoneNumberObj = parsePhoneNumberFromString(fullNumber);

      if (!phoneNumberObj || !phoneNumberObj.isValid()) {
        throw ValidationError.invalidPhoneNumber(
          this.errorFields.PHONE,
          phoneNumber,
          "Invalid phone number format"
        );
      }

      if (phoneNumberObj.getType() !== "MOBILE") {
        throw ValidationError.invalidPhoneNumber(
          this.errorFields.PHONE,
          phoneNumber,
          "Must be a mobile number"
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
      // Re-throw ValidationError as is
      if (error instanceof ValidationError) {
        throw error;
      }

      throw ValidationError.invalidPhoneNumber(
        this.errorFields.PHONE,
        phoneNumber,
        "Phone number validation failed"
      );
    }
  }

  /**
   * Validate input parameters separately for better error handling
   */
  validateInputParameters(phoneNumber, countryCode) {
    if (!phoneNumber) {
      throw ValidationError.requiredField(
        this.errorFields.PHONE,
        "Phone number is required"
      );
    }

    if (!countryCode) {
      throw ValidationError.requiredField(
        this.errorFields.PHONE,
        "Country code is required"
      );
    }

    if (typeof phoneNumber !== "string") {
      throw ValidationError.invalidType(
        this.errorFields.PHONE,
        phoneNumber,
        "string"
      );
    }

    if (typeof countryCode !== "string") {
      throw ValidationError.invalidType(
        this.errorFields.PHONE,
        countryCode,
        "string"
      );
    }

    if (!this.supportedCountryCodes.includes(countryCode)) {
      throw ValidationError.custom(
        this.errorFields.PHONE,
        `Country code ${countryCode} is not supported.`,
        countryCode,
        "unsupported_country_code"
      );
    }

    // Basic format validation for phone number (digits only)
    if (!/^\d+$/.test(phoneNumber.replace(/\s/g, ""))) {
      throw ValidationError.invalidFormat(
        this.errorFields.PHONE,
        phoneNumber,
        "numeric characters only"
      );
    }
  }

  /**
   * Format phone number for display
   */
  formatForDisplay(phoneNumber, format = "national") {
    try {
      if (!phoneNumber) {
        return phoneNumber;
      }

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
   * Validate a Chinese mobile phone number.
   *
   * @param {string|number} nationalNumber - The national part of the phone number (without country code).
   * @throws {ValidationError} If the number does not match the Chinese mobile format.
   * @returns {boolean} Returns `true` if the number is valid.
   */

  validateChinesePhoneNumber(nationalNumber) {
    const numberStr = nationalNumber.toString();

    // Check length first for better error messaging
    if (numberStr.length !== 11) {
      throw ValidationError.custom(
        this.errorFields.PHONE,
        "Chinese mobile numbers must be 11 digits long",
        nationalNumber,
        "invalid_length"
      );
    }

    if (!this.chinesePatterns.mobile.test(numberStr)) {
      throw ValidationError.custom(
        this.errorFields.PHONE,
        "Invalid Chinese mobile number format. Must start with 1 and have valid prefix (3-9)",
        nationalNumber,
        "invalid_chinese_mobile"
      );
    }
    return true;
  }

  /**
   * Get carrier information for Chinese mobile phone numbers.
   *
   * @param {string|number} nationalNumber - The national part of the phone number(without country code).
   * Example: `"13800138000"`.
   * @param {string} countryCode - Country code.
   * Example: `"+86"`.
   * @returns {string|null} - The carrier name if recognized:
   *   - `"China Mobile"`
   *   - `"China Telecom"`
   *   - `"Unknown"` if the prefix is unrecognized
   *   - `null` if the `countryCode` is not `+86`
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
      if (!phoneNumber) {
        return phoneNumber;
      }

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

  /**
   * Check if a country code is supported
   */
  isCountryCodeSupported(countryCode) {
    return this.supportedCountryCodes.includes(countryCode);
  }

  /**
   * Get all supported country codes
   */
  getSupportedCountryCodes() {
    return [...this.supportedCountryCodes];
  }
}

module.exports = new PhoneUtil();

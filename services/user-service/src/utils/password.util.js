const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const securityConfig = require("../config/security.config");
const logger = require("../../../../shared/utils/logger.util");
const ValidationError = require("../../../../shared/errors/validationError");

/**
 * Password Utility Class
 * Handles password hashing, validation, and security operations
 */
class PasswordUtil {
  constructor() {
    this.saltRounds = securityConfig.password.saltRounds;
    this.minLength = securityConfig.password.minLength;
    this.maxLength = securityConfig.password.maxLength;
    this.requireUppercase = securityConfig.password.requireUppercase;
    this.requireLowercase = securityConfig.password.requireLowercase;
    this.requireNumbers = securityConfig.password.requireNumbers;
    this.requireSpecialChars = securityConfig.password.requireSpecialChars;
    this.entropyMinimum = securityConfig.password.entropyMinimum;
    this.historyCount = securityConfig.password.historyCount;
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    try {
      // Validate password before hashing
      this.validatePassword(password);

      const salt = await bcrypt.genSalt(this.saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);

      logger.debug("Password hashed successfully", {
        saltRounds: this.saltRounds,
        hashedLength: hashedPassword.length,
      });

      return hashedPassword;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new Error("Failed to hash password");
    }
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }

      const isMatch = await bcrypt.compare(password, hash);

      logger.debug("Password comparison completed", {
        isMatch,
        hashLength: hash.length,
      });

      return isMatch;
    } catch (error) {
      logger.error("Failed to compare password", {
        error: error.message,
      });

      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password) {
    if (!password) {
      throw ValidationError.requiredField("password");
    }

    if (typeof password !== "string") {
      throw ValidationError.invalidType("password", password, "string");
    }

    if (password.length < this.minLength) {
      throw ValidationError.stringTooShort(
        "password",
        password,
        this.minLength
      );
    }

    if (password.length > this.maxLength) {
      throw ValidationError.stringTooLong("password", password, this.maxLength);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      throw ValidationError.patternMismatch(
        "password",
        password,
        "uppercase letter",
        "Password must contain at least one uppercase letter"
      );
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      throw ValidationError.patternMismatch(
        "password",
        password,
        "lowercase letter",
        "Password must contain at least one lowercase letter"
      );
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      throw ValidationError.patternMismatch(
        "password",
        password,
        "number",
        "Password must contain at least one number"
      );
    }

    if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw ValidationError.patternMismatch(
        "password",
        password,
        "special character",
        "Password must contain at least one special character"
      );
    }

    // Check for common patterns
    if (this.hasCommonPatterns(password)) {
      throw ValidationError.custom(
        "password",
        "Password contains common patterns and is not secure",
        password,
        "common_pattern"
      );
    }

    // Check password entropy
    const entropy = this.calculateEntropy(password);
    if (entropy < this.entropyMinimum) {
      throw ValidationError.custom(
        "password",
        `Password is too predictable. Entropy: ${entropy.toFixed(
          2
        )}, minimum required: ${this.entropyMinimum}`,
        entropy,
        "entropy"
      );
    }

    return true; // valid
  }

  /**
   * Calculate password entropy
   */
  calculateEntropy(password) {
    if (!password) return 0;

    const charset = this.getCharsetSize(password);
    return password.length * Math.log2(charset);
  }

  /**
   * Get character set size
   */
  getCharsetSize(password) {
    let charsetSize = 0;

    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 22;
    if (/[^a-zA-Z0-9!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 10;

    return charsetSize;
  }

  /**
   * Check for common password patterns
   */
  hasCommonPatterns(password) {
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /welcome/i,
      /login/i,
      /master/i,
      /secret/i,
      /(\w)\1{2,}/, // Repeated characters
      /012345/,
      /987654/,
      /111111/,
      /000000/,
      /121212/,
      /(\d)\1{4,}/, // 4 Repeated digits
      /^[a-zA-Z]+$/, // Only letters
      /^[0-9]+$/, // Only numbers
      /^(.)\1*$/, // All same character
    ];

    return commonPatterns.some((pattern) => pattern.test(password));
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length = 12) {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = '!@#$%^&*(),.?":{}|<>';

    let charset = "";
    let password = "";

    // Ensure at least one character from each required set
    if (this.requireUppercase) {
      charset += uppercase;
      password += uppercase[crypto.randomInt(uppercase.length)];
    }

    if (this.requireLowercase) {
      charset += lowercase;
      password += lowercase[crypto.randomInt(lowercase.length)];
    }

    if (this.requireNumbers) {
      charset += numbers;
      password += numbers[crypto.randomInt(numbers.length)];
    }

    if (this.requireSpecialChars) {
      charset += symbols;
      password += symbols[crypto.randomInt(symbols.length)];
    }

    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
      password += charset[crypto.randomInt(charset.length)];
    }

    // Shuffle the password
    return this.shuffleString(password);
  }

  /**
   * Shuffle string characters
   */
  shuffleString(str) {
    const array = str.split("");
    for (let i = array.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join("");
  }

  /**
   * Generate password reset token
   */
  generateResetToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Hash password reset token
   */
  hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generate secure temporary password
   */
  generateTemporaryPassword(length = 8) {
    const password = this.generateSecurePassword(length);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      password,
      expiry,
      isTemporary: true,
    };
  }

  /**
   * Validate password complexity score
   */
  getPasswordComplexityScore(password) {
    let score = 0;

    // Length score
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety score
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    // Pattern penalties
    if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
    if (/123456|654321|qwerty|password/i.test(password)) score -= 2; // Common patterns

    return Math.max(0, score);
  }

  /**
   * Get password strength description
   */
  getPasswordStrength(password) {
    const score = this.getPasswordComplexityScore(password);
    const entropy = this.calculateEntropy(password);

    let strength = "Very Weak";
    if (score >= 6 && entropy >= 40) strength = "Strong";
    else if (score >= 4 && entropy >= 30) strength = "Moderate";
    else if (score >= 2 && entropy >= 20) strength = "Weak";

    return {
      strength,
      score,
      entropy,
      requirements: {
        length: password.length >= this.minLength,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        specialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        noCommonPatterns: !this.hasCommonPatterns(password),
      },
    };
  }

  /**
   * Generate password salt
   */
  async generateSalt(rounds = null) {
    const saltRounds = rounds || this.saltRounds;
    return await bcrypt.genSalt(saltRounds);
  }

  /**
   * Hash with custom salt
   */
  async hashWithSalt(password, salt) {
    return await bcrypt.hash(password, salt);
  }

  /**
   * Constant time comparison
   */
  constantTimeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

module.exports = new PasswordUtil();

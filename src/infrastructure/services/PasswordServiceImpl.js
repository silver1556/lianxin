const bcrypt = require('bcryptjs');
const PasswordService = require('../../core/domain/user/contracts/PasswordService');

/**
 * Password Service Implementation
 * Implements PasswordService contract using bcrypt
 */
class PasswordServiceImpl extends PasswordService {
  constructor(config) {
    super();
    this.saltRounds = config.password?.saltRounds || 12;
    this.minLength = config.password?.minLength || 8;
    this.maxLength = config.password?.maxLength || 128;
    this.requireUppercase = config.password?.requireUppercase !== false;
    this.requireLowercase = config.password?.requireLowercase !== false;
    this.requireNumbers = config.password?.requireNumbers !== false;
    this.requireSpecialChars = config.password?.requireSpecialChars !== false;
    this.entropyMinimum = config.password?.entropyMinimum || 40;
  }

  async hashPassword(password) {
    this.validatePassword(password);
    return await bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password, hash) {
    if (!password || !hash) {
      return false;
    }
    return await bcrypt.compare(password, hash);
  }

  validatePassword(password) {
    if (!password) {
      throw new Error('Password is required');
    }

    if (typeof password !== 'string') {
      throw new Error('Password must be a string');
    }

    if (password.length < this.minLength) {
      throw new Error(`Password must be at least ${this.minLength} characters long`);
    }

    if (password.length > this.maxLength) {
      throw new Error(`Password must not exceed ${this.maxLength} characters`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }

    // Check for common patterns
    if (this._hasCommonPatterns(password)) {
      throw new Error('Password contains common patterns and is not secure');
    }

    // Check entropy
    const entropy = this._calculateEntropy(password);
    if (entropy < this.entropyMinimum) {
      throw new Error(`Password is too predictable. Entropy: ${entropy.toFixed(2)}, minimum required: ${this.entropyMinimum}`);
    }

    return true;
  }

  generateSecurePassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*(),.?":{}|<>';

    let charset = '';
    let password = '';

    // Ensure at least one character from each required set
    if (this.requireUppercase) {
      charset += uppercase;
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
    }

    if (this.requireLowercase) {
      charset += lowercase;
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
    }

    if (this.requireNumbers) {
      charset += numbers;
      password += numbers[Math.floor(Math.random() * numbers.length)];
    }

    if (this.requireSpecialChars) {
      charset += symbols;
      password += symbols[Math.floor(Math.random() * symbols.length)];
    }

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle password
    return this._shuffleString(password);
  }

  async isPasswordInHistory(password, passwordHistory) {
    for (const entry of passwordHistory || []) {
      if (await bcrypt.compare(password, entry.hash)) {
        return true;
      }
    }
    return false;
  }

  // Private helper methods
  _hasCommonPatterns(password) {
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /(\w)\1{2,}/, // Repeated characters
      /012345/,
      /987654/,
      /111111/,
      /000000/
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }

  _calculateEntropy(password) {
    if (!password) return 0;

    const charset = this._getCharsetSize(password);
    return password.length * Math.log2(charset);
  }

  _getCharsetSize(password) {
    let charsetSize = 0;

    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 22;
    if (/[^a-zA-Z0-9!@#$%^&*(),.?":{}|<>]/.test(password)) charsetSize += 10;

    return charsetSize;
  }

  _shuffleString(str) {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
  }
}

module.exports = PasswordServiceImpl;
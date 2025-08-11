const { AppError } = require('./AppError');

/**
 * Validation Error Class
 * Handles validation failure errors with detailed field information
 */
class ValidationError extends AppError {
  constructor(message, details = null, field = null) {
    super(message, 400, 'VALIDATION_ERROR', details);

    this.name = 'ValidationError';
    this.field = field;
    this.validationErrors = [];
  }

  /**
   * Add a validation error for a specific field
   */
  addFieldError(field, message, value = null, constraint = null) {
    this.validationErrors.push({
      field,
      message,
      value,
      constraint,
      timestamp: new Date().toISOString()
    });

    return this;
  }

  /**
   * Add multiple validation errors
   */
  addFieldErrors(errors) {
    if (Array.isArray(errors)) {
      errors.forEach(error => {
        this.addFieldError(
          error.field,
          error.message,
          error.value,
          error.constraint
        );
      });
    }

    return this;
  }

  /**
   * Check if there are validation errors
   */
  hasErrors() {
    return this.validationErrors.length > 0;
  }

  /**
   * Get validation errors for a specific field
   */
  getFieldErrors(field) {
    return this.validationErrors.filter(error => error.field === field);
  }

  /**
   * Get all validation errors
   */
  getAllErrors() {
    return this.validationErrors;
  }

  /**
   * Convert to JSON format
   */
  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      validationErrors: this.validationErrors,
      errorCount: this.validationErrors.length
    };
  }

  /**
   * Static method to create a required field error
   */
  static requiredField(field, message = `${field} is required`) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, null, 'required');
  }

  /**
   * Static method to create an invalid format error
   */
  static invalidFormat(field, message = `${field} has invalid format`, value = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, 'format');
  }

  /**
   * Static method to create a length validation error
   */
  static invalidLength(field, message, value = null, constraint = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, constraint);
  }

  /**
   * Static method to create a pattern validation error
   */
  static invalidPattern(field, message = `${field} does not match required pattern`, value = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, 'pattern');
  }

  /**
   * Static method to create a unique constraint error
   */
  static duplicateValue(field, message = `${field} already exists`, value = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, 'unique');
  }

  /**
   * Static method to create a range validation error
   */
  static outOfRange(field, message = `${field} is out of valid range`, value = null, constraint = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, constraint);
  }

  /**
   * Static method to create a type validation error
   */
  static invalidType(field, message = `${field} has invalid type`, value = null, expectedType = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, `expected_type:${expectedType}`);
  }

  /**
   * Static method to create a custom validation error
   */
  static custom(field, message, value = null, constraint = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, constraint);
  }

  /**
   * Static method to create multiple field errors
   */
  static multipleFields(message, fieldErrors) {
    const error = new ValidationError(message);
    error.addFieldErrors(fieldErrors);
    return error;
  }

  /**
   * Static method to create phone number validation error
   */
  static invalidPhoneNumber(phone, message = 'Invalid phone number format') {
    return new ValidationError(message, null, 'phone')
      .addFieldError('phone', message, phone, 'phone_format');
  }

  /**
   * Static method to create password validation error
   */
  static invalidPassword(message = 'Password does not meet security requirements') {
    return new ValidationError(message, null, 'password')
      .addFieldError('password', message, null, 'password_strength');
  }

  /**
   * Static method to create OTP validation error
   */
  static invalidOTP(message = 'Invalid or expired OTP') {
    return new ValidationError(message, null, 'otp_code')
      .addFieldError('otp_code', message, null, 'otp_validation');
  }

  /**
   * Static method to create email validation error
   */
  static invalidEmail(email, message = 'Invalid email address format') {
    return new ValidationError(message, null, 'email')
      .addFieldError('email', message, email, 'email_format');
  }

  /**
   * Static method to create date validation error
   */
  static invalidDate(field, message = `${field} is not a valid date`, value = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, 'date_format');
  }

  /**
   * Static method to create age validation error
   */
  static invalidAge(message = 'Age must be between 13 and 120 years', age = null) {
    return new ValidationError(message, null, 'birth_date')
      .addFieldError('birth_date', message, age, 'age_range');
  }

  /**
   * Static method to create file validation error
   */
  static invalidFile(field, message, fileName = null, constraint = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, fileName, constraint);
  }

  /**
   * Static method to create JSON validation error
   */
  static invalidJSON(field, message = `${field} contains invalid JSON`, value = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, 'json_format');
  }

  /**
   * Static method to create enum validation error
   */
  static invalidEnum(field, message, value = null, allowedValues = null) {
    return new ValidationError(message, null, field)
      .addFieldError(field, message, value, `enum:${allowedValues}`);
  }
}

module.exports = { ValidationError };
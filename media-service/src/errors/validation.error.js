const { AppError } = require("../../../../shared/errors/appError");

/**
 * Validation Error Class
 * Handles validation failure errors with detailed field information
 */
class ValidationError extends AppError {
  constructor(message, details = null, field = null) {
    super(message, 400, "VALIDATION_ERROR", details);

    this.name = "ValidationError";
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
      timestamp: new Date().toISOString(),
    });

    return this;
  }

  /**
   * Convert to JSON format
   */
  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      validation_errors: this.validationErrors,
      error_count: this.validationErrors.length,
    };
  }

  /**
   * Static method to create a required field error
   */
  static requiredField(field, message = `${field} is required`) {
    return new ValidationError(message, null, field).addFieldError(
      field,
      message,
      null,
      "required"
    );
  }

  /**
   * Static method to create an invalid file error
   */
  static invalidFile(field, message, fileName = null) {
    return new ValidationError(message, null, field).addFieldError(
      field,
      message,
      fileName,
      "file_validation"
    );
  }

  /**
   * Static method to create multiple field errors
   */
  static multipleFields(genericMessage, fieldErrors) {
    const firstMessage =
      Array.isArray(fieldErrors) && fieldErrors.length > 0
        ? fieldErrors[0].message
        : genericMessage;

    const firstField =
      Array.isArray(fieldErrors) && fieldErrors.length > 0
        ? fieldErrors[0].field
        : null;
    const error = new ValidationError(firstMessage, null, firstField);
    error.addFieldErrors(fieldErrors);
    error.genericMessage = genericMessage; // preserve the generic one
    return error;
  }
}

module.exports = { ValidationError };

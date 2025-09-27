class ValidationError extends Error {
  constructor(
    message,
    statusCode = 422,
    errors = [],
    errorCode = "VALIDATION_ERROR"
  ) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  addError(field, message, value = null, rule = null) {
    this.errors.push({
      field,
      message,
      value,
      rule,
      timestamp: new Date().toISOString(),
    });
    return this;
  }

  // Required field validation errors
  static requiredField(field, message = null) {
    const defaultMessage = `${field} is required`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "REQUIRED_FIELD"
    );
    error.addError(field, message || defaultMessage, null, "required");
    return error;
  }

  // Format validation errors
  static invalidFormat(field, value, expectedFormat, message = null) {
    const defaultMessage = `${field} has invalid format. Expected: ${expectedFormat}`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "INVALID_FORMAT"
    );
    error.addError(field, message || defaultMessage, value, "format");
    return error;
  }

  static invalidUrl(
    field = "url",
    value = null,
    message = "Invalid URL format"
  ) {
    const error = new ValidationError(message, 422, [], "INVALID_URL");
    error.addError(field, message, value, "url");
    return error;
  }

  static invalidPhoneNumber(
    value = null,
    message = "Invalid phone number format"
  ) {
    const error = new ValidationError(message, 422, [], "INVALID_PHONE");
    error.addError("phone", message, value, "phone");
    return error;
  }

  static invalidDate(
    field = "date",
    value = null,
    message = "Invalid date format"
  ) {
    const error = new ValidationError(message, 422, [], "INVALID_DATE");
    error.addError(field, message, value, "date");
    return error;
  }

  static invalidDateTime(
    field = "datetime",
    value = null,
    message = "Invalid datetime format"
  ) {
    const error = new ValidationError(message, 422, [], "INVALID_DATETIME");
    error.addError(field, message, value, "datetime");
    return error;
  }

  // Length validation errors
  static stringTooShort(field, value, minLength, message = null) {
    const defaultMessage = `${field} must be at least ${minLength} characters long`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "STRING_TOO_SHORT"
    );
    error.addError(field, message || defaultMessage, value, "minLength");
    return error;
  }

  static stringTooLong(field, value, maxLength, message = null) {
    const defaultMessage = `${field} must not exceed ${maxLength} characters`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "STRING_TOO_LONG"
    );
    error.addError(field, message || defaultMessage, value, "maxLength");
    return error;
  }

  static arrayTooShort(field, value, minItems, message = null) {
    const defaultMessage = `${field} must contain at least ${minItems} items`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "ARRAY_TOO_SHORT"
    );
    error.addError(field, message || defaultMessage, value, "minItems");
    return error;
  }

  static arrayTooLong(field, value, maxItems, message = null) {
    const defaultMessage = `${field} must not contain more than ${maxItems} items`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "ARRAY_TOO_LONG"
    );
    error.addError(field, message || defaultMessage, value, "maxItems");
    return error;
  }

  // Numeric validation errors
  static numberTooSmall(field, value, minimum, message = null) {
    const defaultMessage = `${field} must be at least ${minimum}`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "NUMBER_TOO_SMALL"
    );
    error.addError(field, message || defaultMessage, value, "minimum");
    return error;
  }

  static numberTooLarge(field, value, maximum, message = null) {
    const defaultMessage = `${field} must not exceed ${maximum}`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "NUMBER_TOO_LARGE"
    );
    error.addError(field, message || defaultMessage, value, "maximum");
    return error;
  }

  static invalidNumber(field, value, message = "Must be a valid number") {
    const error = new ValidationError(message, 422, [], "INVALID_NUMBER");
    error.addError(field, message, value, "number");
    return error;
  }

  static notInteger(field, value, message = "Must be an integer") {
    const error = new ValidationError(message, 422, [], "NOT_INTEGER");
    error.addError(field, message, value, "integer");
    return error;
  }

  // Type validation errors
  static invalidType(field, value, expectedType, message = null) {
    const defaultMessage = `${field} must be of type ${expectedType}`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "INVALID_TYPE"
    );
    error.addError(field, message || defaultMessage, value, "type");
    return error;
  }

  static notBoolean(field, value, message = "Must be a boolean value") {
    const error = new ValidationError(message, 422, [], "NOT_BOOLEAN");
    error.addError(field, message, value, "boolean");
    return error;
  }

  static notArray(field, value, message = "Must be an array") {
    const error = new ValidationError(message, 422, [], "NOT_ARRAY");
    error.addError(field, message, value, "array");
    return error;
  }

  static notObject(field, value, message = "Must be an object") {
    const error = new ValidationError(message, 422, [], "NOT_OBJECT");
    error.addError(field, message, value, "object");
    return error;
  }

  // Pattern validation errors
  static patternMismatch(field, value, pattern, message = null) {
    const defaultMessage = `${field} does not match the required pattern`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "PATTERN_MISMATCH"
    );
    error.addError(field, message || defaultMessage, value, "pattern");
    return error;
  }

  static invalidPassword(
    requirements = [],
    message = "Password does not meet requirements"
  ) {
    const error = new ValidationError(message, 422, [], "INVALID_PASSWORD");
    error.addError(
      "password",
      `${message}. Requirements: ${requirements.join(", ")}`,
      null,
      "password"
    );
    return error;
  }

  // Enum validation errors
  static invalidEnumValue(field, value, allowedValues, message = null) {
    const defaultMessage = `${field} must be one of: ${allowedValues.join(
      ", "
    )}`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "INVALID_ENUM_VALUE"
    );
    error.addError(field, message || defaultMessage, value, "enum");
    return error;
  }

  // Unique validation errors
  static duplicateValue(field, value, message = null) {
    const defaultMessage = `${field} must be unique`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "DUPLICATE_VALUE"
    );
    error.addError(field, message || defaultMessage, value, "unique");
    return error;
  }

  // Cross-field validation errors
  static fieldMismatch(field1, field2, message = "Fields do not match") {
    const error = new ValidationError(message, 422, [], "FIELD_MISMATCH");
    error.addError(field1, message, null, "match");
    error.addError(field2, message, null, "match");
    return error;
  }

  static dateRange(
    startField,
    endField,
    startValue,
    endValue,
    message = "End date must be after start date"
  ) {
    const error = new ValidationError(message, 422, [], "INVALID_DATE_RANGE");
    error.addError(startField, message, startValue, "dateRange");
    error.addError(endField, message, endValue, "dateRange");
    return error;
  }

  // File validation errors
  static invalidFileType(field, fileType, allowedTypes, message = null) {
    const defaultMessage = `${field} must be one of: ${allowedTypes.join(
      ", "
    )}`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "INVALID_FILE_TYPE"
    );
    error.addError(field, message || defaultMessage, fileType, "fileType");
    return error;
  }

  static fileSizeTooLarge(field, fileSize, maxSize, message = null) {
    const defaultMessage = `${field} size must not exceed ${maxSize} bytes`;
    const error = new ValidationError(
      message || defaultMessage,
      422,
      [],
      "FILE_SIZE_TOO_LARGE"
    );
    error.addError(field, message || defaultMessage, fileSize, "fileSize");
    return error;
  }

  // Custom validation errors
  static custom(field, message, value = null, rule = "custom") {
    const error = new ValidationError(
      message,
      422,
      [],
      "CUSTOM_VALIDATION_ERROR"
    );
    error.addError(field, message, value, rule);
    return error;
  }

  // Utility methods
  static fromJoiError(joiError) {
    const error = new ValidationError(
      "Validation failed",
      422,
      [],
      "JOI_VALIDATION_ERROR"
    );

    joiError.details.forEach((detail) => {
      error.addError(
        detail.path.join("."),
        detail.message,
        detail.context?.value,
        detail.type
      );
    });

    return error;
  }

  static fromExpressValidator(errors, errorMessage = "Validation failed") {
    const error = new ValidationError(
      errorMessage,
      422,
      [],
      "EXPRESS_VALIDATION_ERROR"
    );

    errors.forEach((err) => {
      error.addError(
        err.param || err.path,
        err.msg,
        err.value,
        err.type || "unknown"
      );
    });

    return error;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  getFieldErrors(field) {
    return this.errors.filter((error) => error.field === field);
  }

  getErrorMessages() {
    return this.errors.map((error) => error.message);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      errors: this.errors,
      isOperational: this.isOperational,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = ValidationError;

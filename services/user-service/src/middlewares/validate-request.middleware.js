const { validationResult } = require("express-validator");
const {
  ValidationError,
} = require("../../../../shared/errors/validationError.js");

/**
 * Middleware to whitelist fields and validate inputs
 * @param {string[]} allowedFields - list of allowed fields for the route
 */
function validateRequest(allowedFields = []) {
  return (req, res, next) => {
    // 1️⃣ Check for extra fields
    const extraFields = Object.keys(req.body).filter(
      (key) => !allowedFields.includes(key)
    );

    if (extraFields.length > 0) {
      return next(
        ValidationError.custom(
          "body",
          `Unknown fields provided: ${extraFields.join(", ")}`,
          extraFields
        )
      );
    }

    // 2️⃣ Run express-validator validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const fieldErrors = errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
        constraint: null,
      }));

      return next(
        ValidationError.multipleFields("Validation failed", fieldErrors)
      );
    }

    // 3️⃣ Everything is valid
    next();
  };
}

module.exports = validateRequest;

/**
 * Authentication API paths
 */

const registerOtp = {
  post: {
    tags: ["Authentication"],
    summary: "Request OTP for user registration",
    description:
      "Sends a one-time password (OTP) to the provided phone number for user registration verification. Rate limited to 1 request per minute and 5 requests per hour per phone number.",
    operationId: "requestRegistrationOtp",
    consumes: ["application/json"],
    produces: ["application/json"],
    parameters: [
      {
        in: "body",
        name: "body",
        description: "Phone number details for OTP request",
        required: true,
        schema: {
          $ref: "#/definitions/AuthRegisterOtpRequest",
        },
      },
    ],
    responses: {
      200: {
        description: "OTP sent successfully",
        schema: {
          $ref: "#/definitions/AuthRegisterOtpResponse",
        },
        examples: {
          "application/json": {
            success: true,
            status_code: 200,
            data: {
              phone: "+8615680026773",
              verification_id: "74785f2f-b702-4300-89aa-f19c9120cf04",
              expires_in: 300,
            },
            message: "OTP sent successfully",
            timestamp: "2025-09-22T07:46:07.231Z",
            request_id: "59e95877-290a-47c0-b673-35e97c0a49cf",
          },
        },
      },
      400: {
        description: "Validation error - missing or invalid parameters",
        schema: {
          $ref: "#/definitions/ValidationErrorResponse",
        },
      },
      409: {
        description: "Phone number already registered",
        schema: {
          $ref: "#/definitions/DuplicatePhoneErrorResponse",
        },
      },
      429: {
        description: "Rate limit exceeded - too many OTP requests",
        schema: {
          $ref: "#/definitions/RateLimitErrorResponse",
        },
      },
      500: {
        description: "Internal server error",
      },
    },
    security: [],
  },
};

module.exports = {
  "/register/otp": registerOtp,
  // Add other auth paths here
};

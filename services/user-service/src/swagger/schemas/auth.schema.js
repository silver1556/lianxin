/**
 * Authentication related schemas
 */

const AuthRegisterOtpRequest = {
  type: "object",
  required: ["phone", "country_code"],
  properties: {
    phone: {
      type: "string",
      example: "15680026773",
      description: "User's phone number without country code",
    },
    country_code: {
      type: "string",
      example: "+86",
      description: "Country dialing code in E.164 format",
    },
  },
};

const OtpResponseData = {
  type: "object",
  properties: {
    phone: {
      type: "string",
      example: "+8615680026773",
      description: "E.164 formatted phone number with country code",
    },
    verification_id: {
      type: "string",
      format: "uuid",
      example: "74785f2f-b702-4300-89aa-f19c9120cf04",
      description: "Unique identifier for this OTP verification session",
    },
    expires_in: {
      type: "integer",
      example: 300,
      description: "OTP expiration time in seconds",
    },
  },
};

const AuthRegisterOtpResponse = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      example: true,
    },
    status_code: {
      type: "integer",
      example: 200,
    },
    data: OtpResponseData,
    message: {
      type: "string",
      example: "OTP sent successfully",
    },
    timestamp: {
      type: "string",
      format: "date-time",
      example: "2025-09-22T07:46:07.231Z",
    },
    request_id: {
      type: "string",
      format: "uuid",
      example: "59e95877-290a-47c0-b673-35e97c0a49cf",
    },
  },
};

const ValidationErrorResponse = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      example: false,
    },
    status_code: {
      type: "integer",
      example: 400,
    },
    error: {
      type: "object",
      properties: {
        code: {
          type: "string",
          example: "VALIDATION_ERROR",
        },
        message: {
          type: "string",
          example: "Registration validation failed",
        },
        details: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                example: "phone",
              },
              message: {
                type: "string",
                example: "Phone number is required",
              },
            },
          },
        },
      },
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
    request_id: {
      type: "string",
      format: "uuid",
    },
  },
};

const RateLimitErrorResponse = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      example: false,
    },
    status_code: {
      type: "integer",
      example: 429,
    },
    error: {
      type: "object",
      properties: {
        code: {
          type: "string",
          example: "RATE_LIMIT_EXCEEDED",
        },
        message: {
          type: "string",
          example: "Please wait before requesting another OTP",
        },
        retry_after: {
          type: "integer",
          example: 60,
        },
      },
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
    request_id: {
      type: "string",
      format: "uuid",
    },
  },
};

const DuplicatePhoneErrorResponse = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      example: false,
    },
    status_code: {
      type: "integer",
      example: 409,
    },
    error: {
      type: "object",
      properties: {
        code: {
          type: "string",
          example: "DUPLICATE_PHONE",
        },
        message: {
          type: "string",
          example: "Phone number already registered",
        },
        details: {
          type: "object",
          properties: {
            phone: {
              type: "string",
              example: "+8615680026773",
            },
          },
        },
      },
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
    request_id: {
      type: "string",
      format: "uuid",
    },
  },
};

module.exports = {
  AuthRegisterOtpRequest,
  AuthRegisterOtpResponse,
  OtpResponseData,
  ValidationErrorResponse,
  RateLimitErrorResponse,
  DuplicatePhoneErrorResponse,
};

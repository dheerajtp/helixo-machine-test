export const ERROR_STATUS = Object.freeze({
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  NOT_READY: 503,
});

// The message and details are sent to the client (except for INTERNAL).
export class AppError extends Error {
  constructor(code, message, details) {
    if (!Object.hasOwn(ERROR_STATUS, code)) {
      throw new TypeError(`Unknown error code: ${code}`);
    }
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

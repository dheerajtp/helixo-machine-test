import { AppError } from "./errors.js";
import { sendError } from "./responses.js";

export function notFound(_req, res) {
  sendError(res, { code: "NOT_FOUND", message: "Resource not found" });
}

function toClientError(error) {
  if (error instanceof AppError) {
    return error.code === "INTERNAL" ? null : error;
  }
  if (error?.isJoi) {
    return {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    };
  }
  // body-parser errors carry `type`; the router throws URIError on a bad path parameter.
  const status = error?.status;
  if ((error?.type || error instanceof URIError) && status >= 400 && status < 500) {
    return status === 413
      ? { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" }
      : { code: "VALIDATION_ERROR", message: "Malformed request" };
  }
  return null;
}

export function errorHandler(logger) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const known = toClientError(error);
    if (known) {
      const { code, message, details } = known;
      return sendError(res, { code, message, details });
    }
    // Name, message and stack only: driver and HTTP errors carry payloads in other properties.
    logger.error(
      {
        requestId: req.id,
        err: { type: error?.name, message: error?.message, stack: error?.stack },
      },
      "Unhandled error"
    );
    sendError(res, { code: "INTERNAL", message: "Something went wrong" });
  };
}

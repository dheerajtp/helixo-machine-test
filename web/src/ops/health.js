import { asyncHandler } from "../http/asyncHandler.js";
import { sendError, sendSuccess } from "../http/responses.js";

export const health = (_req, res) => sendSuccess(res, { message: "OK" });

export const ready = ({ isShuttingDown, isDbReady }) =>
  asyncHandler(async (_req, res) => {
    if (isShuttingDown() || !(await isDbReady())) {
      return sendError(res, { code: "NOT_READY", message: "Not ready" });
    }
    sendSuccess(res, { message: "Ready" });
  });

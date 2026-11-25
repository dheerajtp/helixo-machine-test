import { ERROR_STATUS } from "./errors.js";

const meta = (res) => ({ requestId: res.req.id });

export function sendSuccess(res, { status = 200, message, data = null, pagination }) {
  return res.status(status).json({
    success: true,
    message,
    data,
    meta: { ...meta(res), ...(pagination && { pagination }) },
  });
}

export function sendError(res, { status, code, message, details = [] }) {
  return res.status(status ?? ERROR_STATUS[code]).json({
    success: false,
    message,
    error: { code, details },
    meta: meta(res),
  });
}

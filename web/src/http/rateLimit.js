import { rateLimit } from "express-rate-limit";
import { sendError } from "./responses.js";

// Per shop, after auth sets req.shop. shortcut: in-memory store, correct for one app instance only;
// move to a shared store if the app ever runs more than one replica.
export function createApiRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 100,
    keyGenerator: (req) => req.shop,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      sendError(res, { code: "RATE_LIMITED", message: "Too many requests, try again later" }),
  });
}

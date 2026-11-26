import { isIP } from "node:net";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { sendError } from "./responses.js";

const tooMany = (_req, res) =>
  sendError(res, { code: "RATE_LIMITED", message: "Too many requests, try again later" });

// App proxy requests come from Shopify, so the shopper's IP is the first X-Forwarded-For entry.
// Runs after the signature check sets req.shop; without a usable IP the key is the shop alone.
// shortcut: trusts the leftmost entry as Shopify forwards it; if Shopify keeps a client-sent
// X-Forwarded-For, a shopper can rotate it, so add a per-shop ceiling if that is seen.
const proxyKey = (req) => {
  const ip = req.get("X-Forwarded-For")?.split(",")[0].trim();
  return ip && isIP(ip) ? `${req.shop}|${ipKeyGenerator(ip)}` : req.shop;
};

// Each proxy route group gets its own limiter (own counters); skip leaves a route to another one.
export function createProxyRateLimiter({ limit = 300, skip } = {}) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    ...(skip && { skip }),
    keyGenerator: proxyKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // The header is read deliberately above, not through req.ip and trust proxy.
    validate: { xForwardedForHeader: false },
    handler: tooMany,
  });
}

// Per shop, after auth sets req.shop. shortcut: in-memory store, correct for one app instance only;
// move to a shared store if the app ever runs more than one replica.
export function createApiRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: 100,
    keyGenerator: (req) => req.shop,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooMany,
  });
}

import { Router } from "express";
import { verifyProxySignature } from "../auth/proxy.js";
import * as controller from "../controllers/proxyController.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { createProxyRateLimiter } from "../http/rateLimit.js";
import { validate } from "../http/validate.js";
import { timerQuery } from "../validators/proxyRequests.js";

// Storefront requests through the Shopify app proxy (/apps/countdown/* on the shop's domain).
// Everything but a successful timer response is no-store.
export function createProxyRouter(shopify) {
  const router = Router();
  router.use(
    (_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    verifyProxySignature(shopify),
    createProxyRateLimiter()
  );
  router.get("/timer", validate({ query: timerQuery }), asyncHandler(controller.getTimer));
  return router;
}

import express, { Router } from "express";
import { verifyProxySignature } from "../auth/proxy.js";
import * as controller from "../controllers/proxyController.js";
import { asyncHandler } from "../http/asyncHandler.js";
import { createProxyRateLimiter, createShopCeiling } from "../http/rateLimit.js";
import { validate } from "../http/validate.js";
import { impressionBody, timerQuery } from "../validators/proxyRequests.js";

// Storefront requests through the Shopify app proxy (/apps/countdown/* on the shop's domain).
// Everything but a successful timer response is no-store.
// Impressions have their own limit, so beacons never use up the timer route's.
const isImpression = (req) => req.method === "POST" && /^\/impressions\/?$/i.test(req.path);

export function createProxyRouter(shopify, { timerCeiling = 3000, impressionCeiling = 600 } = {}) {
  const router = Router();
  router.use(
    (_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    verifyProxySignature(shopify),
    createProxyRateLimiter({ skip: isImpression })
  );
  router.get(
    "/timer",
    createShopCeiling(timerCeiling),
    validate({ query: timerQuery }),
    asyncHandler(controller.getTimer)
  );
  router.post(
    "/impressions",
    createProxyRateLimiter({ limit: 60 }),
    createShopCeiling(impressionCeiling),
    express.json({ limit: "1kb" }),
    validate({ body: impressionBody }),
    asyncHandler(controller.recordImpression)
  );
  return router;
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import express from "express";
import helmet from "helmet";
import serveStatic from "serve-static";

import { attachShop, verifySessionToken } from "./auth/requireShop.js";
import { errorHandler, notFound } from "./http/errorHandler.js";
import { requestLogger } from "./http/logger.js";
import { createApiRateLimiter } from "./http/rateLimit.js";
import { requestId } from "./http/requestId.js";
import { health, ready } from "./ops/health.js";
import { createMetrics } from "./ops/metrics.js";
import { createTimersRouter } from "./routes/timers.js";
import { privacyWebhookHandlers } from "./webhooks/privacy.js";

export function createApp({ shopify, config, logger, isShuttingDown, isDbReady }) {
  const STATIC_PATH =
    config.NODE_ENV === "production"
      ? `${process.cwd()}/frontend/dist`
      : `${process.cwd()}/frontend/`;

  const app = express();
  const metrics = createMetrics(config.METRICS_TOKEN);

  app.use(requestId, requestLogger(logger), metrics.timer);
  // CSP and framing come from shopify.cspHeaders(); helmet's would block the admin iframe.
  app.use(helmet({ contentSecurityPolicy: false, xFrameOptions: false }));

  app.get("/health", health);
  app.get("/ready", ready({ isShuttingDown, isDbReady }));
  app.get("/metrics", metrics.handler);

  // Set up Shopify authentication and webhook handling
  app.get(shopify.config.auth.path, shopify.auth.begin());
  app.get(
    shopify.config.auth.callbackPath,
    shopify.auth.callback(),
    shopify.redirectToShopifyOrAppRoot()
  );
  // Needs the raw body: no JSON parser may run before this.
  app.post(
    shopify.config.webhooks.path,
    shopify.processWebhooks({ webhookHandlers: privacyWebhookHandlers(logger) })
  );

  // If you are adding routes outside of the /api path, remember to
  // also add a proxy rule for them in web/frontend/vite.config.js

  // Token check (401 envelope), the library's session check (its 403 re-authorize stays),
  // req.shop from the session, then the per-shop limit.
  app.use(
    "/api",
    verifySessionToken(shopify),
    shopify.validateAuthenticatedSession(),
    attachShop,
    createApiRateLimiter()
  );

  app.use(express.json({ limit: "32kb" }));

  app.get("/api/products/count", async (_req, res) => {
    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const countData = await client.request(`
      query shopifyProductCount {
        productsCount {
          count
        }
      }
    `);

    res.status(200).send({ count: countData.data.productsCount.count });
  });

  app.post("/api/products", async (_req, res) => {
    let status = 200;
    let error = null;

    try {
      // Imported here: it loads shopify.js, which reads the environment at import.
      const { default: productCreator } = await import("../product-creator.js");
      await productCreator(res.locals.shopify.session);
    } catch (e) {
      console.log(`Failed to process products/create: ${e.message}`);
      status = 500;
      error = e.message;
    }
    res.status(status).send({ success: status === 200, error });
  });

  app.use("/api/timers", createTimersRouter());

  app.use("/api", notFound);

  app.use(shopify.cspHeaders());
  app.use(serveStatic(STATIC_PATH, { index: false }));

  app.use(shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
    const html = await readFile(join(STATIC_PATH, "index.html"), "utf8");
    return res
      .status(200)
      .set("Content-Type", "text/html")
      .send(html.replace("%VITE_SHOPIFY_API_KEY%", config.SHOPIFY_API_KEY));
  });

  app.use(errorHandler(logger));

  return app;
}

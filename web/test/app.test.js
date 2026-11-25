import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/http/logger.js";

const TOKEN = "test-metrics-token-123";
const pass = (_req, _res, next) => next();

let rawWebhookBody;
const shopify = {
  config: {
    auth: { path: "/api/auth", callbackPath: "/api/auth/callback" },
    webhooks: { path: "/api/webhooks" },
  },
  auth: { begin: () => pass, callback: () => pass },
  redirectToShopifyOrAppRoot: () => pass,
  // Same parser the library mounts: it is skipped if the body was already consumed.
  processWebhooks: () => [
    express.text({ type: "*/*" }),
    (req, res) => {
      rawWebhookBody = req.body;
      res.sendStatus(200);
    },
  ],
  validateAuthenticatedSession: () => (req, res, next) => {
    if (!req.get("Authorization")) return res.sendStatus(401);
    res.locals.shopify = { session: {} };
    next();
  },
  api: {
    clients: {
      Graphql: class {
        async request() {
          return { data: { productsCount: { count: 3 } } };
        }
      },
    },
  },
  cspHeaders: () => pass,
  ensureInstalledOnShop: () => (_req, res) => res.status(400).send("No shop"),
};

const state = { shuttingDown: false, dbReady: true };

let server;
before(async () => {
  const app = createApp({
    shopify,
    config: { NODE_ENV: "test", METRICS_TOKEN: TOKEN, SHOPIFY_API_KEY: "key" },
    logger: createLogger({ write: () => {} }),
    isShuttingDown: () => state.shuttingDown,
    isDbReady: async () => state.dbReady,
  });
  server = app.listen(0);
  await once(server, "listening");
});
after(() => server.close());
const api = () => request(server);

test("/health is 200 even when the database is down", async () => {
  state.dbReady = false;
  const response = await api().get("/health").expect(200);
  assert.deepEqual(response.body, {
    success: true,
    message: "OK",
    data: null,
    meta: { requestId: response.headers["x-request-id"] },
  });
  state.dbReady = true;
});

test("/ready: 200 when ready, 503 without the database or while shutting down", async () => {
  await api().get("/ready").expect(200);
  for (const change of [{ dbReady: false }, { shuttingDown: true }]) {
    Object.assign(state, change);
    const response = await api().get("/ready").expect(503);
    assert.equal(response.body.error.code, "NOT_READY");
    assert.deepEqual(response.body.error.details, []);
    Object.assign(state, { dbReady: true, shuttingDown: false });
  }
});

test("/metrics needs the bearer token", async () => {
  for (const header of [undefined, "Bearer wrong", TOKEN, `Bearer ${TOKEN}x`]) {
    const call = api().get("/metrics");
    if (header) call.set("Authorization", header);
    const response = await call.expect(401);
    assert.equal(response.body.error.code, "UNAUTHORIZED");
  }
  const ok = await api().get("/metrics").set("Authorization", `Bearer ${TOKEN}`).expect(200);
  assert.match(ok.headers["content-type"], /^text\/plain/);
});

test("metrics are labelled by route pattern, never by raw path", async () => {
  await api().get("/api/products/count?x=1").set("Authorization", "s").expect(200, { count: 3 });
  await api().get("/api/raw-path-123").set("Authorization", "s").expect(404);
  const { text } = await api().get("/metrics").set("Authorization", `Bearer ${TOKEN}`);
  assert.match(text, /http_request_duration_seconds_count\{[^}]*route="\/api\/products\/count"/);
  assert.match(text, /http_request_errors_total\{[^}]*route="unmatched",status="404"\} 1/);
  assert.ok(!text.includes("raw-path-123"));
});

test("helmet headers are set without blocking admin framing or adding CORS", async () => {
  const { headers } = await api().get("/health").set("Origin", "https://evil.example");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.ok(headers["strict-transport-security"]);
  for (const name of [
    "content-security-policy",
    "x-frame-options",
    "x-powered-by",
    "access-control-allow-origin",
  ]) {
    assert.equal(headers[name], undefined, name);
  }
});

test("unknown /api route: 404 envelope, only after session validation", async () => {
  await api().get("/api/missing").expect(401);
  const response = await api().get("/api/missing").set("Authorization", "s").expect(404);
  assert.equal(response.body.error.code, "NOT_FOUND");
  assert.equal(response.body.meta.requestId, response.headers["x-request-id"]);
});

test("a body over 32kb is rejected", async () => {
  const response = await api()
    .post("/api/products")
    .set("Authorization", "s")
    .send({ x: "a".repeat(33 * 1024) })
    .expect(413);
  assert.equal(response.body.error.code, "PAYLOAD_TOO_LARGE");
});

test("the webhook route receives the raw body, without a session", async () => {
  const raw = '{ "shop_id": 1,   "spacing": "kept" }';
  await api().post("/api/webhooks").type("json").send(raw).expect(200);
  assert.equal(rawWebhookBody, raw);
});

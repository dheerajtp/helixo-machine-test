import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connect, disconnect } from "../src/db/connection.js";
import { createLogger } from "../src/http/logger.js";

const TOKEN = "test-metrics-token-123";
const SHOP = "shop-metrics.myshopify.com";
const AUTH = `Bearer valid:${SHOP}`;

const pass = (_req, _res, next) => next();
const shopify = {
  config: { auth: { path: "/api/auth", callbackPath: "/cb" }, webhooks: { path: "/api/webhooks" } },
  auth: { begin: () => pass, callback: () => pass },
  redirectToShopifyOrAppRoot: () => pass,
  processWebhooks: () => pass,
  validateAuthenticatedSession: () => (req, res, next) => {
    res.locals.shopify = { session: { shop: req.get("Authorization").split("valid:")[1] } };
    next();
  },
  api: {
    session: {
      decodeSessionToken: async (token) => {
        if (!token.startsWith("valid:")) throw new Error("invalid");
        return { dest: `https://${token.slice(6)}` };
      },
    },
  },
  cspHeaders: () => pass,
  ensureInstalledOnShop: () => (_req, res) => res.sendStatus(400),
};

let replSet;
let server;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("metrics"));
  server = createApp({
    shopify,
    config: { NODE_ENV: "test", METRICS_TOKEN: TOKEN, SHOPIFY_API_KEY: "key" },
    logger: createLogger({ write: () => {} }),
    isShuttingDown: () => false,
    isDbReady: async () => true,
  }).listen(0);
  await once(server, "listening");
});
after(async () => {
  server?.close();
  await disconnect();
  await replSet?.stop();
});

test("metrics label timer routes with the full pattern, for success and error responses", async () => {
  const created = await request(server)
    .post("/api/timers")
    .set("Authorization", AUTH)
    .send({
      name: "Sale",
      type: "fixed",
      startAt: "2030-01-01T00:00:00Z",
      endAt: "2030-02-01T00:00:00Z",
      targetType: "all",
      appearance: { backgroundColor: "#ff0000" },
    })
    .expect(201);
  const id = created.body.data.id;

  await request(server).get(`/api/timers/${id}`).set("Authorization", AUTH).expect(200);
  // Casing variant of the mount path: Express matches it, the label must not split.
  await request(server).get(`/API/TIMERS/${id}`).set("Authorization", AUTH).expect(200);
  await request(server).get("/api/timers/not-an-id").set("Authorization", AUTH).expect(400);

  const { text } = await request(server).get("/metrics").set("Authorization", `Bearer ${TOKEN}`);
  assert.match(
    text,
    /http_request_duration_seconds_count\{method="GET",route="\/api\/timers\/:id",status="200"\} 2/
  );
  assert.match(
    text,
    /http_request_errors_total\{method="GET",route="\/api\/timers\/:id",status="400"\} 1/
  );
  assert.ok(!text.includes(id), "raw timer id must not reach a label");
  assert.ok(!text.includes("not-an-id"), "raw path segment must not reach a label");
  assert.ok(!/route="\/"/.test(text), "bare mount-relative route must not appear");
});

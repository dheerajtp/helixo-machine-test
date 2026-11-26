import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import "@shopify/shopify-api/adapters/node";
import { ApiVersion, LogSeverity, shopifyApi } from "@shopify/shopify-api";
import { createApp } from "../src/app.js";
import { connect, disconnect } from "../src/db/connection.js";
import { createLogger } from "../src/http/logger.js";
import { TimerModel } from "../src/models/timer.js";
import { up } from "../migrations/002-timer-indexes.js";

const SECRET = "test-proxy-secret";
const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const HOUR = 3600_000;
const collection = () => mongoose.connection.db.collection("timers");
const pass = (_req, _res, next) => next();

// The real library verifies signatures; only the parts createApp wires at startup are stubbed.
const api = shopifyApi({
  apiKey: "key",
  apiSecretKey: SECRET,
  hostName: "localhost",
  apiVersion: ApiVersion.October25,
  isEmbeddedApp: true,
  logger: { level: LogSeverity.Error, log: () => {} },
});
const shopify = {
  api,
  config: { auth: { path: "/api/auth", callbackPath: "/cb" }, webhooks: { path: "/api/webhooks" } },
  auth: { begin: () => pass, callback: () => pass },
  redirectToShopifyOrAppRoot: () => pass,
  processWebhooks: () => pass,
  validateAuthenticatedSession: () => pass,
  cspHeaders: () => pass,
  ensureInstalledOnShop: () => (_req, res) => res.sendStatus(400),
};

// Shopify's app proxy signing: sorted key=value pairs, no separator, hex HMAC-SHA256.
const sign = (params, secret = SECRET) => {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("");
  return createHmac("sha256", secret).update(message).digest("hex");
};
const signedQuery = (params, { shop = A, timestamp, secret } = {}) => {
  const full = {
    shop,
    path_prefix: "/apps/countdown",
    logged_in_customer_id: "",
    timestamp: String(timestamp ?? Math.trunc(Date.now() / 1000)),
    ...params,
  };
  return new URLSearchParams({ ...full, signature: sign(full, secret) }).toString();
};
const get = (params = { productId: "1" }, options, headers = {}) =>
  request(server).get(`/proxy/timer?${signedQuery(params, options)}`).set(headers);

const now = Date.now();
const timer = (over = {}) => ({
  shop: A,
  name: "Sale",
  type: "fixed",
  enabled: true,
  startAt: new Date(now - HOUR),
  endAt: new Date(now + HOUR),
  targetType: "all",
  targetIds: [],
  description: "Ends soon",
  appearance: { backgroundColor: "#ff0000", size: "medium", position: "top" },
  urgencyEffect: "colorPulse",
  urgencyThresholdSeconds: 300,
  sortAt: new Date(now - HOUR),
  createdAt: new Date(now - HOUR),
  updatedAt: new Date(now - HOUR),
  ...over,
});
const insert = async (...docs) =>
  (await collection().insertMany(docs.map(timer))).insertedIds;
const product = (id = "1") => ({
  targetType: "products",
  targetIds: [`gid://shopify/Product/${id}`],
});
const coll = (id = "9") => ({
  targetType: "collections",
  targetIds: [`gid://shopify/Collection/${id}`],
});
const ago = (minutes) => new Date(now - minutes * 60_000);

let replSet;
let server;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("timers"));
  await TimerModel.init();
  await up(mongoose.connection.db);
});
after(async () => {
  await disconnect();
  await replSet?.stop();
});
// A new app per test also resets the in-memory rate limiter.
beforeEach(async () => {
  await collection().deleteMany({});
  server?.close();
  server = createApp({
    shopify,
    config: { NODE_ENV: "test", METRICS_TOKEN: "test-metrics-token-123", SHOPIFY_API_KEY: "key" },
    logger: createLogger({ write: () => {} }),
    isShuttingDown: () => false,
    isDbReady: async () => true,
  }).listen(0);
  await once(server, "listening");
});
after(() => server?.close());

const unauthorized = async (pending) => {
  const response = await pending.expect(401);
  assert.equal(response.body.error.code, "UNAUTHORIZED");
  assert.equal(response.headers["cache-control"], "no-store");
};

test("missing, wrong, expired and malformed signatures are 401", async () => {
  await insert({});
  await unauthorized(request(server).get("/proxy/timer?productId=1"));
  await unauthorized(request(server).get(`/proxy/timer?productId=1&shop=${A}&timestamp=1`));
  await unauthorized(get(undefined, { secret: "other-secret" }));
  await unauthorized(get(undefined, { timestamp: Math.trunc(now / 1000) - 120 }));
  // Tampering after signing.
  await unauthorized(request(server).get(`/proxy/timer?${signedQuery({ productId: "1" })}&x=1`));
  await unauthorized(
    request(server).get(`/proxy/timer?${signedQuery({ productId: "1" })}&signature=abc`)
  );
  await unauthorized(get(undefined, { shop: "evil.example.com" }));
  await unauthorized(get(undefined, { timestamp: "soon" }));
  // Unknown proxy paths are signature-checked too, then 404.
  await unauthorized(request(server).get("/proxy/other"));
  const missing = await request(server).get(`/proxy/other?${signedQuery({})}`).expect(404);
  assert.equal(missing.body.error.code, "NOT_FOUND");
});

test("payload has exactly the widget fields", async () => {
  const { 0: fixedId } = await insert({});
  const fixed = await get().expect(200);
  assert.equal(fixed.body.success, true);
  assert.deepEqual(Object.keys(fixed.body.data).sort(), [
    "appearance",
    "description",
    "endAt",
    "id",
    "serverNow",
    "type",
    "urgencyEffect",
    "urgencyThresholdSeconds",
  ]);
  assert.equal(fixed.body.data.id, String(fixedId));
  assert.equal(fixed.body.data.endAt, new Date(now + HOUR).toISOString());
  assert.deepEqual(fixed.body.data.appearance, {
    backgroundColor: "#ff0000",
    size: "medium",
    position: "top",
  });
  assert.ok(Math.abs(Date.parse(fixed.body.data.serverNow) - Date.now()) < 5000);
  assert.ok(fixed.body.meta.requestId);

  await collection().deleteMany({});
  await insert({ type: "evergreen", startAt: undefined, endAt: undefined, durationSeconds: 600 });
  const evergreen = await get().expect(200);
  assert.equal(evergreen.body.data.durationSeconds, 600);
  assert.equal("endAt" in evergreen.body.data, false);
  assert.equal("startAt" in evergreen.body.data, false);
});

test("priority is product, then collection, then all; newest wins a tie", async () => {
  const query = { productId: "1", collectionIds: "8,9" };
  const pick = async () => (await get(query).expect(200)).body.data?.id;

  // Many newer lower-rank timers never beat a higher rank.
  const many = Array.from({ length: 30 }, (_, i) => ({ createdAt: ago(i) }));
  await insert(...many);
  const ids = await insert(
    { ...coll("9"), createdAt: ago(100) },
    { ...coll("8"), createdAt: ago(90) },
    { ...product("2"), createdAt: ago(1) }
  );
  assert.equal(await pick(), String(ids[1]));

  const products = await insert(
    { ...product("1"), createdAt: ago(200) },
    { ...product("1"), createdAt: ago(150) }
  );
  assert.equal(await pick(), String(products[1]));

  // Without collections, the newest all timer wins.
  await collection().deleteMany({ targetType: "products" });
  const newestAll = await collection().findOne({ targetType: "all" }, { sort: { createdAt: -1 } });
  assert.equal((await get({ productId: "1" }).expect(200)).body.data.id, String(newestAll._id));
});

test("disabled, scheduled and expired timers are excluded; null when none", async () => {
  await insert(
    { ...product("1"), enabled: false },
    { ...product("1"), startAt: new Date(now + HOUR), endAt: new Date(now + 2 * HOUR) },
    { ...product("1"), startAt: new Date(now - 2 * HOUR), endAt: new Date(now - 1000) },
    { type: "evergreen", enabled: false, startAt: undefined, endAt: undefined, durationSeconds: 60 }
  );
  const response = await get().expect(200);
  assert.equal(response.body.data, null);
  assert.equal(response.headers["cache-control"], "public, max-age=60");
});

test("another shop's timers are never returned", async () => {
  await insert({ shop: B, ...product("1") });
  assert.equal((await get().expect(200)).body.data, null);
  const own = await insert({ shop: B, targetType: "all" });
  const asB = await get({ productId: "5" }, { shop: B }).expect(200);
  assert.equal(asB.body.data.id, String(own[0]));
  // A shop parameter added after signing does not switch tenants.
  await unauthorized(request(server).get(`/proxy/timer?${signedQuery({ productId: "1" })}&shop=${B}`));
});

test("Cache-Control, ETag and 304", async () => {
  await insert({ endAt: new Date(Date.now() + 30_500) });
  const first = await get().expect(200);
  const maxAge = Number(first.headers["cache-control"].match(/^public, max-age=(\d+)$/)[1]);
  assert.ok(maxAge <= 30 && maxAge >= 28, `max-age ${maxAge}`);
  const etag = first.headers.etag;
  assert.match(etag, /^"[0-9a-f]{24}-\d+"$/);

  // serverNow changes, the ETag does not.
  const second = await get().expect(200);
  assert.equal(second.headers.etag, etag);
  assert.notEqual(second.body.data.serverNow, undefined);
  await get(undefined, undefined, { "If-None-Match": etag }).expect(304);

  // Editing the timer changes the ETag.
  await collection().updateOne({}, { $set: { description: "New", updatedAt: new Date() } });
  const edited = await get(undefined, undefined, { "If-None-Match": etag }).expect(200);
  assert.notEqual(edited.headers.etag, etag);

  await collection().deleteMany({});
  await insert({ type: "evergreen", startAt: undefined, endAt: undefined, durationSeconds: 600 });
  assert.equal((await get().expect(200)).headers["cache-control"], "public, max-age=60");
});

test("invalid query is a 400, after the signature", async () => {
  for (const [params, field] of [
    [{}, "productId"],
    [{ productId: "abc" }, "productId"],
    [{ productId: "1", collectionIds: "1,x" }, "collectionIds"],
    [{ productId: "1", collectionIds: "" }, "collectionIds"],
    [
      { productId: "1", collectionIds: Array.from({ length: 51 }, (_, i) => i + 1).join(",") },
      "collectionIds",
    ],
  ]) {
    const response = await get(params).expect(400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.ok(response.body.error.details.some((d) => d.field === field), field);
    assert.equal(response.headers["cache-control"], "no-store");
  }
  const fifty = Array.from({ length: 50 }, (_, i) => i + 1).join(",");
  await get({ productId: "1", collectionIds: fifty }).expect(200);
});

test("rate limit is 300 per minute per shop and shopper IP", async () => {
  const query = signedQuery({ productId: "1" });
  const hit = (ip) =>
    request(server).get(`/proxy/timer?${query}`).set("X-Forwarded-For", `${ip}, 10.0.0.1`);
  for (let i = 0; i < 300; i += 1) await hit("203.0.113.5").expect(200);
  const limited = await hit("203.0.113.5").expect(429);
  assert.equal(limited.body.error.code, "RATE_LIMITED");
  assert.equal(limited.headers["cache-control"], "no-store");
  await hit("203.0.113.6").expect(200);
  // Unsigned requests are rejected before they count.
  await unauthorized(request(server).get("/proxy/timer").set("X-Forwarded-For", "203.0.113.7"));
});

test("100 requests with 500 timers stay fast", async (t) => {
  const docs = Array.from({ length: 500 }, (_, i) => ({
    ...(i % 3 === 0 ? product(String(i)) : i % 3 === 1 ? coll(String(i)) : {}),
    createdAt: ago(i),
  }));
  await insert(...docs);
  const times = [];
  for (let i = 0; i < 100; i += 1) {
    const start = performance.now();
    await get({ productId: "3", collectionIds: "4,7,10" }).expect(200);
    times.push(performance.now() - start);
  }
  const slowest = Math.max(...times);
  t.diagnostic(`slowest of 100: ${slowest.toFixed(1)} ms`);
  assert.ok(slowest < 200, `slowest ${slowest} ms`);
});

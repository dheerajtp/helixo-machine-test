import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import "@shopify/shopify-api/adapters/node";
import { ApiVersion, LogSeverity, shopifyApi } from "@shopify/shopify-api";
import { createApp } from "../src/app.js";
import { connect, disconnect } from "../src/db/connection.js";
import { createLogger } from "../src/http/logger.js";
import { ImpressionKeyModel, TimerStatsModel } from "../src/models/impression.js";
import { TimerModel } from "../src/models/timer.js";
import { up } from "../migrations/003-impression-indexes.js";
import { redactShop } from "../src/services/shopDataService.js";

const SECRET = "test-proxy-secret";
const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const db = () => mongoose.connection.db;
const pass = (_req, _res, next) => next();

const api = shopifyApi({
  apiKey: "key",
  apiSecretKey: SECRET,
  hostName: "localhost",
  apiVersion: ApiVersion.October25,
  isEmbeddedApp: true,
  logger: { level: LogSeverity.Error, log: () => {} },
});
// Real proxy signature check; the token "valid:<shop>" stands for a verified admin session.
const shopify = {
  api: {
    utils: api.utils,
    session: {
      decodeSessionToken: async (token) => {
        if (!token.startsWith("valid:")) throw new Error("invalid");
        return { dest: `https://${token.slice(6)}` };
      },
    },
  },
  config: { auth: { path: "/api/auth", callbackPath: "/cb" }, webhooks: { path: "/api/webhooks" } },
  auth: { begin: () => pass, callback: () => pass },
  redirectToShopifyOrAppRoot: () => pass,
  processWebhooks: () => pass,
  validateAuthenticatedSession: () => (req, res, next) => {
    res.locals.shopify = { session: { shop: req.get("Authorization").split("valid:")[1] } };
    next();
  },
  cspHeaders: () => pass,
  ensureInstalledOnShop: () => (_req, res) => res.sendStatus(400),
};

const sign = (params, secret = SECRET) => {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("");
  return createHmac("sha256", secret).update(message).digest("hex");
};
const signedQuery = ({ shop = A, secret, params = {} } = {}) => {
  const full = {
    ...params,
    shop,
    path_prefix: "/apps/countdown",
    logged_in_customer_id: "",
    timestamp: String(Math.trunc(Date.now() / 1000)),
  };
  return new URLSearchParams({ ...full, signature: sign(full, secret) }).toString();
};
const beacon = (body, options, ip = "203.0.113.5") =>
  request(server)
    .post(`/proxy/impressions?${signedQuery(options)}`)
    .set("X-Forwarded-For", ip)
    .send(body);
const stats = (ids, shop = A) =>
  request(server)
    .get(`/api/timers/stats?ids=${ids}`)
    .set("Authorization", `Bearer valid:${shop}`);

const makeTimer = async (shop = A) => {
  const now = new Date();
  const { insertedId } = await db()
    .collection("timers")
    .insertOne({
      shop,
      name: "Sale",
      type: "evergreen",
      enabled: true,
      durationSeconds: 600,
      targetType: "all",
      targetIds: [],
      description: "",
      appearance: { backgroundColor: "#ff0000", size: "medium", position: "top" },
      urgencyEffect: "none",
      urgencyThresholdSeconds: 300,
      sortAt: now,
      createdAt: now,
      updatedAt: now,
    });
  return String(insertedId);
};
const total = async (timerId) =>
  (
    await TimerStatsModel.aggregate([
      { $match: { timerId: new mongoose.Types.ObjectId(timerId) } },
      { $group: { _id: null, n: { $sum: "$count" } } },
    ])
  )[0]?.n ?? 0;
const today = () => new Date().toISOString().slice(0, 10);

let replSet;
let server;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("impressions"));
  await Promise.all([TimerModel.init(), ImpressionKeyModel.init(), TimerStatsModel.init()]);
  await up(db());
});
after(async () => {
  server?.close();
  await disconnect();
  await replSet?.stop();
});
// A new app per test also resets the in-memory rate limiters.
beforeEach(async () => {
  for (const name of ["timers", "impression_keys", "timer_stats"]) {
    await db().collection(name).deleteMany({});
  }
  server?.close();
  const app = createApp({
    shopify,
    config: { NODE_ENV: "test", METRICS_TOKEN: "test-metrics-token-123", SHOPIFY_API_KEY: "key" },
    logger: createLogger({ write: () => {} }),
    isShuttingDown: () => false,
    isDbReady: async () => true,
  });
  // Stands in for the Admin GraphQL client the delete route's targeting sync uses.
  app.locals.adminClient = async () => ({
    request: async (_operation, { variables } = {}) =>
      variables
        ? { data: { metafieldsSet: { userErrors: [] } } }
        : { data: { currentAppInstallation: { id: "gid://x/AppInstallation/1" } } },
  });
  app.locals.logger = createLogger({ write: () => {} });
  server = app.listen(0);
  await once(server, "listening");
});

test("a repeat is a 202 that counts once; no personal data is stored", async () => {
  const timerId = await makeTimer();
  const sessionId = randomUUID();
  for (let i = 0; i < 3; i += 1) {
    const response = await beacon({ timerId, sessionId }).expect(202);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data, null);
    assert.equal(response.headers["cache-control"], "no-store");
  }
  assert.equal(await total(timerId), 1);
  const [key] = await db().collection("impression_keys").find().toArray();
  assert.deepEqual(Object.keys(key).sort(), ["_id", "createdAt", "sessionId", "shop", "timerId"]);
  const [row] = await db().collection("timer_stats").find().toArray();
  assert.deepEqual({ shop: row.shop, day: row.day, count: row.count }, {
    shop: A,
    day: today(),
    count: 1,
  });
});

test("20 concurrent identical requests count once; 20 sessions count 20", async () => {
  const timerId = await makeTimer();
  const sessionId = randomUUID();
  const same = await Promise.all(
    Array.from({ length: 20 }, () => beacon({ timerId, sessionId }))
  );
  assert.deepEqual([...new Set(same.map((r) => r.status))], [202]);
  assert.equal(await total(timerId), 1);

  const other = await makeTimer();
  const many = await Promise.all(
    Array.from({ length: 20 }, () => beacon({ timerId: other, sessionId: randomUUID() }))
  );
  assert.deepEqual([...new Set(many.map((r) => r.status))], [202]);
  assert.equal(await total(other), 20);
  assert.equal(await db().collection("timer_stats").countDocuments({ day: today() }), 2);
});

test("another shop's or an unknown timer is a 404 and stores nothing", async () => {
  const theirs = await makeTimer(B);
  for (const timerId of [theirs, "a".repeat(24)]) {
    const response = await beacon({ timerId, sessionId: randomUUID() }).expect(404);
    assert.equal(response.body.error.code, "NOT_FOUND");
  }
  assert.equal(await db().collection("impression_keys").countDocuments(), 0);
  assert.equal(await db().collection("timer_stats").countDocuments(), 0);
});

test("bad signature 401, bad body 400, over 1 KB 413, nothing stored", async () => {
  const timerId = await makeTimer();
  const sessionId = randomUUID();
  const bad = await beacon({ timerId, sessionId }, { secret: "wrong" }).expect(401);
  assert.equal(bad.body.error.code, "UNAUTHORIZED");
  await request(server).post("/proxy/impressions").send({ timerId, sessionId }).expect(401);

  for (const body of [
    {},
    { timerId },
    { timerId: "xyz", sessionId },
    { timerId, sessionId: "not-a-uuid" },
    { timerId: { $ne: null }, sessionId },
    "not json",
  ]) {
    const response = await beacon(body).set("Content-Type", "application/json").expect(400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.equal(response.headers["cache-control"], "no-store");
  }
  const big = await beacon({ timerId, sessionId, pad: "x".repeat(1100) }).expect(413);
  assert.equal(big.body.error.code, "PAYLOAD_TOO_LARGE");
  assert.equal(await db().collection("impression_keys").countDocuments(), 0);
});

test("60 per minute per shop and IP, separate from the timer route's 300", async () => {
  const timerId = await makeTimer();
  for (let i = 0; i < 60; i += 1) await beacon({ timerId, sessionId: randomUUID() }).expect(202);
  const limited = await beacon({ timerId, sessionId: randomUUID() }).expect(429);
  assert.equal(limited.body.error.code, "RATE_LIMITED");
  assert.equal(limited.headers["cache-control"], "no-store");
  await beacon({ timerId, sessionId: randomUUID() }, {}, "203.0.113.6").expect(202);
  // The timer route's counter was not touched by the 61 beacons.
  const timer = await request(server)
    .get(`/proxy/timer?${signedQuery({ params: { productId: "1" } })}`)
    .set("X-Forwarded-For", "203.0.113.5")
    .expect(200);
  assert.match(timer.headers.ratelimit, /r=299/);
});

test("stats: totals and last 7 days, own timers only, in the order asked", async () => {
  const one = await makeTimer();
  const two = await makeTimer();
  const theirs = await makeTimer(B);
  const day = (ago) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
  const oid = (id) => new mongoose.Types.ObjectId(id);
  await db()
    .collection("timer_stats")
    .insertMany([
      { shop: A, timerId: oid(one), day: day(0), count: 3 },
      { shop: A, timerId: oid(one), day: day(6), count: 2 },
      { shop: A, timerId: oid(one), day: day(30), count: 10 },
      { shop: B, timerId: oid(theirs), day: day(0), count: 99 },
    ]);

  const response = await stats(`${two},${one.toUpperCase()},${theirs},${one}`).expect(200);
  const { data } = response.body;
  assert.deepEqual(
    data.map((s) => [s.timerId, s.total]),
    [
      [two, 0],
      [one, 15],
    ]
  );
  const last7 = data[1].last7Days;
  assert.deepEqual(last7.map((d) => d.day), [6, 5, 4, 3, 2, 1, 0].map(day));
  assert.deepEqual(last7.map((d) => d.count), [2, 0, 0, 0, 0, 0, 3]);
  assert.ok(data[0].last7Days.every((d) => d.count === 0));

  // B sees its own and nothing of A's.
  const asB = await stats(`${one},${theirs}`, B).expect(200);
  assert.deepEqual(asB.body.data.map((s) => [s.timerId, s.total]), [[theirs, 99]]);
});

test("stats: invalid ids are a 400; needs a session token", async () => {
  const fiftyOne = Array.from({ length: 51 }, (_, i) => i.toString(16).padStart(24, "0"));
  for (const ids of ["", "xyz", `${"a".repeat(24)},`, fiftyOne.join(",")]) {
    const response = await stats(ids).expect(400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  await stats(fiftyOne.slice(0, 50).join(",")).expect(200);
  await request(server).get("/api/timers/stats?ids=x").expect(401);
});

test("deleting a timer removes its stats and keys; redact removes the shop's", async () => {
  const gone = await makeTimer();
  const kept = await makeTimer();
  const theirs = await makeTimer(B);
  for (const timerId of [gone, kept]) await beacon({ timerId, sessionId: randomUUID() }).expect(202);
  await beacon({ timerId: theirs, sessionId: randomUUID() }, { shop: B }).expect(202);

  await request(server)
    .delete(`/api/timers/${gone}`)
    .set("Authorization", `Bearer valid:${A}`)
    .expect(200);
  assert.equal(await total(gone), 0);
  assert.equal(await total(kept), 1);
  assert.equal(await db().collection("impression_keys").countDocuments({ shop: A }), 1);

  await redactShop(A);
  await redactShop(A);
  assert.deepEqual(await db().collection("timer_stats").distinct("shop"), [B]);
  assert.deepEqual(await db().collection("impression_keys").distinct("shop"), [B]);
});

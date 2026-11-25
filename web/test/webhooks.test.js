import { test, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ApiVersion, Session } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { createApp } from "../src/app.js";
import { connect, disconnect } from "../src/db/connection.js";
import { createLogger } from "../src/http/logger.js";
import { sessionStorage } from "../src/repositories/sessionRepository.js";
import { redactShop } from "../src/services/shopDataService.js";

const SECRET = "test-api-secret";
const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const collection = () => mongoose.connection.db.collection("shopify_sessions");
const shops = async () => (await collection().distinct("shop")).sort();

const shopify = shopifyApp({
  api: {
    apiKey: "test-api-key",
    apiSecretKey: SECRET,
    apiVersion: ApiVersion.October26,
    scopes: ["read_products"],
    hostName: "app.example.test",
    logger: { log: () => {} },
  },
  auth: { path: "/api/auth", callbackPath: "/api/auth/callback" },
  webhooks: { path: "/api/webhooks" },
  sessionStorage,
});

const logs = [];
let replSet;
let server;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("webhooks"));
  const app = createApp({
    shopify,
    config: { NODE_ENV: "test", METRICS_TOKEN: "test-metrics-token-123", SHOPIFY_API_KEY: "key" },
    logger: createLogger({ write: (line) => logs.push(line) }),
    isShuttingDown: () => false,
    isDbReady: async () => true,
  });
  server = app.listen(0);
  await once(server, "listening");
});
after(async () => {
  server?.close();
  await disconnect();
  await replSet?.stop();
});
beforeEach(async () => {
  logs.length = 0;
  await collection().deleteMany({});
  for (const shop of [A, B]) {
    await sessionStorage.storeSession(
      new Session({ id: `offline_${shop}`, shop, state: "s", isOnline: false, accessToken: "t" })
    );
  }
});

function deliver(topic, body, { shop = A, secret = SECRET, webhookId = randomUUID() } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return request(server)
    .post("/api/webhooks")
    .set({
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": createHmac("sha256", secret).update(raw).digest("base64"),
      "X-Shopify-Topic": topic,
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-API-Version": ApiVersion.October26,
      "X-Shopify-Webhook-Id": webhookId,
    })
    .send(raw);
}

const redactBody = { shop_id: 1, shop_domain: A };
const TOPICS = ["app/uninstalled", "shop/redact", "customers/data_request", "customers/redact"];

test("app/uninstalled deletes only that shop's sessions, also when redelivered", async () => {
  const webhookId = randomUUID();
  for (let i = 0; i < 2; i++) {
    await deliver("app/uninstalled", { id: 1 }, { webhookId }).expect(200);
    assert.deepEqual(await shops(), [B]);
  }
});

test("shop/redact deletes only that shop's data, also when redelivered", async () => {
  const webhookId = randomUUID();
  for (let i = 0; i < 2; i++) {
    await deliver("shop/redact", redactBody, { webhookId }).expect(200);
    assert.deepEqual(await shops(), [B]);
  }
});

test("shop/redact takes the shop from the signed body, not the header", async () => {
  await deliver("shop/redact", redactBody, { shop: B }).expect(200);
  assert.deepEqual(await shops(), [B]);
});

test("customer topics acknowledge and change nothing", async () => {
  for (const topic of ["customers/data_request", "customers/redact"]) {
    const body = { shop_domain: A, customer: { id: 1 } };
    await deliver(topic, body).expect(200);
    await deliver(topic, body).expect(200);
  }
  assert.deepEqual(await shops(), [A, B]);
});

test("a bad HMAC gets 401 on every topic and deletes nothing", async () => {
  for (const topic of TOPICS) {
    await deliver(topic, redactBody, { secret: "wrong" }).expect(401);
  }
  assert.deepEqual(await shops(), [A, B]);
});

test("an invalid shop/redact body is acknowledged, deletes nothing and is not logged", async () => {
  const bodies = [
    "not json private-marker",
    "null",
    { note: "private-marker" },
    { shop_domain: { $ne: "private-marker" } },
    { shop_domain: "private-marker.example.com" },
  ];
  for (const body of bodies) {
    await deliver("shop/redact", body).expect(200);
  }
  assert.deepEqual(await shops(), [A, B]);
  assert.equal(logs.filter((line) => line.includes("Invalid shop/redact payload")).length, 5);
  assert.ok(!logs.join("").includes("private-marker"));
});

test("a database failure during shop/redact returns 500, and a retry succeeds", async () => {
  const failing = mock.method(mongoose.models.ShopifySession, "deleteMany", async () => {
    throw new Error("database down");
  });
  await deliver("shop/redact", redactBody).expect(500);
  failing.mock.restore();
  assert.deepEqual(await shops(), [A, B]);
  await deliver("shop/redact", redactBody).expect(200);
  assert.deepEqual(await shops(), [B]);
});

test("redactShop is safe to run twice", async () => {
  await redactShop(A);
  await redactShop(A);
  assert.deepEqual(await shops(), [B]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import "@shopify/shopify-api/adapters/node";
import { ApiVersion, LogSeverity, shopifyApi } from "@shopify/shopify-api";
import { errorHandler } from "../src/http/errorHandler.js";
import { createLogger } from "../src/http/logger.js";
import { createProxyRouter } from "../src/routes/proxy.js";

const SECRET = "test-proxy-secret";
const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";

const api = shopifyApi({
  apiKey: "key",
  apiSecretKey: SECRET,
  hostName: "localhost",
  apiVersion: ApiVersion.October25,
  isEmbeddedApp: true,
  logger: { level: LogSeverity.Error, log: () => {} },
});

const signedQuery = (shop) => {
  const params = { shop, timestamp: String(Math.trunc(Date.now() / 1000)) };
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("");
  const signature = createHmac("sha256", SECRET).update(message).digest("hex");
  return new URLSearchParams({ ...params, signature }).toString();
};

// A new app has new counters. Requests carry no input, so one that passes the limiters stops at
// validation with a 400 and no database is needed.
const createClient = (limits) => {
  const app = express();
  app.use("/proxy", createProxyRouter({ api }, limits));
  app.use(errorHandler(createLogger({ write: () => {} })));
  const send = (method, path) => (ip, shop = A) =>
    request(app)[method](`/proxy/${path}?${signedQuery(shop)}`).set("X-Forwarded-For", ip);
  return { timer: send("get", "timer"), impression: send("post", "impressions") };
};
const ip = (i) => `203.0.113.${i}`;

for (const route of ["timer", "impression"]) {
  test(`${route}: rotating X-Forwarded-For hits the shop ceiling, another shop does not`, async () => {
    const client = createClient({ timerCeiling: 3, impressionCeiling: 3 });
    for (let i = 1; i <= 3; i += 1) await client[route](ip(i)).expect(400);
    const limited = await client[route](ip(4)).expect(429);
    assert.equal(limited.body.error.code, "RATE_LIMITED");
    assert.equal(limited.headers["cache-control"], "no-store");
    assert.ok(limited.headers["retry-after"]);
    assert.match(limited.headers.ratelimit, /"3-in-1min"; r=0/);
    await client[route](ip(4), B).expect(400);
  });
}

test("requests refused by the per-shopper limit do not count against the shop", async () => {
  const client = createClient({ impressionCeiling: 62 });
  // Per shopper is 60: the last 10 are refused before the ceiling.
  for (let i = 0; i < 70; i += 1) await client.impression(ip(1)).expect(i < 60 ? 400 : 429);
  await client.impression(ip(2)).expect(400);
  await client.impression(ip(2)).expect(400);
  await client.impression(ip(2)).expect(429);
});

test("timer and impression ceilings are counted separately", async () => {
  const client = createClient({ timerCeiling: 1, impressionCeiling: 1 });
  await client.timer(ip(1)).expect(400);
  await client.timer(ip(2)).expect(429);
  await client.impression(ip(3)).expect(400);
  await client.impression(ip(4)).expect(429);
});

test("default ceilings are 3000 timer and 600 impressions per minute", async () => {
  const client = createClient();
  const timer = await client.timer(ip(1));
  assert.match(timer.headers["ratelimit-policy"], /"3000-in-1min"; q=3000; w=60/);
  const impression = await client.impression(ip(1));
  assert.match(impression.headers["ratelimit-policy"], /"600-in-1min"; q=600; w=60/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { attachShop, verifySessionToken } from "../src/auth/requireShop.js";
import { createApiRateLimiter } from "../src/http/rateLimit.js";
import { requestId } from "../src/http/requestId.js";

const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";

// Stub library: tokens are "valid:<dest shop>"; the session shop comes from X-Session-Shop.
const shopify = {
  api: {
    session: {
      decodeSessionToken: async (token) => {
        if (!token.startsWith("valid:")) throw new Error(`Failed to parse session token '${token}'`);
        return { dest: `https://${token.slice(6)}` };
      },
    },
  },
};
const librarySession = (req, res, next) => {
  const shop = req.get("X-Session-Shop");
  if (shop) res.locals.shopify = { session: { shop } };
  next();
};

function makeApp() {
  const app = express();
  app.use(requestId);
  app.use(
    "/api",
    verifySessionToken(shopify),
    librarySession,
    attachShop,
    createApiRateLimiter()
  );
  app.get("/api/whoami", (req, res) => res.json({ shop: req.shop }));
  return app;
}

const call = (app, { token, sessionShop, path = "/api/whoami" } = {}) => {
  const r = request(app).get(path);
  if (token) r.set("Authorization", token);
  if (sessionShop) r.set("X-Session-Shop", sessionShop);
  return r;
};

const expect401 = async (pending) => {
  const response = await pending.expect(401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, "UNAUTHORIZED");
  assert.ok(!JSON.stringify(response.body).includes("bad-token"));
};

test("no token, a non-Bearer header or a bad token is a 401 envelope", async () => {
  const app = makeApp();
  await expect401(call(app, { sessionShop: A }));
  await expect401(call(app, { token: `valid:${A}`, sessionShop: A }));
  await expect401(call(app, { token: "Bearer bad-token", sessionShop: A }));
  await expect401(call(app, { token: "Bearer valid:", sessionShop: A }));
});

test("a valid token with its shop's session sets req.shop", async () => {
  const response = await call(makeApp(), { token: `Bearer valid:${A}`, sessionShop: A }).expect(200);
  assert.deepEqual(response.body, { shop: A });
});

test("token dest and session shop must match", async () => {
  const app = makeApp();
  await expect401(call(app, { token: `Bearer valid:${A}`, sessionShop: B }));
  await expect401(call(app, { token: `Bearer valid:${A}` })); // no session
});

test("?shop= of another shop never reaches req.shop", async () => {
  const response = await call(makeApp(), {
    token: `Bearer valid:${A}`,
    sessionShop: A,
    path: `/api/whoami?shop=${B}`,
  }).expect(200);
  assert.deepEqual(response.body, { shop: A });
});

test("rate limit: the 101st request in a minute is 429, another shop is unaffected", async () => {
  const app = makeApp();
  const asA = () => call(app, { token: `Bearer valid:${A}`, sessionShop: A });
  for (let i = 0; i < 100; i++) await asA().expect(200);
  const limited = await asA().expect(429);
  assert.equal(limited.body.error.code, "RATE_LIMITED");
  assert.equal(limited.body.meta.requestId, limited.headers["x-request-id"]);
  assert.ok(limited.headers.ratelimit);
  await call(app, { token: `Bearer valid:${B}`, sessionShop: B }).expect(200);
  // A fresh app has its own store.
  await call(makeApp(), { token: `Bearer valid:${A}`, sessionShop: A }).expect(200);
});

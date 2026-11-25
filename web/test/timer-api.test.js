import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connect, disconnect } from "../src/db/connection.js";
import { createLogger } from "../src/http/logger.js";

const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const collection = () => mongoose.connection.db.collection("timers");
const pass = (_req, _res, next) => next();

// The token "valid:<shop>" stands for a verified session token and its offline session.
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

const body = (over = {}) => ({
  name: "Sale",
  type: "fixed",
  startAt: "2030-01-01T00:00:00Z",
  endAt: "2030-02-01T00:00:00Z",
  targetType: "all",
  appearance: { backgroundColor: "#ff0000" },
  ...over,
});

let replSet;
let server;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("timers"));
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

const call = (method, path, shop = A) =>
  request(server)[method](`/api/timers${path}`).set("Authorization", `Bearer valid:${shop}`);
const create = async (over, shop) =>
  (await call("post", "", shop).send(body(over)).expect(201)).body.data;
const rejects = async (pending, field) => {
  const response = await pending.expect(400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  const fields = response.body.error.details.map((d) => d.field);
  assert.ok(fields.includes(field), `${field} not in ${fields}`);
};

test("create, read, list, update and delete", async () => {
  const created = await create();
  assert.equal(created.status, "scheduled");
  assert.equal(created.startAt, "2030-01-01T00:00:00.000Z");
  const read = await call("get", `/${created.id}`).expect(200);
  assert.deepEqual(read.body.data, created);
  const listed = await call("get", "").expect(200);
  assert.deepEqual(listed.body.data, [created]);
  assert.deepEqual(listed.body.meta.pagination, { limit: 20, nextCursor: null });

  const patched = await call("patch", `/${created.id}`).send({ name: "New" }).expect(200);
  assert.equal(patched.body.data.name, "New");

  const deleted = await call("delete", `/${created.id}`).expect(200);
  assert.equal(deleted.body.data, null);
  const gone = await call("get", `/${created.id}`).expect(404);
  assert.equal(gone.body.error.code, "NOT_FOUND");
});

test("invalid input is a 400 with field details", async () => {
  await rejects(call("post", ""), "name");
  await rejects(call("post", "").send(body({ endAt: "2029-01-01T00:00:00Z" })), "endAt");
  await rejects(call("post", "").send(body({ name: { $ne: null } })), "name.$ne");
  await rejects(
    call("post", "").send(
      body({ targetType: "products", targetIds: ["gid://shopify/Product/1", "junk"] })
    ),
    "targetIds.1"
  );
  assert.equal(await collection().countDocuments(), 0);

  const { id } = await create();
  await rejects(call("get", "/nope"), "id");
  await rejects(call("patch", `/${id}`).send({}), "body");
  await rejects(call("patch", `/${id}`).send({ shop: B }), "body");
  await rejects(call("patch", `/${id}`).send({ name: { $ne: null } }), "name.$ne");
  await rejects(call("patch", `/${id}`).send({ targetIds: ["junk"] }), "targetIds.0");
  await rejects(call("patch", `/${id}`).send({ endAt: "2029-01-01T00:00:00Z" }), "endAt");
  // Same value as stored, or alongside a valid change: still rejected.
  for (const change of [{ type: "fixed" }, { type: "evergreen", name: "x" }]) {
    await rejects(call("patch", `/${id}`).send(change), "type");
  }

  for (const [query, field] of [
    ["q[$ne]=x", "q[$ne]"],
    ["q=a&q=b", "q"],
    ["q=a%00b", "q"],
    [`q=${"x".repeat(101)}`, "q"],
    ["limit=0", "limit"],
    ["limit=51", "limit"],
    ["sort=name", "sort"],
    ["cursor=nonsense", "cursor"],
    [`cursor=${"a".repeat(201)}`, "cursor"],
  ]) {
    await rejects(call("get", `?${query}`), field);
  }
});

test("unknown and server-owned fields are stripped; PATCH applies no defaults", async () => {
  const owned = {
    shop: B,
    _id: "a".repeat(24),
    createdAt: "2000-01-01T00:00:00Z",
    sortAt: "2000-01-01T00:00:00Z",
    status: "expired",
    extra: 1,
  };
  const created = await create({
    ...owned,
    enabled: false,
    description: "Hurry",
    urgencyEffect: "none",
  });
  const patched = await call("patch", `/${created.id}`)
    .send({ ...owned, name: "New" })
    .expect(200);
  const { data } = patched.body;
  assert.equal(data.id, created.id);
  assert.notEqual(data.id, owned._id);
  assert.equal(data.createdAt, created.createdAt);
  assert.equal(data.status, "disabled");
  assert.equal(data.description, "Hurry");
  assert.equal(data.urgencyEffect, "none");
  const stored = await collection().findOne();
  assert.equal(stored.shop, A);
  assert.deepEqual(stored.sortAt, stored.startAt);
  assert.equal(stored.extra, undefined);
});

test("another shop's timer is a 404 and is not listed", async () => {
  const { id } = await create();
  await call("get", `/${id}`, B).expect(404);
  await call("patch", `/${id}`, B).send({ name: "stolen" }).expect(404);
  await call("delete", `/${id}`, B).expect(404);
  const listed = await call("get", `?shop=${A}`, B).expect(200);
  assert.deepEqual(listed.body.data, []);
  const mine = await call("get", `/${id}`).expect(200);
  assert.equal(mine.body.data.name, "Sale");
});

test("every route needs a session token", async () => {
  const id = "a".repeat(24);
  for (const [method, path] of [
    ["get", ""],
    ["post", ""],
    ["get", `/${id}`],
    ["patch", `/${id}`],
    ["delete", `/${id}`],
  ]) {
    const response = await request(server)[method](`/api/timers${path}`).expect(401);
    assert.equal(response.body.error.code, "UNAUTHORIZED");
  }
});

test("list pagination meta, search and sort", async () => {
  for (const day of [2, 1, 3]) {
    await create({ name: `d${day}`, startAt: `2030-01-0${day}T00:00:00Z` });
  }
  const first = await call("get", "?limit=2&sort=newest").expect(200);
  assert.deepEqual(first.body.data.map((t) => t.name), ["d3", "d2"]);
  const { limit, nextCursor } = first.body.meta.pagination;
  assert.equal(limit, 2);
  const second = await call("get", `?limit=2&sort=newest&cursor=${nextCursor}`).expect(200);
  assert.deepEqual(second.body.data.map((t) => t.name), ["d1"]);
  assert.equal(second.body.meta.pagination.nextCursor, null);
  const found = await call("get", "?q=D2").expect(200);
  assert.deepEqual(found.body.data.map((t) => t.name), ["d2"]);
  for (const q of ["", "%20%20"]) {
    assert.equal((await call("get", `?q=${q}`).expect(200)).body.data.length, 3);
  }
});

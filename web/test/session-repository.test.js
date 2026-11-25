import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Session } from "@shopify/shopify-api";
import { connect, disconnect } from "../src/db/connection.js";
import { up } from "../migrations/001-session-indexes.js";
import { deleteSessionsByShop, sessionStorage as storage } from "../src/repositories/sessionRepository.js";

const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const collection = () => mongoose.connection.db.collection("shopify_sessions");

const full = () =>
  new Session({
    id: `offline_${A}`,
    shop: A,
    state: "state-1",
    isOnline: true,
    scope: "read_products,write_products",
    expires: new Date("2030-01-01T00:00:00.123Z"),
    accessToken: "shpat_test",
    refreshToken: "shprt_test",
    refreshTokenExpires: new Date("2030-06-01T00:00:00.456Z"),
    onlineAccessInfo: {
      expires_in: 3600,
      associated_user_scope: "read_products",
      associated_user: { id: 42, first_name: "A", email: "a@example.com" },
    },
  });

let replSet;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("sessions"));
  await up(mongoose.connection.db);
});
after(async () => {
  await disconnect();
  await replSet?.stop();
});
beforeEach(() => collection().deleteMany({}));

test("round-trips every field, including both token dates", async () => {
  const session = full();
  assert.equal(await storage.storeSession(session), true);
  const loaded = await storage.loadSession(session.id);
  assert.ok(loaded instanceof Session);
  assert.deepEqual(loaded, session);
  assert.ok(loaded.refreshTokenExpires instanceof Date);
  assert.equal(await storage.loadSession("missing"), undefined);
});

test("stores only schema fields", async () => {
  const session = full();
  session.isAdmin = true;
  session._id = "forged";
  await storage.storeSession(session);
  const raw = await collection().findOne({ id: session.id });
  assert.equal(raw.isAdmin, undefined);
  assert.notEqual(raw._id, "forged");
});

test("storing the same id replaces the session", async () => {
  await storage.storeSession(full());
  await storage.storeSession(new Session({ id: `offline_${A}`, shop: A, isOnline: false, state: "s2" }));
  assert.equal(await collection().countDocuments(), 1);
  const loaded = await storage.loadSession(`offline_${A}`);
  assert.deepEqual(loaded, new Session({ id: `offline_${A}`, shop: A, isOnline: false, state: "s2" }));
});

test("concurrent stores of a new id end with one document", async () => {
  await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      storage.storeSession(new Session({ id: "race", shop: A, state: `s${i}`, isOnline: false }))
    )
  );
  assert.equal(await collection().countDocuments({ id: "race" }), 1);
});

test("deletes one and many", async () => {
  for (const id of ["one", "two", "three"]) {
    await storage.storeSession(new Session({ id, shop: A, state: "s", isOnline: false }));
  }
  assert.equal(await storage.deleteSession("one"), true);
  assert.equal(await storage.loadSession("one"), undefined);
  assert.equal(await storage.deleteSessions(["two", "three"]), true);
  assert.equal(await collection().countDocuments(), 0);
});

test("find by shop never returns another shop, and is capped at 100", async () => {
  await storage.storeSession(new Session({ id: "b1", shop: B, state: "s", isOnline: false }));
  for (let i = 0; i < 101; i++) {
    await storage.storeSession(new Session({ id: `a${i}`, shop: A, state: "s", isOnline: false }));
  }
  const found = await storage.findSessionsByShop(A);
  assert.equal(found.length, 100);
  assert.ok(found.every((s) => s instanceof Session && s.shop === A));
  assert.deepEqual(
    (await storage.findSessionsByShop(B)).map((s) => s.id),
    ["b1"]
  );
});

test("operator objects and other non-strings never reach a query", async () => {
  await storage.storeSession(full());
  const op = { $ne: null };
  assert.equal(await storage.loadSession(op), undefined);
  assert.deepEqual(await storage.findSessionsByShop(op), []);
  assert.deepEqual(await storage.findSessionsByShop(""), []);
  assert.equal(await storage.deleteSession(op), false);
  assert.equal(await storage.deleteSessions([op]), false);
  assert.equal(await storage.deleteSessions(op), false);
  assert.equal(await storage.deleteSessions([]), false);
  await assert.rejects(storage.storeSession({ id: op, shop: A }), TypeError);
  await assert.rejects(storage.storeSession({ id: "x", shop: op }), TypeError);
  assert.equal(await collection().countDocuments(), 1);
});

test("deleteSessionsByShop removes all of one shop, past the find cap", async () => {
  for (let i = 0; i < 101; i++) {
    await storage.storeSession(new Session({ id: `a${i}`, shop: A, state: "s", isOnline: false }));
  }
  await storage.storeSession(new Session({ id: "b1", shop: B, state: "s", isOnline: false }));
  for (const bad of [undefined, "", { $ne: null }, [A]]) {
    assert.equal(await deleteSessionsByShop(bad), false);
  }
  assert.equal(await collection().countDocuments(), 102);
  assert.equal(await deleteSessionsByShop(A), true);
  assert.equal(await deleteSessionsByShop(A), true);
  assert.deepEqual(await collection().distinct("shop"), [B]);
  assert.equal(await collection().countDocuments(), 1);
});

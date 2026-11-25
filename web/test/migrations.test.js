import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { up, down } from "../migrations/001-session-indexes.js";
import { migrateDown, migrateUp } from "../scripts/migrate.js";

let replSet;
let client;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  client = await mongoose.mongo.MongoClient.connect(replSet.getUri());
});
after(async () => {
  await client?.close();
  await replSet?.stop();
});

const indexNames = async (db) =>
  (await db.collection("shopify_sessions").indexes()).map((i) => i.name).sort();

test("001: up twice, unique id enforced, down twice", async () => {
  const db = client.db("m001");
  await down(db); // no collection yet
  await up(db);
  await up(db);
  assert.deepEqual(await indexNames(db), ["_id_", "id_1", "shop_1_id_1"]);

  const sessions = db.collection("shopify_sessions");
  await sessions.insertOne({ id: "x", shop: "a.myshopify.com" });
  await assert.rejects(sessions.insertOne({ id: "x", shop: "b.myshopify.com" }), { code: 11000 });

  await down(db);
  await down(db);
  assert.deepEqual(await indexNames(db), ["_id_"]);
});

test("runner: up applies once and records it, down reverses the last", async () => {
  const db = client.db("runner");
  assert.deepEqual(await migrateUp(db), ["001-session-indexes"]);
  assert.deepEqual(await migrateUp(db), []);
  assert.equal(await db.collection("migrations").countDocuments(), 1);
  assert.deepEqual(await indexNames(db), ["_id_", "id_1", "shop_1_id_1"]);

  assert.deepEqual(await migrateDown(db), ["001-session-indexes"]);
  assert.deepEqual(await migrateDown(db), []);
  assert.equal(await db.collection("migrations").countDocuments(), 0);
  assert.deepEqual(await indexNames(db), ["_id_"]);
});

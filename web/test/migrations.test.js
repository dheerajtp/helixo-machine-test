import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { up, down } from "../migrations/001-session-indexes.js";
import { TimerModel } from "../src/models/timer.js";
import * as timerIndexes from "../migrations/002-timer-indexes.js";
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

const indexNames = async (db, name = "shopify_sessions") =>
  (await db.collection(name).indexes()).map((i) => i.name).sort();

const TIMER_INDEXES = [
  "_id_",
  "shop_1__id_-1",
  "shop_1_enabled_1_targetType_1",
  "shop_1_sortAt_1__id_1",
];

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

test("002: up twice, down twice, names match the model's indexes", async () => {
  const db = client.db("m002");
  await timerIndexes.down(db); // no collection yet
  await timerIndexes.up(db);
  await timerIndexes.up(db);
  assert.deepEqual(await indexNames(db, "timers"), TIMER_INDEXES);
  const declared = TimerModel.schema
    .indexes()
    .map(([key]) => Object.entries(key).flat().join("_"));
  assert.deepEqual(["_id_", ...declared].sort(), TIMER_INDEXES);

  await timerIndexes.down(db);
  await timerIndexes.down(db);
  assert.deepEqual(await indexNames(db, "timers"), ["_id_"]);
});

test("runner: up applies once and records it, down reverses the last", async () => {
  const db = client.db("runner");
  assert.deepEqual(await migrateUp(db), ["001-session-indexes", "002-timer-indexes"]);
  assert.deepEqual(await migrateUp(db), []);
  assert.equal(await db.collection("migrations").countDocuments(), 2);
  assert.deepEqual(await indexNames(db), ["_id_", "id_1", "shop_1_id_1"]);
  assert.deepEqual(await indexNames(db, "timers"), TIMER_INDEXES);

  assert.deepEqual(await migrateDown(db), ["002-timer-indexes"]);
  assert.deepEqual(await indexNames(db, "timers"), ["_id_"]);
  assert.deepEqual(await migrateDown(db), ["001-session-indexes"]);
  assert.deepEqual(await migrateDown(db), []);
  assert.equal(await db.collection("migrations").countDocuments(), 0);
  assert.deepEqual(await indexNames(db), ["_id_"]);
});

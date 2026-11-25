import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connect, disconnect, isReady } from "../src/db/connection.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
});

after(async () => {
  await disconnect();
  await replSet?.stop();
});

test("connects, commits a transaction and disconnects", async () => {
  assert.equal(await isReady(), false);
  await connect(replSet.getUri("countdown"));
  assert.equal(await isReady(), true);

  const items = mongoose.connection.db.collection("items");
  await mongoose.connection.transaction(async (session) => {
    await items.insertOne({ n: 1 }, { session });
  });
  assert.equal(await items.countDocuments(), 1);

  await disconnect();
  assert.equal(await isReady(), false);
});

test("retries until disconnect() and never logs the URI", async () => {
  const messages = [];
  let failed;
  const firstFailure = new Promise((resolve) => (failed = resolve));
  const pending = connect("nope://user:leak-password@host", {
    logger: { warn: (message) => (messages.push(message), failed()) },
  });
  await firstFailure;
  await disconnect();
  await pending;
  assert.equal(messages.length, 1);
  assert.ok(!messages[0].includes("leak-password"));
});

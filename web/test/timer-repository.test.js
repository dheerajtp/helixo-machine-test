import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connect, disconnect } from "../src/db/connection.js";
import { up } from "../migrations/002-timer-indexes.js";
import { TimerModel } from "../src/models/timer.js";
import * as repo from "../src/repositories/timerRepository.js";
import { redactShop } from "../src/services/shopDataService.js";

const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const collection = () => mongoose.connection.db.collection("timers");
const T = new Date("2030-01-01T00:00:00.000Z");

const timer = (over = {}) => ({
  name: "Sale",
  type: "fixed",
  startAt: T,
  endAt: new Date("2030-02-01T00:00:00.000Z"),
  targetType: "all",
  appearance: { backgroundColor: "#ff0000" },
  sortAt: T,
  ...over,
});
const id = (doc) => String(doc._id);

let replSet;
before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "8.0.4" },
  });
  await connect(replSet.getUri("timers"));
  await TimerModel.init(); // autoIndex may be on; wait so it cannot race the migration
  await up(mongoose.connection.db);
});
after(async () => {
  await disconnect();
  await replSet?.stop();
});
beforeEach(() => collection().deleteMany({}));

test("create, find, replace and delete", async () => {
  const created = await repo.createTimer(A, timer());
  assert.equal(created.shop, A);
  assert.equal(created.enabled, true);
  assert.equal(created.description, "");
  assert.deepEqual(created.appearance, {
    backgroundColor: "#ff0000",
    size: "medium",
    position: "top",
  });
  assert.equal(created.urgencyEffect, "colorPulse");
  assert.equal(created.urgencyThresholdSeconds, 300);
  assert.deepEqual(await repo.findTimer(A, id(created)), created);

  const updated = await repo.replaceTimer(A, id(created), {
    name: "New",
    endAt: null,
    shop: B,
    type: "evergreen",
    _id: new mongoose.Types.ObjectId(),
    createdAt: new Date(0),
  });
  assert.equal(updated.name, "New");
  assert.equal("endAt" in updated, false);
  assert.equal(updated.shop, A);
  assert.equal(updated.type, "fixed");
  assert.equal(id(updated), id(created));
  assert.deepEqual(updated.createdAt, created.createdAt);

  assert.equal(await repo.deleteTimer(A, id(created)), true);
  assert.equal(await repo.deleteTimer(A, id(created)), false);
  assert.equal(await repo.findTimer(A, id(created)), null);
});

test("create ignores server-owned fields in data, but keeps a given createdAt", async () => {
  const forged = new mongoose.Types.ObjectId();
  const created = await repo.createTimer(
    A,
    timer({ shop: B, _id: forged, isAdmin: true, createdAt: T })
  );
  assert.equal(created.shop, A);
  assert.notEqual(id(created), String(forged));
  assert.equal(created.isAdmin, undefined);
  assert.deepEqual(created.createdAt, T);
});

test("shop A cannot read, replace, delete or list shop B's timer", async () => {
  const theirs = await repo.createTimer(B, timer());
  assert.equal(await repo.findTimer(A, id(theirs)), null);
  assert.equal(await repo.replaceTimer(A, id(theirs), { name: "stolen" }), null);
  assert.equal(await repo.deleteTimer(A, id(theirs)), false);
  assert.deepEqual(await repo.listTimers(A), []);
  assert.deepEqual(await repo.findTimer(B, id(theirs)), theirs);
});

test("pages through ties on sortAt in both orders with no duplicate or gap", async () => {
  const later = new Date("2030-01-02T00:00:00.000Z");
  const all = [];
  for (const sortAt of [later, T, T, T, T, T, later]) {
    all.push(await repo.createTimer(A, timer({ sortAt })));
  }
  await repo.createTimer(B, timer());
  const expected = all
    .toSorted((x, y) => x.sortAt - y.sortAt || id(x).localeCompare(id(y)))
    .map(id);

  for (const [sort, want] of [
    [undefined, expected],
    ["oldest", expected],
    ["newest", expected.toReversed()],
  ]) {
    const seen = [];
    let after;
    for (;;) {
      const page = await repo.listTimers(A, { limit: 2, sort, after });
      if (!page.length) break;
      seen.push(...page.map(id));
      const last = page.at(-1);
      after = { sortAt: last.sortAt, id: id(last) };
    }
    assert.deepEqual(seen, want, String(sort));
  }
});

test("limit defaults to 20 and is capped at 51", async () => {
  await TimerModel.insertMany(Array.from({ length: 60 }, () => ({ ...timer(), shop: A })));
  assert.equal((await repo.listTimers(A)).length, 20);
  assert.equal((await repo.listTimers(A, { limit: 0 })).length, 20);
  assert.equal((await repo.listTimers(A, { limit: -5 })).length, 20);
  assert.equal((await repo.listTimers(A, { limit: 1000 })).length, 51);
});

test("q is a case-insensitive literal substring of name", async () => {
  await repo.createTimer(A, timer({ name: "Big .*( Sale" }));
  await repo.createTimer(A, timer({ name: "Other" }));
  const names = async (q) => (await repo.listTimers(A, { q })).map((t) => t.name);
  assert.deepEqual(await names(".*("), ["Big .*( Sale"]);
  assert.deepEqual(await names("sALe"), ["Big .*( Sale"]);
  assert.deepEqual(await names("^Other"), []);
});

test("operator objects never reach a query", async () => {
  const created = await repo.createTimer(A, timer());
  const op = { $ne: null };
  for (const bad of [op, undefined, "", [A]]) {
    assert.equal(await repo.findTimer(bad, id(created)), null);
    assert.equal(await repo.replaceTimer(bad, id(created), { name: "x" }), null);
    assert.equal(await repo.deleteTimer(bad, id(created)), false);
    assert.deepEqual(await repo.listTimers(bad), []);
    assert.equal(await repo.deleteTimersByShop(bad), false);
    await assert.rejects(repo.createTimer(bad, timer()), TypeError);
  }
  for (const bad of [op, "abc", "z".repeat(24), [id(created)], created._id]) {
    assert.equal(await repo.findTimer(A, bad), null);
    assert.equal(await repo.replaceTimer(A, bad, { name: "x" }), null);
    assert.equal(await repo.deleteTimer(A, bad), false);
    assert.deepEqual(await repo.listTimers(A, { after: { sortAt: T, id: bad } }), []);
  }
  assert.deepEqual(await repo.listTimers(A, { after: { sortAt: op, id: id(created) } }), []);
  assert.equal((await repo.listTimers(A, { q: op })).length, 1);
  await assert.rejects(repo.replaceTimer(A, id(created), { name: op }), { name: /Error/ });
  assert.deepEqual(await repo.findTimer(A, id(created)), created);
});

test("schema rejects out-of-range values on create and on replace", async () => {
  const created = await repo.createTimer(A, timer());
  const bad = [
    { name: "x".repeat(101) },
    { targetType: "some" },
    { targetIds: Array.from({ length: 101 }, (_, i) => `gid://shopify/Product/${i}`) },
    { durationSeconds: 59 },
    { durationSeconds: 2592001 },
    { description: "x".repeat(121) },
    { appearance: { backgroundColor: "red" } },
    { appearance: { size: "small" } },
    { appearance: { backgroundColor: "#000000", size: "huge" } },
    { appearance: { backgroundColor: "#000000", position: "left" } },
    { urgencyEffect: "shake" },
    { urgencyThresholdSeconds: -1 },
    { urgencyThresholdSeconds: 86401 },
  ];
  for (const over of bad) {
    const label = JSON.stringify(over).slice(0, 60);
    await assert.rejects(repo.createTimer(A, timer(over)), { name: "ValidationError" }, label);
    await assert.rejects(repo.replaceTimer(A, id(created), over), { name: "ValidationError" }, label);
  }
  await assert.rejects(repo.createTimer(A, timer({ type: "other" })), { name: "ValidationError" });
  await assert.rejects(repo.createTimer(A, timer({ sortAt: undefined })), {
    name: "ValidationError",
  });
  await assert.rejects(repo.replaceTimer(A, id(created), { name: null }), { name: "ValidationError" });
  assert.deepEqual(await repo.findTimer(A, id(created)), created);
});

test("redactShop (shop/redact) removes the shop's timers and spares another shop's", async () => {
  await repo.createTimer(A, timer());
  await repo.createTimer(A, timer());
  await repo.createTimer(B, timer());
  await redactShop(A);
  await redactShop(A);
  assert.deepEqual(await collection().distinct("shop"), [B]);
  assert.equal(await collection().countDocuments(), 1);
});

test("the list query uses the {shop, sortAt, _id} index without a blocking sort", async (t) => {
  await TimerModel.insertMany(
    Array.from({ length: 50 }, (_, i) => ({ ...timer(), shop: i % 2 ? A : B }))
  );
  const [first] = await repo.listTimers(A, { limit: 1 });
  const plans = [];
  mongoose.set("debug", (_collection, method, filter, options) => {
    if (method === "find") plans.push({ filter, options });
  });
  const after = { sortAt: first.sortAt, id: id(first) };
  try {
    for (const args of [{}, { sort: "newest" }, { after }, { sort: "newest", after }, { q: "sa" }]) {
      await repo.listTimers(A, args);
    }
  } finally {
    mongoose.set("debug", false);
  }
  assert.equal(plans.length, 5);
  for (const { filter, options } of plans) {
    const { queryPlanner } = await collection()
      .find(filter, { sort: options.sort, limit: options.limit, projection: options.projection })
      .explain();
    const plan = JSON.stringify(queryPlanner.winningPlan);
    t.diagnostic(plan.match(/"(stage|indexName|direction)":"[^"]+"/g).join(" "));
    assert.match(plan, /"indexName":"shop_1_sortAt_1__id_1"/);
    assert.doesNotMatch(plan, /"stage":"(SORT|COLLSCAN)"/);
  }
});

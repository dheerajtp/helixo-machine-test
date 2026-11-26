import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connect, disconnect } from "../src/db/connection.js";
import * as service from "../src/services/timerService.js";

const A = "shop-a.myshopify.com";
const B = "shop-b.myshopify.com";
const collection = () => mongoose.connection.db.collection("timers");
const START = "2030-01-01T00:00:00.000Z";
const END = "2030-02-01T00:00:00.000Z";
const PRODUCT = "gid://shopify/Product/1";
const COLLECTION = "gid://shopify/Collection/2";
const KEYS = [
  "id", "name", "type", "enabled", "startAt", "endAt", "durationSeconds", "targetType",
  "targetIds", "description", "appearance", "urgencyEffect", "urgencyThresholdSeconds",
  "createdAt", "updatedAt", "status",
];

const fixed = (over = {}) => ({
  name: "Sale",
  type: "fixed",
  startAt: START,
  endAt: END,
  targetType: "all",
  appearance: { backgroundColor: "#ff0000" },
  ...over,
});
const evergreen = (over = {}) =>
  fixed({ type: "evergreen", startAt: undefined, endAt: undefined, durationSeconds: 600, ...over });

// Matches a Joi error or an AppError that names the field.
const rejectsField = (field) => (error) => {
  assert.ok(error.isJoi || error.code === "VALIDATION_ERROR", String(error));
  const fields = error.details.map((d) => d.field ?? d.path.join("."));
  assert.ok(fields.includes(field), `${field} not in ${fields}`);
  return true;
};
const notFound = { code: "NOT_FOUND", message: "Timer not found" };

let replSet;
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
beforeEach(() => collection().deleteMany({}));

test("status in each state and at both boundaries; disabled wins", () => {
  const timer = { type: "fixed", enabled: true, startAt: new Date(START), endAt: new Date(END) };
  const at = (iso, offset = 0) => service.computeStatus(timer, new Date(Date.parse(iso) + offset));
  assert.equal(at(START, -1), "scheduled");
  assert.equal(at(START), "active");
  assert.equal(at(END, -1), "active");
  assert.equal(at(END), "expired");
  assert.equal(service.computeStatus({ type: "evergreen", enabled: true }), "active");
  for (const now of [new Date(0), new Date(START), new Date(END)]) {
    assert.equal(service.computeStatus({ ...timer, enabled: false }, now), "disabled");
  }
  assert.equal(service.computeStatus({ type: "evergreen", enabled: false }), "disabled");
});

test("create applies defaults, strips server fields and returns exactly the public keys", async () => {
  const created = await service.createTimer(A, {
    ...evergreen({ name: "  <b>Sale</b>  ", targetIds: [PRODUCT] }),
    shop: B,
    _id: "a".repeat(24),
    sortAt: new Date(0),
    createdAt: new Date(0),
    status: "expired",
  });
  assert.deepEqual(Object.keys(created), KEYS);
  assert.equal(created.name, "<b>Sale</b>");
  assert.equal(created.enabled, true);
  assert.equal(created.description, "");
  assert.deepEqual(created.targetIds, []);
  assert.deepEqual(created.appearance, {
    backgroundColor: "#ff0000",
    size: "medium",
    position: "top",
  });
  assert.equal(created.startAt, null);
  assert.equal(created.status, "active");
  const stored = await collection().findOne();
  assert.equal(stored.shop, A);
  assert.notEqual(String(stored._id), "a".repeat(24));
  assert.deepEqual(stored.sortAt, stored.createdAt);
  assert.ok(stored.createdAt > new Date(0));
});

test("each field and cross-field rule", async () => {
  const bad = [
    [fixed({ name: undefined }), "name"],
    [fixed({ name: "   " }), "name"],
    [fixed({ name: "a\u0000b" }), "name"],
    [fixed({ name: "x".repeat(101) }), "name"],
    [fixed({ description: "a\nb" }), "description"],
    [fixed({ type: "other" }), "type"],
    [fixed({ startAt: undefined }), "startAt"],
    [fixed({ endAt: undefined }), "endAt"],
    [fixed({ endAt: START }), "endAt"],
    [fixed({ endAt: "2029-01-01T00:00:00Z" }), "endAt"],
    [fixed({ startAt: "2030-01-01T00:00:00" }), "startAt"],
    [fixed({ startAt: "2030-01-01" }), "startAt"],
    [fixed({ endAt: "2030-02-30T00:00:00Z" }), "endAt"],
    [fixed({ endAt: "2030-13-01T00:00:00Z" }), "endAt"],
    [fixed({ startAt: 1893456000000 }), "startAt"],
    [fixed({ durationSeconds: 600 }), "durationSeconds"],
    [evergreen({ durationSeconds: undefined }), "durationSeconds"],
    [evergreen({ durationSeconds: 59 }), "durationSeconds"],
    [evergreen({ durationSeconds: 2592001 }), "durationSeconds"],
    [evergreen({ durationSeconds: 60.5 }), "durationSeconds"],
    [evergreen({ startAt: START }), "startAt"],
    [evergreen({ endAt: END }), "endAt"],
    [fixed({ targetType: "products" }), "targetIds"],
    [fixed({ targetType: "products", targetIds: [] }), "targetIds"],
    [fixed({ targetType: "products", targetIds: [COLLECTION] }), "targetIds.0"],
    [fixed({ targetType: "collections", targetIds: [PRODUCT] }), "targetIds.0"],
    [fixed({ targetType: "products", targetIds: ["gid://shopify/Product/x"] }), "targetIds.0"],
    [fixed({ targetType: "products", targetIds: [PRODUCT, PRODUCT] }), "targetIds.1"],
    [
      fixed({
        targetType: "products",
        targetIds: Array.from({ length: 101 }, (_, i) => `gid://shopify/Product/${i}`),
      }),
      "targetIds",
    ],
    [fixed({ appearance: undefined }), "appearance"],
    [fixed({ appearance: { size: "small" } }), "appearance.backgroundColor"],
    [fixed({ appearance: { backgroundColor: "#fff" } }), "appearance.backgroundColor"],
    [fixed({ urgencyThresholdSeconds: 1.5 }), "urgencyThresholdSeconds"],
  ];
  for (const [input, field] of bad) {
    await assert.rejects(service.createTimer(A, input), rejectsField(field), JSON.stringify(input));
  }
  await assert.rejects(service.createTimer(A, undefined), { name: "ValidationError" });
  assert.equal(await collection().countDocuments(), 0);

  const offset = await service.createTimer(A, fixed({ startAt: "2030-01-01T05:30+05:30" }));
  assert.deepEqual(offset.startAt, new Date(START));
});

test("PATCH validates the merged timer and recomputes sortAt", async () => {
  const { id } = await service.createTimer(
    A,
    fixed({ appearance: { backgroundColor: "#ff0000", size: "large" } })
  );
  await assert.rejects(
    service.updateTimer(A, id, { endAt: "2029-12-31T00:00:00Z" }),
    rejectsField("endAt")
  );
  await assert.rejects(service.updateTimer(A, id, { startAt: END }), rejectsField("endAt"));
  await assert.rejects(
    service.updateTimer(A, id, { durationSeconds: 600 }),
    rejectsField("durationSeconds")
  );
  await assert.rejects(service.updateTimer(A, id, { appearance: "red" }), rejectsField("appearance"));
  await assert.rejects(service.updateTimer(A, id, { type: "evergreen" }), rejectsField("type"));

  const moved = await service.updateTimer(A, id, {
    type: "fixed",
    startAt: "2030-01-15T00:00:00Z",
    appearance: { position: "bottom" },
  });
  assert.deepEqual(moved.appearance, {
    backgroundColor: "#ff0000",
    size: "large",
    position: "bottom",
  });
  assert.deepEqual(moved.endAt, new Date(END));
  assert.deepEqual((await collection().findOne()).sortAt, moved.startAt);
});

test("PATCH switches the target type", async () => {
  const { id } = await service.createTimer(A, evergreen());
  const { sortAt } = await collection().findOne();
  await assert.rejects(
    service.updateTimer(A, id, { targetType: "products" }),
    rejectsField("targetIds")
  );
  await service.updateTimer(A, id, { targetType: "products", targetIds: [PRODUCT] });
  await assert.rejects(
    service.updateTimer(A, id, { targetType: "collections" }),
    rejectsField("targetIds.0")
  );
  const all = await service.updateTimer(A, id, { targetType: "all" });
  assert.deepEqual(all.targetIds, []);
  assert.equal(all.durationSeconds, 600);
  assert.deepEqual((await collection().findOne()).sortAt, sortAt);
});

test("a missing timer or another shop's is not found", async () => {
  const theirs = await service.createTimer(B, fixed());
  for (const id of [theirs.id, "a".repeat(24), "nope"]) {
    await assert.rejects(service.getTimer(A, id), notFound);
    await assert.rejects(service.updateTimer(A, id, { name: "stolen" }), notFound);
    await assert.rejects(service.deleteTimer(A, id), notFound);
  }
  assert.deepEqual((await service.listTimers(A)).timers, []);
  assert.deepEqual(await service.getTimer(B, theirs.id), theirs);
  await service.deleteTimer(B, theirs.id);
  await assert.rejects(service.getTimer(B, theirs.id), notFound);
});

test("list pages with an opaque cursor in both orders", async () => {
  const days = [3, 1, 2, 1, 5];
  for (const day of days) {
    await service.createTimer(A, fixed({ name: `d${day}`, startAt: `2030-01-0${day}T00:00:00Z` }));
  }
  for (const [sort, want] of [
    ["oldest", [1, 1, 2, 3, 5]],
    ["newest", [5, 3, 2, 1, 1]],
  ]) {
    const seen = [];
    let cursor;
    do {
      const page = await service.listTimers(A, { limit: 2, cursor, sort });
      assert.equal(page.limit, 2);
      assert.deepEqual(Object.keys(page.timers[0]), KEYS);
      seen.push(...page.timers);
      cursor = page.nextCursor;
      if (cursor) assert.match(cursor, /^[\w-]+$/);
    } while (cursor);
    assert.deepEqual(seen.map((t) => t.name), want.map((d) => `d${d}`));
    assert.equal(new Set(seen.map((t) => t.id)).size, days.length);
  }
  const exact = await service.listTimers(A, { limit: days.length });
  assert.equal(exact.nextCursor, null);
  assert.equal((await service.listTimers(A)).limit, 20);
  assert.equal((await service.listTimers(A, { limit: 1000 })).limit, 50);
  assert.equal((await service.listTimers(A, { q: "D5" })).timers.length, 1);
});

test("a malformed cursor is a validation error", async () => {
  const encode = (value) => Buffer.from(value).toString("base64url");
  const bad = [
    "",
    "!!!",
    encode("nonsense"),
    encode(`not-a-date|${"a".repeat(24)}`),
    encode(`${START}|short`),
    { $ne: null },
  ];
  for (const cursor of bad) {
    await assert.rejects(service.listTimers(A, { cursor }), rejectsField("cursor"));
  }
});

test("a new or changed start may not be in the past", async () => {
  const now = new Date("2027-03-10T12:00:00.000Z");
  const at = (minutes) => new Date(now.getTime() + minutes * 60_000).toISOString();
  const create = (startAt, clock = now) => service.createTimer(A, fixed({ startAt }), clock);

  await create(at(0));
  await create(at(1));
  await create(at(-1));
  for (const startAt of [at(-5), at(-24 * 60)]) {
    await assert.rejects(create(startAt), rejectsField("startAt"));
  }
  assert.equal(await collection().countDocuments(), 3);

  const { id } = await create(at(-30 * 24 * 60), new Date(at(-30 * 24 * 60)));
  const update = (patch) => service.updateTimer(A, id, patch, now);
  await update({ name: "Renamed" });
  await update({ enabled: false });
  await update({ enabled: true, startAt: at(-30 * 24 * 60) });
  await assert.rejects(update({ startAt: at(-31 * 24 * 60) }), rejectsField("startAt"));
  await assert.rejects(update({ startAt: at(-5) }), rejectsField("startAt"));
  await update({ startAt: at(5) });
});

test("the real clock is used when none is passed", async () => {
  const startAt = new Date(Date.now() - 5 * 60_000).toISOString();
  await assert.rejects(service.createTimer(A, fixed({ startAt })), rejectsField("startAt"));
});

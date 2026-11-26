import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connect, disconnect } from "../src/db/connection.js";
import * as repo from "../src/repositories/timerRepository.js";
import { buildTargets, syncTargets } from "../src/services/targetSyncService.js";

const A = "shop-a.myshopify.com";
const START = new Date("2030-01-01T00:00:00Z");
const END = new Date("2030-02-01T00:00:00Z");
const NOTHING_SPECIFIC = { v: 1, rules: [{ t: "all", ids: [], s: null, e: null }] };

const timer = (over = {}) => ({
  name: "Sale",
  type: "fixed",
  startAt: START,
  endAt: END,
  targetType: "all",
  targetIds: [],
  appearance: { backgroundColor: "#ff0000" },
  sortAt: START,
  ...over,
});
const targeted = (targetType, kind, ids) => ({
  targetType,
  targetIds: ids.map((n) => `gid://shopify/${kind}/${n}`),
});

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
beforeEach(() => mongoose.connection.db.collection("timers").deleteMany({}));

test("one rule per target type, with numeric ids and epoch seconds", () => {
  const value = buildTargets([
    timer(),
    timer(targeted("products", "Product", [1, 2])),
    timer({
      type: "evergreen",
      startAt: undefined,
      endAt: undefined,
      ...targeted("collections", "Collection", [3]),
    }),
  ]);
  const window = { s: 1893456000, e: 1896134400 };
  assert.deepEqual(value, {
    v: 1,
    rules: [
      { t: "all", ids: [], ...window },
      { t: "products", ids: ["1", "2"], ...window },
      { t: "collections", ids: ["3"], s: null, e: null },
    ],
  });
});

test("more than 100 rules or 60 KB falls back to every product", () => {
  assert.equal(buildTargets(Array(100).fill(timer())).rules.length, 100);
  assert.deepEqual(buildTargets(Array(101).fill(timer())), NOTHING_SPECIFIC);
  const ids = Array.from({ length: 100 }, (_, n) => `${10_000_000_000_000 + n}`);
  const large = timer(targeted("products", "Product", ids));
  assert.deepEqual(buildTargets(Array(40).fill(large)), NOTHING_SPECIFIC);
});

// Records the written values; `respond` decides what each mutation does.
function fakeClient(respond = async () => ({ data: { metafieldsSet: { userErrors: [] } } })) {
  const writes = [];
  return {
    writes,
    request: async (_operation, { variables, signal }) => {
      if (!variables) return { data: { currentAppInstallation: { id: "gid://x/1" } } };
      writes.push(variables.metafields[0]);
      return respond(signal);
    },
  };
}

async function run(client, options) {
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };
  await syncTargets(A, { getClient: async () => client, requestId: "r1", logger, ...options });
  return warnings;
}

test("writes only this shop's enabled, unexpired timers", async () => {
  await repo.createTimer(A, timer(targeted("products", "Product", [1])));
  await repo.createTimer(A, timer({ enabled: false }));
  await repo.createTimer(
    A,
    timer({ startAt: new Date("2020-01-01"), endAt: new Date("2020-02-01") })
  );
  await repo.createTimer("shop-b.myshopify.com", timer());
  const client = fakeClient();
  assert.deepEqual(await run(client), []);
  const [{ value, ...metafield }] = client.writes;
  assert.deepEqual(metafield, {
    ownerId: "gid://x/1",
    namespace: "countdown",
    key: "targets",
    type: "json",
  });
  assert.deepEqual(
    JSON.parse(value).rules.map((r) => r.ids),
    [["1"]]
  );
});

test("userErrors count as failure: retried once, then logged by type only", async () => {
  const client = fakeClient(async () => ({
    data: { metafieldsSet: { userErrors: [{ code: "APP_NOT_AUTHORIZED" }] } },
  }));
  assert.deepEqual(await run(client), [
    [{ requestId: "r1", errorType: "UserErrors" }, "Targeting sync failed"],
  ]);
  assert.equal(client.writes.length, 2);
});

test("a retry that succeeds logs nothing", async () => {
  let calls = 0;
  const client = fakeClient(async () => {
    if (++calls === 1) throw new Error("network");
    return { data: { metafieldsSet: { userErrors: [] } } };
  });
  assert.deepEqual(await run(client), []);
  assert.equal(client.writes.length, 2);
});

test("a hanging write is aborted on each attempt", async () => {
  // The interval keeps the process alive: AbortSignal.timeout's own timer is unref'd.
  const alive = setInterval(() => {}, 1000);
  const client = fakeClient(
    (signal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)))
  );
  const warnings = await run(client, { timeoutMs: 20 });
  clearInterval(alive);
  assert.equal(client.writes.length, 2);
  assert.equal(warnings.length, 1);
});

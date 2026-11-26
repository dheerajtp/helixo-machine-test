import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchTimer } from "../src/logic/api.js";
import { fixedEndMs, remainingSeconds } from "../src/logic/time.js";

const SERVER = Date.parse("2030-01-15T12:00:00.000Z");
const timer = {
  id: "665f1c2e9b1e8a0012345678",
  type: "fixed",
  endAt: "2030-01-15T13:00:00.000Z",
  description: "Ends soon",
  appearance: { backgroundColor: "#ff0000", size: "medium", position: "top" },
  urgencyEffect: "colorPulse",
  urgencyThresholdSeconds: 300,
  serverNow: new Date(SERVER).toISOString(),
};

const reply = (data = timer, { status = 200, date } = {}) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: date ? { date } : {},
  });

// Each step is a Response factory; the last one repeats.
function fakeFetch(...steps) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    return steps[Math.min(calls.length, steps.length) - 1](options);
  };
  return { fetch, calls };
}

const run = (fetch, extra) => fetchTimer({ productId: 1, fetch, now: () => SERVER, ...extra });

test("requests the proxy path with no-cache and omits empty collectionIds", async () => {
  const { fetch, calls } = fakeFetch(() => reply());
  assert.deepEqual(await run(fetch), { timer, offsetMs: 0 });
  assert.equal(calls[0].url, "/apps/countdown/timer?productId=1");
  assert.equal(calls[0].options.cache, "no-cache");
});

test("sends at most 50 numeric collection ids", async () => {
  const { fetch, calls } = fakeFetch(() => reply());
  await run(fetch, { collectionIds: ["x", "", ...Array.from({ length: 60 }, (_, i) => i + 1)] });
  const ids = calls[0].url.split("collectionIds=")[1].split(",");
  assert.equal(ids.length, 50);
  assert.equal(ids[0], "1");
});

test("corrects drift in both directions, preferring the Date header", async () => {
  for (const drift of [-90_000, 90_000]) {
    const clientNow = SERVER + drift;
    const { fetch } = fakeFetch(() =>
      reply({ ...timer, serverNow: "2000-01-01T00:00:00Z" }, { date: new Date(SERVER).toUTCString() })
    );
    const { offsetMs } = await run(fetch, { now: () => clientNow });
    assert.equal(offsetMs, -drift);
    assert.equal(remainingSeconds(fixedEndMs(timer.endAt, offsetMs), clientNow), 3600);
  }
});

test("falls back to serverNow without a Date header", async () => {
  const { fetch } = fakeFetch(() => reply());
  assert.equal((await run(fetch, { now: () => SERVER - 5000 })).offsetMs, 5000);
});

test("returns null without retrying for no timer, 4xx and bad responses", async () => {
  const bad = [
    () => reply(null),
    () => reply(timer, { status: 400 }),
    () => reply(timer, { status: 429 }),
    () => new Response("<html>"),
    () => new Response("null"),
    () => new Response(JSON.stringify({ success: false, data: timer })),
    () => reply({ ...timer, endAt: "soon" }),
    () => reply({ ...timer, type: "evergreen" }),
    () => reply({ ...timer, appearance: null }),
    () => reply({ ...timer, appearance: { ...timer.appearance, backgroundColor: "red" } }),
    () => reply({ ...timer, description: 5 }),
  ];
  for (const step of bad) {
    const { fetch, calls } = fakeFetch(step);
    assert.equal(await run(fetch), null);
    assert.equal(calls.length, 1);
  }
});

test("retries once after a 5xx or network error", async () => {
  const failures = [
    () => reply(null, { status: 503 }),
    () => {
      throw new TypeError("Failed to fetch");
    },
  ];
  for (const fail of failures) {
    const recovers = fakeFetch(fail, () => reply());
    assert.equal((await run(recovers.fetch)).timer.id, timer.id);

    const down = fakeFetch(fail);
    assert.equal(await run(down.fetch), null);
    assert.equal(down.calls.length, 2);
  }
});

test("aborts a hung request and retries once", async () => {
  const { fetch, calls } = fakeFetch(
    ({ signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)))
  );
  // The pending abort timer is the only thing keeping the event loop alive here, as intended.
  assert.equal(await run(fetch, { timeoutMs: 10 }), null);
  assert.equal(calls.length, 2);
});

test("never rejects on unusable input", async () => {
  assert.equal(await fetchTimer(), null);
  assert.equal(await fetchTimer({ productId: 1, collectionIds: null }), null);
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
let server;
let createWidget;

// Vite loads the entry because it imports CSS and JSX, which Node cannot.
before(async () => {
  server = await createServer({
    configFile: path("../vite.config.js"),
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    appType: "custom",
    logLevel: "silent",
  });
  ({ createWidget } = await server.ssrLoadModule("/src/index.js"));
});
after(() => server.close());

const START = Date.parse("2026-01-01T00:00:00Z");
const timer = (overrides) => ({
  id: "t1",
  type: "fixed",
  endAt: new Date(START + 3000).toISOString(),
  description: "Sale",
  appearance: { backgroundColor: "#000000", size: "medium", position: "top" },
  urgencyEffect: "colorPulse",
  urgencyThresholdSeconds: 2,
  ...overrides,
});

function setup(data = timer(), { fetch, draw } = {}) {
  const env = { clock: START, requests: 0, draws: [], intervals: new Map(), listeners: {} };
  let nextId = 0;
  const slot = { dataset: { productId: "1", collectionIds: "2,3" } };
  const root = (...slots) => ({ querySelectorAll: () => slots });
  const scope = {
    fetch: async (...args) => {
      env.requests += 1;
      if (fetch) return fetch(...args);
      return new Response(JSON.stringify({ success: true, data }));
    },
    setInterval: (fn) => (env.intervals.set(++nextId, fn), nextId),
    clearInterval: (id) => env.intervals.delete(id),
    document: {
      ...root(slot),
      addEventListener: (name, fn) => (env.listeners[name] = fn),
    },
  };
  const widget = createWidget(scope, {
    now: () => env.clock,
    draw: draw ?? ((target, props) => env.draws.push([target, props])),
  });
  const tickAt = (ms) => {
    env.clock = START + ms;
    [...env.intervals.values()].forEach((tick) => tick());
  };
  return { env, widget, slot, root, tickAt };
}

test("two blocks share one request", async () => {
  const { env, widget, slot } = setup();
  const second = { dataset: { ...slot.dataset } };
  await Promise.all([widget.mount(slot), widget.mount(second), widget.mount(slot)]);
  assert.equal(env.requests, 1);
  assert.equal(env.intervals.size, 2);
});

test("counts down from the clock, then clears the slot and the interval at zero", async () => {
  // serverNow keeps the clock offset at zero.
  const { env, widget, slot, tickAt } = setup(timer({ serverNow: new Date(START).toISOString() }));
  await widget.mount(slot);
  assert.equal(env.draws.at(-1)[1].parts.seconds, 3);
  assert.equal(env.draws.at(-1)[1].urgent, false);
  tickAt(2500);
  assert.equal(env.draws.at(-1)[1].parts.seconds, 1);
  assert.equal(env.draws.at(-1)[1].urgent, true);
  tickAt(3000);
  assert.equal(env.draws.at(-1)[1], null);
  assert.equal(env.intervals.size, 0);
});

test("an already finished timer draws no countdown and leaves no interval", async () => {
  const { env, widget, slot } = setup(timer({ endAt: "2020-01-01T00:00:00Z" }));
  await widget.mount(slot);
  assert.deepEqual(env.draws.map(([, props]) => props), [null]);
  assert.equal(env.intervals.size, 0);
});

test("no timer or a failed request draws nothing", async () => {
  for (const options of [{}, { fetch: async () => new Response("", { status: 404 }) }]) {
    const { env, widget, slot } = setup(null, options);
    await widget.mount(slot);
    assert.equal(env.draws.length, 0);
    assert.equal(env.intervals.size, 0);
  }
});

test("a rendering failure is swallowed and stops the ticking", async () => {
  const { env, widget, slot } = setup(timer(), {
    draw: () => {
      throw new Error("render");
    },
  });
  await widget.mount(slot);
  assert.equal(env.intervals.size, 0);
});

test("theme editor unload and load remount without a second request", async () => {
  const { env, widget, slot, root } = setup(timer({ type: "evergreen", durationSeconds: 60 }));
  widget.start();
  await widget.mount(slot);
  await new Promise(setImmediate);
  assert.equal(env.intervals.size, 1);

  env.listeners["shopify:section:unload"]({ target: root(slot) });
  assert.equal(env.intervals.size, 0);
  assert.equal(env.draws.at(-1)[1], null);

  env.listeners["shopify:section:load"]({ target: root(slot) });
  await new Promise(setImmediate);
  assert.equal(env.intervals.size, 1);
  assert.equal(env.draws.at(-1)[1].parts.minutes, 1);
  assert.equal(env.requests, 1);
});

test("a slot unloaded while loading is never drawn into again", async () => {
  const { env, widget, slot } = setup();
  const pending = widget.mount(slot);
  widget.unmount(slot);
  await pending;
  assert.deepEqual(env.draws.map(([, props]) => props), [null]);
  assert.equal(env.intervals.size, 0);
});

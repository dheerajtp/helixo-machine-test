import { test } from "node:test";
import assert from "node:assert/strict";
import { watchImpression } from "../src/logic/impression.js";

const TIMER = "665f1c2e9b1e8a0012345678";

const storage = (values = new Map()) => ({
  values,
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
});

function page({ session = storage(), fetch, observer = true, ...extra } = {}) {
  const sent = [];
  const observers = [];
  let uuids = 0;
  class Observer {
    constructor(callback) {
      this.connected = true;
      this.show = (isIntersecting = true) => this.connected && callback([{ isIntersecting }]);
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.connected = false;
    }
  }
  const scope = {
    sessionStorage: session,
    crypto: { randomUUID: () => `uuid-${++uuids}` },
    fetch: (url, init) => {
      sent.push({ url, ...init, body: JSON.parse(init.body) });
      return fetch ? fetch() : Promise.resolve(new Response(null, { status: 202 }));
    },
    IntersectionObserver: observer ? Observer : undefined,
    ...extra,
  };
  return { scope, sent, observers, session };
}

test("sends once, only when the timer becomes visible", () => {
  const { scope, sent, observers } = page();
  watchImpression(scope, {}, TIMER);
  watchImpression(scope, {}, TIMER);
  observers[0].show(false);
  assert.equal(sent.length, 0);
  observers[0].show();
  observers[0].show();
  observers[1].show();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "/apps/countdown/impressions");
  assert.equal(sent[0].method, "POST");
  assert.equal(sent[0].keepalive, true);
  assert.equal(sent[0].headers["Content-Type"], "application/json");
  assert.deepEqual(sent[0].body, { timerId: TIMER, sessionId: "uuid-1" });
});

test("a later page in the session does not resend, and keeps the session id", () => {
  const first = page({ observer: false });
  watchImpression(first.scope, {}, TIMER);
  const second = page({ observer: false, session: first.session });
  watchImpression(second.scope, {}, TIMER);
  assert.equal(second.sent.length, 0);
  watchImpression(second.scope, {}, "other");
  assert.equal(second.sent[0].body.sessionId, first.sent[0].body.sessionId);
});

test("stopping before it is visible sends nothing", () => {
  const { scope, sent, observers } = page();
  watchImpression(scope, {}, TIMER)();
  observers[0].show();
  assert.equal(sent.length, 0);
});

test("the theme editor sends nothing", () => {
  const { scope, sent, observers } = page({ Shopify: { designMode: true } });
  watchImpression(scope, {}, TIMER);
  assert.equal(observers.length, 0);
  assert.equal(sent.length, 0);
});

// Last: blocked storage falls back to a map that outlives the test.
test("blocked storage keeps one id in memory, and failures are swallowed", async () => {
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  const { scope, sent } = page({
    session: blocked,
    observer: false,
    fetch: () => Promise.reject(new Error("offline")),
  });
  watchImpression(scope, {}, "blocked-1");
  watchImpression(scope, {}, "blocked-1");
  watchImpression(scope, {}, "blocked-2");
  assert.equal(sent.length, 2);
  assert.equal(sent[0].body.sessionId, sent[1].body.sessionId);

  assert.doesNotThrow(() => {
    watchImpression({}, {}, "no-fetch");
    watchImpression(page({ fetch: () => { throw new Error("sync"); }, observer: false }).scope, {}, "sync");
  });
  await new Promise(setImmediate);
});

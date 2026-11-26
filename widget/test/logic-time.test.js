import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedEndMs, remainingSeconds, splitTime, isUrgent } from "../src/logic/time.js";
import { evergreenEndMs } from "../src/logic/evergreen.js";
import { textColor } from "../src/logic/color.js";

const storage = () => {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
};

test("remaining time rounds up and stops at zero on expiry", () => {
  const end = fixedEndMs("2030-01-01T00:00:00Z", 0);
  assert.equal(remainingSeconds(end, end - 1500), 2);
  assert.equal(remainingSeconds(end, end), 0);
  assert.equal(remainingSeconds(end, end + 5000), 0);
});

test("splits into days, hours, minutes and seconds", () => {
  assert.deepEqual(splitTime(90061), { days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual(splitTime(0), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("urgent only inside the threshold and before expiry", () => {
  assert.deepEqual(
    [301, 300, 1, 0].map((s) => isUrgent(s, 300)),
    [false, true, true, false]
  );
  assert.equal(isUrgent(1, 0), false);
});

test("evergreen hides after expiry and restarts in the next session", () => {
  const timer = { id: "a", durationSeconds: 60 };
  const scope = { localStorage: storage(), sessionStorage: storage() };

  assert.equal(evergreenEndMs(timer, scope, 1000), 61_000);
  assert.equal(evergreenEndMs(timer, scope, 30_000), 61_000);
  assert.equal(evergreenEndMs(timer, scope, 90_000), 61_000);

  scope.sessionStorage = storage();
  assert.equal(evergreenEndMs(timer, scope, 100_000), 160_000);
});

test("evergreen keeps a running countdown across sessions, then hides in that session", () => {
  const timer = { id: "b", durationSeconds: 60 };
  const scope = { localStorage: storage(), sessionStorage: storage() };
  evergreenEndMs(timer, scope, 1000);

  scope.sessionStorage = storage();
  assert.equal(evergreenEndMs(timer, scope, 30_000), 61_000);
  assert.equal(evergreenEndMs(timer, scope, 70_000), 61_000);
});

test("evergreen replaces a corrupt or future start", () => {
  for (const value of ["junk", "-5", "Infinity", "999999999"]) {
    const scope = { localStorage: storage(), sessionStorage: storage() };
    scope.localStorage.setItem("countdown-timer:c", value);
    scope.sessionStorage.setItem("countdown-timer:c", "1");
    assert.equal(evergreenEndMs({ id: "c", durationSeconds: 60 }, scope, 1000), 61_000);
  }
});

test("evergreen uses memory when storage is blocked or full", () => {
  const blocked = {
    get localStorage() {
      throw new Error("SecurityError");
    },
    get sessionStorage() {
      throw new Error("SecurityError");
    },
  };
  assert.equal(evergreenEndMs({ id: "d", durationSeconds: 60 }, blocked, 1000), 61_000);
  assert.equal(evergreenEndMs({ id: "d", durationSeconds: 60 }, blocked, 90_000), 61_000);

  const full = () => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  });
  const scope = { localStorage: full(), sessionStorage: full() };
  assert.equal(evergreenEndMs({ id: "e", durationSeconds: 60 }, scope, 1000), 61_000);
  assert.equal(evergreenEndMs({ id: "e", durationSeconds: 60 }, scope, 5000), 61_000);
});

test("text color is the higher-contrast of black and white", () => {
  assert.equal(textColor("#000000"), "#ffffff");
  assert.equal(textColor("#FFFFFF"), "#000000");
  assert.equal(textColor("#ffff00"), "#000000");
  assert.equal(textColor("#0000ff"), "#ffffff");
  // Mid tones, either side of the crossover.
  assert.equal(textColor("#767676"), "#000000");
  assert.equal(textColor("#707070"), "#ffffff");
});

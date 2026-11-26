import { test } from "node:test";
import assert from "node:assert/strict";
import { tiles, timeLeftLabel } from "../src/ui/format.js";

const parts = (days, hours, minutes, seconds) => ({ days, hours, minutes, seconds });

test("tiles are padded, and days hide when zero", () => {
  assert.deepEqual(
    tiles(parts(2, 14, 9, 33)).map((t) => `${t.value} ${t.label}`),
    ["02 Days", "14 Hours", "09 Mins", "33 Secs"]
  );
  assert.deepEqual(
    tiles(parts(0, 0, 4, 59)).map((t) => t.value),
    ["00", "04", "59"]
  );
  assert.equal(tiles(parts(120, 0, 0, 0))[0].value, "120");
});

test("the screen reader label ignores seconds", () => {
  assert.equal(timeLeftLabel(parts(2, 1, 9, 33)), "Time left: 2 days, 1 hour, 9 minutes");
  assert.equal(timeLeftLabel(parts(0, 0, 4, 59)), timeLeftLabel(parts(0, 0, 4, 0)));
  assert.equal(timeLeftLabel(parts(0, 0, 0, 41)), "Time left: less than a minute");
});

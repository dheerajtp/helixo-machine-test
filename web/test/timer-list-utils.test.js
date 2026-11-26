import { test } from "node:test";
import assert from "node:assert/strict";
import {
  durationText,
  scheduleLines,
  statusBadge,
  targetText,
} from "../frontend/utils/timerFormat.js";
import { afterDelete, firstPage, nextPage, previousPage } from "../frontend/utils/cursorStack.js";

test("target text counts products and collections", () => {
  assert.equal(targetText({ targetType: "all", targetIds: [] }), "All products");
  assert.equal(targetText({ targetType: "products", targetIds: ["a", "b", "c"] }), "3 products");
  assert.equal(targetText({ targetType: "products", targetIds: ["a"] }), "1 product");
  assert.equal(targetText({ targetType: "collections", targetIds: ["a", "b"] }), "2 collections");
});

test("duration text joins the non-zero units", () => {
  assert.equal(durationText(60), "1 minute");
  assert.equal(durationText(1800), "30 minutes");
  assert.equal(durationText(5400), "1 hour 30 minutes");
  assert.equal(durationText(2592000), "30 days");
  assert.equal(durationText(90061), "1 day 1 hour 1 minute 1 second");
});

test("schedule shows start and end for fixed, duration for evergreen", () => {
  const fixed = {
    type: "fixed",
    startAt: "2026-06-01T00:00:00.000Z",
    endAt: "2026-06-30T23:59:00.000Z",
  };
  assert.deepEqual(scheduleLines(fixed, { locale: "en-US", timeZone: "UTC" }), [
    "Start: Jun 1, 2026, 12:00 AM",
    "End: Jun 30, 2026, 11:59 PM",
  ]);
  // Converted to the given time zone, not shown as UTC.
  assert.match(scheduleLines(fixed, { locale: "en-US", timeZone: "Asia/Kolkata" })[0], /5:30 AM/);
  assert.deepEqual(scheduleLines({ type: "evergreen", durationSeconds: 1800 }), [
    "30 minutes per visitor",
  ]);
});

test("status badge has a word and tone for every status", () => {
  for (const status of ["active", "scheduled", "expired", "disabled"]) {
    const badge = statusBadge(status);
    assert.ok(badge.label && badge.tone);
  }
  assert.equal(statusBadge("active").label, "Active");
});

test("cursor stack goes forward and back", () => {
  let state = firstPage();
  state = nextPage(state, "c1");
  state = nextPage(state, "c2");
  assert.deepEqual(state, { cursor: "c2", previous: [null, "c1"] });
  state = previousPage(state);
  assert.deepEqual(state, { cursor: "c1", previous: [null] });
  state = previousPage(state);
  assert.deepEqual(state, firstPage());
  assert.deepEqual(previousPage(state), firstPage());
});

test("deleting the last row of a later page goes back one page", () => {
  const second = nextPage(firstPage(), "c1");
  assert.deepEqual(afterDelete(second, 1), firstPage());
  assert.deepEqual(afterDelete(second, 2), second);
  assert.deepEqual(afterDelete(firstPage(), 1), firstPage());
});

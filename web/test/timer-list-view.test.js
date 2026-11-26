import { test } from "node:test";
import assert from "node:assert/strict";
import { listView, shouldRetry } from "../frontend/utils/listView.js";

const base = { isLoading: false, isError: false, hasData: true, isPreviousData: false, count: 0, q: "", onFirstPage: true };
const view = (changes) => listView({ ...base, ...changes });

test("list view picks one state", () => {
  assert.equal(view({ isLoading: true, hasData: false }), "loading");
  assert.equal(view({ isError: true, hasData: false }), "error");
  assert.equal(view({ count: 2 }), "table");
  assert.equal(view({}), "first");
  assert.equal(view({ q: "xmas" }), "noMatch");
  assert.equal(view({ onFirstPage: false }), "noMatch");
});

test("empty rows from the previous query are not shown as an answer", () => {
  assert.equal(view({ isPreviousData: true, q: "xmasx" }), "pending");
  assert.equal(view({ isPreviousData: true }), "pending");
});

test("a failed refetch keeps the cached rows", () => {
  assert.equal(view({ isError: true, count: 2 }), "table");
});

test("retries only network and server errors, twice at most", () => {
  assert.ok(shouldRetry(0, { status: 0 }));
  assert.ok(shouldRetry(1, { status: 503 }));
  assert.ok(!shouldRetry(2, { status: 503 }));
  for (const status of [400, 401, 403, 404, 429]) assert.ok(!shouldRetry(0, { status }), String(status));
});

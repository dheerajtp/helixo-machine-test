import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../frontend/api/client.js";
import { createTimersApi } from "../frontend/api/timers.js";
import { impressionTotals } from "../frontend/utils/impressionTotals.js";

test("stats are asked for in one request with comma-separated ids", async () => {
  const calls = [];
  const data = [{ timerId: "a", total: 3, last7Days: [] }];
  const api = createTimersApi(
    createClient({
      fetch: async (url, init) => {
        calls.push({ url, ...init });
        return Response.json({ success: true, data });
      },
      getToken: async () => "token",
    })
  );
  const { signal } = new AbortController();
  assert.deepEqual((await api.getTimerStats(["a", "b"], { signal })).data, data);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/timers/stats?ids=a%2Cb");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].signal, signal);
});

test("totals are empty while loading or failed, and keep a real zero", () => {
  const data = { data: [{ timerId: "a", total: 0 }, { timerId: "b", total: 5 }] };
  assert.deepEqual(impressionTotals({ data: undefined, isError: false }), {});
  // Cached counts from before a failed refetch are not shown.
  assert.deepEqual(impressionTotals({ data, isError: true }), {});
  assert.deepEqual(impressionTotals({ data, isError: false }), { a: 0, b: 5 });
});

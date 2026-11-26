import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createClient } from "../frontend/api/client.js";
import { createTimersApi } from "../frontend/api/timers.js";

const META = { requestId: "r1" };
const ok = (data) => Response.json({ success: true, message: "OK", data, meta: META });

// Records every call; respond() builds a fresh Response (or throws) for each one.
function setup(respond = () => ok([])) {
  const calls = [];
  const redirects = [];
  let tokens = 0;
  const request = createClient({
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      return respond();
    },
    getToken: async () => `token-${++tokens}`,
    redirect: (url) => redirects.push(url),
  });
  return { api: createTimersApi(request), request, calls, redirects };
}

const rejectsWith = (promise, expected) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof ApiError);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(error[key], value, key);
    return true;
  });

test("sends a fresh session token with every request and passes the signal", async () => {
  const { api, calls } = setup();
  const { signal } = new AbortController();
  await api.listTimers({}, { signal });
  await api.listTimers();
  assert.deepEqual(
    calls.map((call) => call.headers.Authorization),
    ["Bearer token-1", "Bearer token-2"]
  );
  assert.equal(calls[0].signal, signal);
});

test("unwraps the success envelope into data and meta", async () => {
  const { api } = setup(() => ok([{ id: "1" }]));
  assert.deepEqual(await api.listTimers(), { data: [{ id: "1" }], meta: META });
});

test("builds the query string and omits empty values", async () => {
  const { api, calls } = setup();
  await api.listTimers({ limit: 20, cursor: null, q: "a&b c", sort: undefined });
  await api.listTimers({ q: "" });
  assert.deepEqual(
    calls.map((call) => call.url),
    ["/api/timers?limit=20&q=a%26b+c", "/api/timers"]
  );
});

test("update sends JSON with PATCH; delete sends no body", async () => {
  const { api, calls } = setup(() => ok(null));
  await api.updateTimer("abc", { enabled: false });
  await api.deleteTimer("a/b");
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, "/api/timers/abc");
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.equal(calls[0].body, '{"enabled":false}');
  assert.equal(calls[1].method, "DELETE");
  assert.equal(calls[1].url, "/api/timers/a%2Fb");
  assert.equal(calls[1].body, undefined);
  assert.equal(calls[1].headers["Content-Type"], undefined);
});

test("maps the error envelope to ApiError", async () => {
  const details = [{ field: "q", message: "too long" }];
  const { api, redirects } = setup(() =>
    Response.json(
      {
        success: false,
        message: "Validation failed",
        error: { code: "VALIDATION_ERROR", details },
        meta: META,
      },
      { status: 400 }
    )
  );
  await rejectsWith(api.listTimers(), {
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details,
  });
  assert.deepEqual(redirects, []);
});

test("network failure, token failure and non-JSON responses are ApiError too", async () => {
  const offline = setup(() => {
    throw new TypeError("fetch failed");
  });
  await rejectsWith(offline.api.listTimers(), { status: 0, code: "NETWORK_ERROR", details: [] });

  const noToken = createClient({ getToken: () => Promise.reject(new Error("no app bridge")) });
  await rejectsWith(noToken("/api/timers"), { status: 0, code: "NETWORK_ERROR" });

  for (const status of [200, 502]) {
    const html = setup(() => new Response("<html></html>", { status }));
    await rejectsWith(html.api.listTimers(), { status, code: "INVALID_RESPONSE" });
  }
});

test("an abort stays an AbortError", async () => {
  const { api } = setup(() => {
    throw new DOMException("aborted", "AbortError");
  });
  await assert.rejects(api.listTimers(), { name: "AbortError" });
});

test("403 with the re-authorize header redirects the top window", async () => {
  const url = "/api/auth?shop=demo.myshopify.com";
  const { api, redirects } = setup(
    () =>
      new Response(null, {
        status: 403,
        headers: { "X-Shopify-API-Request-Failure-Reauthorize-Url": url },
      })
  );
  await rejectsWith(api.listTimers(), { status: 403, code: "REAUTHORIZE" });
  assert.deepEqual(redirects, [url]);
});

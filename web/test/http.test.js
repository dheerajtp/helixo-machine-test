import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import Joi from "joi";
import request from "supertest";
import { asyncHandler } from "../src/http/asyncHandler.js";
import { errorHandler, notFound } from "../src/http/errorHandler.js";
import { AppError, ERROR_STATUS } from "../src/http/errors.js";
import { createLogger, requestLogger } from "../src/http/logger.js";
import { requestId } from "../src/http/requestId.js";
import { sendSuccess } from "../src/http/responses.js";
import { validate } from "../src/http/validate.js";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

const lines = [];
const logger = createLogger({ write: (line) => lines.push(JSON.parse(line)) });

const body = Joi.object({ name: Joi.string(), count: Joi.number() });
const echo = (req, res) => sendSuccess(res, { message: "OK", data: req.validated });

const app = express();
app.use(requestId, requestLogger(logger));
app.use(express.json({ limit: "1kb" }));
app.get("/api/ok", (_req, res) =>
  sendSuccess(res, { message: "OK", pagination: { limit: 20, nextCursor: "x" } })
);
app.post("/api/items", validate({ body }), echo);
app.patch("/api/items", validate({ body }), echo);
app.get(
  "/api/items/:id",
  validate({
    params: Joi.object({ id: Joi.number().required() }),
    query: Joi.object({ limit: Joi.number().default(20) }),
    headers: Joi.object({ "x-shop": Joi.string().required() }),
  }),
  echo
);
app.get(
  "/api/app-error/:code",
  asyncHandler(async (req) => {
    throw new AppError(req.params.code, "Nope", [{ field: "a", message: "b" }]);
  })
);
app.get(
  "/api/crash",
  asyncHandler(async () => {
    throw Object.assign(new Error("db said no"), { keyValue: "private-value" });
  })
);
app.get("/api/partial", (_req, res, next) => {
  res.write("partial");
  next(new Error("late"));
});
app.use("/api", notFound);
app.use(errorHandler(logger));

let server;
before(async () => {
  server = app.listen(0);
  await once(server, "listening");
});
after(() => server.close());
const api = () => request(server);

const errorOf = (response, status, code) => {
  assert.equal(response.status, status);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, code);
  assert.match(response.body.meta.requestId, UUID);
  assert.equal("data" in response.body, false);
  return response.body.error.details;
};

test("success envelope", async () => {
  const response = await api().get("/api/ok").expect(200);
  assert.deepEqual(response.body, {
    success: true,
    message: "OK",
    data: null,
    meta: {
      requestId: response.headers["x-request-id"],
      pagination: { limit: 20, nextCursor: "x" },
    },
  });
});

test("AppError takes its status from the code table; INTERNAL is made generic", async () => {
  for (const [code, status] of Object.entries(ERROR_STATUS)) {
    const response = await api().get(`/api/app-error/${code}`);
    const details = errorOf(response, status, code);
    assert.equal(response.body.message, code === "INTERNAL" ? "Something went wrong" : "Nope");
    assert.equal(details.length, code === "INTERNAL" ? 0 : 1);
  }
  assert.throws(() => new AppError("NOPE", "x"), TypeError);
});

test("unknown errors give a generic 500 and are logged with the stack only", async () => {
  lines.length = 0;
  const response = await api().get("/api/crash");
  errorOf(response, 500, "INTERNAL");
  assert.ok(!response.text.includes("db said no"));
  const logged = lines.find((line) => line.msg === "Unhandled error");
  assert.match(logged.err.stack, /db said no/);
  assert.equal(logged.requestId, response.body.meta.requestId);
  assert.ok(!JSON.stringify(lines).includes("private-value"));
});

test("headers already sent: delegates to the default handler", async () => {
  await assert.rejects(async () => await api().get("/api/partial"));
});

test("not found and body-parser errors", async () => {
  errorOf(await api().get("/api/missing"), 404, "NOT_FOUND");
  const json = () => api().post("/api/items").type("json");
  errorOf(await json().send("{bad"), 400, "VALIDATION_ERROR");
  errorOf(await json().send({ name: "x".repeat(2000) }), 413, "PAYLOAD_TOO_LARGE");
  errorOf(await json().set("Content-Encoding", "nope").send("{}"), 400, "VALIDATION_ERROR");
  errorOf(await api().get("/api/items/%E0%A4%A"), 400, "VALIDATION_ERROR");
});

test("validation strips unknown fields, converts, and reports each field", async () => {
  const ok = await api().post("/api/items").send({ name: "a", count: "2", isAdmin: true });
  assert.deepEqual(ok.body.data, { body: { name: "a", count: 2 } });

  const bad = await api().post("/api/items").send({ name: 1, count: "x" });
  const details = errorOf(bad, 400, "VALIDATION_ERROR");
  assert.deepEqual(details.map((d) => d.field), ["name", "count"]);
  assert.ok(details.every((d) => d.message));
});

test("validation covers params, query and headers, allowing unknown headers", async () => {
  const ok = await api().get("/api/items/7?extra=1").set("X-Shop", "demo").set("X-Other", "1");
  assert.deepEqual(ok.body.data, {
    params: { id: 7 },
    query: { limit: 20 },
    headers: { "x-shop": "demo" },
  });
  const details = errorOf(await api().get("/api/items/abc?limit=z"), 400, "VALIDATION_ERROR");
  assert.deepEqual(details.map((d) => d.field), ["id", "limit", "x-shop"]);
});

test("operator and dotted keys are rejected at any depth", async () => {
  for (const input of [{ $where: "1" }, { name: { $ne: null } }, { x: [{ "a.b": 1 }] }]) {
    errorOf(await api().post("/api/items").send(input), 400, "VALIDATION_ERROR");
  }
  errorOf(await api().get("/api/items/1?$gt=1").set("X-Shop", "d"), 400, "VALIDATION_ERROR");
});

test("empty PATCH body is rejected, including one with only unknown fields", async () => {
  for (const input of [undefined, {}, { unknown: 1 }]) {
    errorOf(await api().patch("/api/items").send(input), 400, "VALIDATION_ERROR");
  }
  await api().patch("/api/items").send({ name: "a" }).expect(200);
});

test("request ID: a UUID is kept, anything else is replaced", async () => {
  const id = "3f2b8c1e-9a4d-4e6f-8b2a-1c5d7e9f0a3b";
  const kept = await api().get("/api/ok").set("X-Request-Id", id);
  assert.equal(kept.headers["x-request-id"], id);
  assert.equal(kept.body.meta.requestId, id);

  const replaced = await api().get("/api/ok").set("X-Request-Id", "not-a-uuid");
  assert.match(replaced.headers["x-request-id"], UUID);
});

test("request log has ID, method, path without query, status and duration", async () => {
  lines.length = 0;
  const response = await api().get("/api/ok?token=query-secret");
  const line = lines.find((entry) => entry.msg === "Request completed");
  assert.equal(line.requestId, response.headers["x-request-id"]);
  assert.equal(line.method, "GET");
  assert.equal(line.path, "/api/ok");
  assert.equal(line.status, 200);
  assert.equal(typeof line.durationMs, "number");
  assert.ok(!JSON.stringify(lines).includes("query-secret"));
});

test("secrets are redacted", () => {
  lines.length = 0;
  logger.info({
    password: "s1",
    config: { SHOPIFY_API_SECRET: "s2", MONGO_URI: "s3" },
    req: { headers: { authorization: "s4", cookie: "s5", "x-api-key": "s6" } },
    session: { accessToken: "s7", token: "s8", secret: "s9", apiKey: "s10" },
  });
  assert.ok(!/"s\d+"/.test(JSON.stringify(lines)), JSON.stringify(lines));
});

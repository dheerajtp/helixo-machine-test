import { createHash, timingSafeEqual } from "node:crypto";
import { Counter, Histogram, Registry } from "prom-client";
import { asyncHandler } from "../http/asyncHandler.js";
import { sendError } from "../http/responses.js";

// Hashing gives equal-length inputs for timingSafeEqual.
const digest = (value) => createHash("sha256").update(value).digest();

export function createMetrics(token) {
  const registry = new Registry();
  const labelNames = ["method", "route", "status"];
  // The histogram's _count series is the throughput.
  const duration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames,
    registers: [registry],
  });
  const errors = new Counter({
    name: "http_request_errors_total",
    help: "HTTP responses with status 400 or higher",
    labelNames,
    registers: [registry],
  });
  const expected = digest(`Bearer ${token}`);

  return {
    timer(req, res, next) {
      const end = duration.startTimer();
      res.once("close", () => {
        // Route patterns only: raw paths would create unbounded label values.
        const labels = {
          method: req.method,
          route: req.route ? String(req.route.path) : "unmatched",
          status: res.statusCode,
        };
        end(labels);
        if (res.statusCode >= 400) errors.inc(labels);
      });
      next();
    },
    handler: asyncHandler(async (req, res) => {
      if (!timingSafeEqual(digest(req.get("Authorization") ?? ""), expected)) {
        return sendError(res, { code: "UNAUTHORIZED", message: "Unauthorized" });
      }
      res.type(registry.contentType).send(await registry.metrics());
    }),
  };
}

# 02 — Backend core

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [01](../01-scaffold/00-README.md)

## Goal
- The shared foundation every endpoint uses: config, database, responses, errors, validation, security, health

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| B1 | **Dependencies (approved by approving this plan).** `mongoose`, `joi`, `pino`, `helmet`, `express-rate-limit`, `prom-client`. |
| B2 | **Database (owner approved).** `mongo:8.0` as a single-member replica set `rs0` in the Docker stack `helixo` (only MongoDB runs in the stack), port 27017, named volume, auth with keyfile, restart policy `any` (owner approved 2026-11-26; was on failure, which left an unhealthy database stopped), 1 CPU / 1 GB, ping health check every 10 s. Local tests use it; CI tests use `mongodb-memory-server` (approved dependency). One shared connection, `maxPoolSize` 10, `serverSelectionTimeoutMS` 5000, `maxTimeMS` 2000 default, `w: majority`, `autoIndex` off outside tests. No redundancy: one member only. |
| B3 | **Config.** `web/src/config.js` loads `web/config/.env` with `process.loadEnvFile` if present (existing variables win), validates with Joi at boot and exits on error. |
| B4 | **Responses.** Envelope exactly as rules §17, built only by `sendSuccess`/`sendError`. Error codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `RATE_LIMITED` 429, `INTERNAL` 500, `NOT_READY` 503. |
| B5 | **Validation.** One `validate({body,query,params,headers})` middleware, options as rules §2; empty PATCH body is rejected. `headers` schemas allow unknown headers. |
| B6 | **Middleware.** Request ID (`X-Request-Id`, UUID), pino logs with redaction, helmet with a CSP that still allows Shopify admin framing, JSON body limit 32kb, async wrapper, central error handler. |
| B7 | **Health.** `GET /health`; `GET /ready` pings MongoDB, 503 during shutdown. SIGTERM/SIGINT drain for up to 10 s then close Mongo. `unhandledRejection`/`uncaughtException` log and exit 1. |
| B8 | **Metrics.** `GET /metrics` (prom-client: latency, error count, throughput), protected by a `METRICS_TOKEN` bearer compared in constant time. |
| B9 | **Docker.** Follow `CLAUDE.md` Docker rules: `docker stack deploy -c docker-compose.yml`, env files by volume mapping only (no `env_file`/`environment`). Config (B3) loads the mounted file before validating. |
| B10 | **Compose approval gate.** The owner approves `docker-compose.yml` before it is written. Slices reply BLOCKED if it is not approved. |
| B11 | **No env in scripts.** `web/package.json` scripts stop setting `NODE_ENV` and `cross-env` is removed; `NODE_ENV` defaults to `development`. |
| B12 | **Template demo routes** (`/api/products*`) keep their current response shape until plan 05 removes the demo page. `/metrics` returns Prometheus text, not the envelope. Rate limiting (and `express-rate-limit`) is added in plan 03. |

## Status
- [x] 01 — Config, Docker replica set, Mongo connection
- [x] 02 — Envelope, errors, validation, request ID, logging
- [x] 03 — Security middleware, health, metrics, shutdown, app wiring
- [x] 04 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `docker-compose.yml`, `docker/**`, `.gitignore`, `web/.env.example`, `web/src/config.js`, `web/src/db/**`, `web/test/**`, `web/package.json`, lockfile |
| 02 | 01 | none | Sonnet | `web/src/http/**`, `web/test/**`, `web/package.json`, lockfile |
| 03 | 02 | none | Sonnet | `web/src/app.js`, `web/src/server.js`, `web/src/ops/**`, `web/index.js`, `web/test/**`, `web/package.json`, lockfile |
| 04 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [x] `curl /health` returns 200; `/ready` returns 503 when Mongo is stopped
- [x] Invalid input returns the error envelope with field details (tests only; no real route validates yet)
- [x] Missing env var stops the boot with a clear message
- [x] Ctrl+C closes cleanly (SIGINT, MongoDB unreachable)

# MongoDB + Node.js Backend Engineering Rules

These rules apply to **every** backend change in this project. They are mandatory, not guidelines. A rule may be skipped only with explicit written approval from the project owner, stated in the task or PR.

Keywords: **MUST** / **MUST NOT** = required. **ASK FIRST** = stop and get explicit approval before proceeding.

## 0. Ask-First List

You MUST stop and ask before:

- Renaming, removing, repurposing, resizing, or type-changing any existing database field, or changing its constraints/semantics (see §4).
- Adding a new dependency, or upgrading a major version.
- Changing authentication, authorization, session, or token behavior.
- Changing an existing API response shape, status code, or route path.
- Adding sharding, change streams, time-series collections, geospatial indexes, or Atlas-specific features (see §16).
- Running any data migration or destructive script.
- Anything these rules do not clearly cover and that could affect data, security, or API compatibility.

## 1. Repository First

Before changing backend behavior, you MUST inspect the actual routes, request validation, authentication, authorization, controllers/services, models, MongoDB access layer, indexes, migrations/scripts, queues, integrations, tests, and configuration.

You MUST NOT invent existing endpoints, collections, fields, indexes, middleware, services, or business logic. If something you need does not exist, say so and ask; do not guess.

## 2. Backend Validation — NON-NEGOTIABLE

Every request that carries input (POST, PUT, PATCH, DELETE, and GET query/params) MUST be validated explicitly at the backend **before** business logic, database writes, external calls, queue publication, or event publication.

- **Joi** is the only validation library. Do not add Zod/Ajv/express-validator, and do not hand-roll ad-hoc checks in controllers.
- Validation MUST run through one shared middleware that takes a Joi schema per source (`body`, `query`, `params`, `headers`). Schemas live next to the route, not inside controllers.
- Joi options MUST be `{ abortEarly: false, stripUnknown: true, convert: true }` at minimum; unknown fields are stripped or rejected, never passed through. The validated (sanitized) value, not the raw `req.*`, is what controllers and services receive.
- PATCH/PUT bodies MUST have their own schema (partial updates still whitelist fields; an empty PATCH body is rejected).
- You MUST validate path/query parameters, headers, authentication context, and file metadata as well as the body.
- You MUST reject malformed, oversized, or unsafe input with a consistent 4xx error.
- Frontend validation never replaces backend validation.

## 3. Mongo Injection and Mass Assignment

- You MUST NOT pass `req.body`, `req.query`, or `req.params` directly into a MongoDB filter, update, or aggregation.
- User input MUST be validated to the expected primitive types (string, number, boolean, ObjectId) so operator objects (`$ne`, `$gt`, `$where`, `$regex`, etc.) cannot be injected.
- Updates MUST use an explicit whitelist of fields. Clients MUST NOT be able to set `role`, `isAdmin`, `userId`, `_id`, timestamps, or other server-owned fields.
- `$where` and server-side JavaScript MUST NOT be used.
- User-supplied regex MUST be escaped and length-limited.

## 4. Minimal Correct Change

Make the smallest correct backend change. You MUST reuse existing services, repositories, validators, middleware, error handling, logging, and response conventions.

You MUST NOT duplicate business logic because a new route is requested.

Keep the layering: **routes → controllers → services → repositories**.

- Routes: path, middleware (auth, validation), and the controller binding only.
- Controllers: translate HTTP to a service call and the result to the response envelope (§17). No business logic, no DB access.
- Services: business logic and orchestration. No HTTP objects (`req`/`res`) and no direct MongoDB calls.
- Repositories: the **only** place MongoDB (driver/Mongoose models, queries, aggregations, transactions) is touched. Controllers and services MUST NOT import models or the Mongo client.

## 5. Database Safety

Existing database fields MUST NOT be renamed, removed, repurposed, resized, type-changed, or have their constraints/semantics changed without explicit approval (§0).

- New fields MAY be added when necessary and backward-compatible.
- Before any data change, you MUST inspect existing collections, schema validation, indexes, scripts/migrations, and production assumptions.
- Changes MUST be additive and backward-compatible. Existing data and legacy behavior MUST be preserved unless explicitly changed.
- Migrations MUST be versioned, idempotent, and reversible (a down/rollback step, or a documented reason it cannot be). They MUST be tested against a copy of representative data first.
- Collections MUST have schema validation (Mongoose schema or `$jsonSchema`) as a second line of defence behind API validation.

## 6. MongoDB Schema Design

- Document structure MUST match actual access patterns.
- Embed when lifecycle and cardinality justify it. Reference when there is an independent lifecycle, high cardinality, or unbounded growth.
- You MUST NOT create unbounded arrays or documents that can grow without practical limit (16 MB document cap).
- Indexes MUST come from real query and sort patterns, not speculation. Consider compound-index field order and selectivity.
- Production index builds MUST go through a migration/script, never run implicitly at application startup (disable Mongoose `autoIndex` in production).
- Before adding an index, check its cost: write overhead, memory/storage footprint, and overlap with existing indexes.
- Data with an expiry (sessions, OTPs, reset tokens) MUST use a TTL index.

## 7. Query Safety and Performance

- Queries MUST use projections; do not fetch fields you do not need.
- Large result sets MUST be paginated. Collections that can grow large MUST use cursor/range pagination (on an indexed, unique-ordered field such as `_id`), not `skip`. `limit` MUST have a default and a server-side maximum.
- Queries, cursors, sockets, and operations MUST have timeouts. Expensive operations MUST set `maxTimeMS`.
- You MUST NOT load an entire collection into application memory when a database-side operation exists.
- New or important query patterns MUST be reviewed with `explain()`.
- The app MUST use one shared `MongoClient` per process, with pool size and `serverSelectionTimeoutMS` configured. Never connect per request.

## 8. Consistency and Transactions

- Use transactions only when atomicity across multiple documents/collections is actually required. Do not use them for single-document atomic operations.
- Critical writes MUST use an explicit write concern (`w: "majority"`), and transactions MUST set read/write concern explicitly.
- You MUST understand retry behavior and idempotency before retrying any write.
- You MUST NOT report an external event as successful when the corresponding database state was not durably committed.
- When reliable database-to-event consistency is required, use the outbox/event pattern.

## 9. Concurrency and Idempotency

- Payment, webhook, queue, registration, and any other retry-prone operation MUST be idempotent.
- Uniqueness and race-sensitive operations MUST use unique indexes or atomic update patterns (`findOneAndUpdate`, `$setOnInsert`, upsert).
- You MUST NOT rely on application-level prechecks alone for uniqueness. Handle duplicate-key errors (code 11000) explicitly.

## 10. Authentication and Authorization

- Authentication establishes identity. Authorization MUST verify that this identity may access the requested resource.
- Authorization MUST be enforced server-side for every protected resource and action.
- You MUST NOT rely on frontend route visibility or client-supplied user IDs. Take the user from the verified token/session.
- Horizontal and vertical privilege escalation MUST be prevented (e.g. every resource query is scoped to the owner/tenant).
- JWT/session lifecycle MUST include expiry, revocation or rotation, and abuse protection.
- Login, signup, OTP, and password-reset routes MUST be rate-limited, and repeated failures MUST trigger a temporary account/IP lockout. Reset/OTP tokens MUST be single-use and short-lived. Secret comparison MUST be constant-time (`crypto.timingSafeEqual`).

## 11. Security

- You MUST NOT log or expose passwords, tokens, API keys, payment credentials, private account data, or secrets.
- Passwords MUST be hashed with a modern password-hashing algorithm (argon2id or bcrypt) at a cost suited to the deployment. Never use plain hashes (MD5/SHA-*).
- `helmet` (or equivalent secure headers), explicit CORS origin allowlist (never `*` with credentials), rate limiting, and request-body size limits MUST be configured.
- Uploaded files and externally supplied URLs are untrusted. Outbound requests to user-supplied URLs MUST block internal/private IP ranges and cloud metadata endpoints (SSRF).
- Secrets MUST come from environment/secret manager, never from the repo. A `.env.example` MUST be maintained with no real values.
- Environment variables MUST be validated at boot; the app MUST fail fast on missing or invalid config.

## 12. File Uploads

You MUST validate file size, MIME type, extension, content (magic bytes), filename/path handling, and storage permissions.

- User-controlled filenames or paths MUST NOT be able to cause traversal or overwrite. Generate server-side names.
- Uploaded content MUST NOT be executed or served from an executable location.

## 13. External HTTP and Webhooks

- Outbound HTTP MUST have timeouts and bounded retries.
- Non-2xx responses MUST be handled explicitly.
- Incoming webhooks MUST be authenticated, signature-verified (where the provider supports it), payload-validated, and idempotent.
- Acknowledgement semantics MUST match the provider contract.
- Long-running work MUST NOT run synchronously when the provider requires fast acknowledgement; enqueue it.

## 14. Queues and Background Jobs

- Jobs MUST be retry-safe and idempotent.
- Retries MUST be bounded, with a dead-letter/failure strategy.
- Failed jobs MUST record enough context to diagnose them, without storing secrets.
- Business-critical events MUST support safe replay.

## 15. Redis / Caching

- Redis/cache is an optimization, not the source of truth, unless the architecture explicitly states otherwise.
- Every cache entry MUST have a TTL and a defined invalidation path.
- Cache keys MUST include tenant/user scope so one user's data cannot be served to another.
- Cache outages MUST NOT corrupt or block primary data; fall back to the database.

## 16. Backups, Replica Sets, and Advanced Features

- Production MUST run a replica set with appropriate read/write concerns.
- Production MUST have documented backup and recovery: retention, restore verification, RPO, and RTO.
- Backups do not count as recovery until a restore has been tested.
- Sharding, change streams, time-series collections, geospatial indexes, and Atlas-specific features are ASK FIRST (§0) and need a justified requirement.
- If change streams are used, you MUST manage lifecycle, resume tokens, failure handling, and cleanup.

## 17. API Response Format and Node.js Runtime Practices

### Global response structure

Every API response, success or error, MUST use one shared envelope. Controllers MUST use the shared response helpers; they MUST NOT hand-build response bodies.

Success:

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": {},
  "meta": { "requestId": "uuid", "pagination": { "limit": 20, "nextCursor": "..." } }
}
```

Error:

```json
{
  "success": false,
  "message": "Human-readable summary",
  "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "email", "message": "..." }] },
  "meta": { "requestId": "uuid" }
}
```

- `data` is `null` or omitted on errors; `error` is omitted on success. `pagination` appears only on paginated lists.
- `error.code` is a stable machine-readable string from a shared list; HTTP status codes MUST match the error class (400/401/403/404/409/422/429/5xx).
- Changing this envelope is ASK FIRST (§0).

### Runtime practices

- Async route handlers MUST NOT swallow errors. Wrap every handler in a shared async wrapper (Express 4 does not forward rejected promises).
- A single central error-handling middleware MUST produce the error envelope above. Clients MUST NOT receive stack traces, raw Mongo errors, or internal messages; unknown errors return a generic 500.
- The process MUST handle `unhandledRejection` and `uncaughtException` by logging and exiting; a supervisor restarts it.
- The app MUST shut down gracefully on SIGTERM/SIGINT: stop accepting requests, drain in-flight work, close the Mongo connection and queue workers.
- Request paths MUST NOT use synchronous fs/crypto calls or CPU-heavy work. Offload to worker threads or a queue.
- `/health` (liveness, no dependencies) and `/ready` (readiness, includes MongoDB connectivity) endpoints MUST exist, are unauthenticated, and MUST NOT expose internal details. `/ready` MUST return 503 during shutdown.

## 18. Observability

- Logging MUST be structured. Every request MUST get a request ID (accept a valid incoming `X-Request-Id`, otherwise generate one), return it in the `X-Request-Id` header and `meta.requestId`, and include it in every log line. Jobs and outbound calls MUST propagate it.
- Latency, error rate, throughput, and queue metrics MUST be measured.
- You MUST NOT log sensitive payloads or credentials for debugging.

## 19. Testing

Tests MUST cover: valid and invalid input, authentication, authorization (including accessing another user's resource), duplicate/retry behavior, database interactions, error responses, and important integration paths.

- Database tests MUST run against a real MongoDB (in-memory server or container), not a mocked driver.
- Migrations and data changes MUST be tested against representative data before they run anywhere real.
- A bug fix MUST include a regression test.

## 20. Dependencies and CI/CD

- The lockfile MUST be committed. Install with `npm ci`. The Node version MUST be pinned (`engines` / `.nvmrc`).
- CI MUST run lint, tests, build, and `npm audit` (dependency security check).
- Deployment-affecting configuration changes MUST NOT be made without verifying environment requirements.

## 21. Final Review Checklist

Before declaring work done, you MUST confirm:

- [ ] Only approved files changed (check `git status` and the diff once the project is a git repository).
- [ ] No debug code, `console.log`, or secrets were added.
- [ ] No unrelated refactor or schema change slipped in.
- [ ] Every new input path has backend validation (§2) and is safe from injection/mass assignment (§3).
- [ ] Every new protected route has server-side authorization (§10).
- [ ] New queries have projections, pagination, timeouts, and a supporting index (§6, §7).
- [ ] Retry-prone operations are idempotent (§9).
- [ ] Tests were added and pass.
- [ ] Anything skipped or unverified is stated explicitly in the report.

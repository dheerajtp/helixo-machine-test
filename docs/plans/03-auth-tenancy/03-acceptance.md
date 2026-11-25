# 03/03 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 03/01, 03/02 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| C[0-9] ' docs/plans/03-auth-tenancy/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01 and 02, `docs/runbook.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual check and record commands and output as evidence.
2. `docs/runbook.md`: run `npm run migrate -w shopify-app-template-node` once with MongoDB up (and `down` to reverse); the app must be authorized again because SQLite sessions are gone, and `web/database.sqlite` can be deleted; scope change needs re-approval on the dev store; webhooks are declared in `shopify.app.toml`; the rate limit and its single-instance limit; Shopify's network access declaration is an owner task in the Dev Dashboard (not verified here).
3. Owner steps stay MANUAL. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

**Files changed:** `docs/runbook.md` (new section 7 "Auth, sessions and webhooks"; also fixed a literal `\n\n` in section 5). This file. README checklist and status left for the orchestrator.

Evidence (command + full output per row): `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-03/`.

| Checklist row | Verdict | Evidence file | Tests (exact names) |
| --- | --- | --- | --- |
| `/api/*` without a valid token returns 401 | PASS | `row1-401.txt` | auth.test.js "no token, a non-Bearer header or a bad token is a 401 envelope"; app.test.js "unknown /api route: 404 envelope, only after session validation" |
| A client-sent shop never returns another shop's data | PASS | `row2-client-shop.txt` | auth.test.js "?shop= of another shop never reaches req.shop", "token dest and session shop must match", "a valid token with its shop's session sets req.shop"; session-repository.test.js "find by shop never returns another shop, and is capped at 100" |
| 101st request in a minute is 429; another shop unaffected | PASS | `row3-rate-limit.txt` | auth.test.js "rate limit: the 101st request in a minute is 429, another shop is unaffected" |
| Forged webhook 401; replay has no extra effect | PASS | `row4-webhooks.txt` | webhooks.test.js "a bad HMAC gets 401 on every topic and deletes nothing", "app/uninstalled deletes only that shop's sessions, also when redelivered", "shop/redact deletes only that shop's data, also when redelivered", "shop/redact takes the shop from the signed body, not the header", "customer topics acknowledge and change nothing", "redactShop is safe to run twice" |
| Sessions incl. refresh token round-trip through MongoDB | PASS | `row5-sessions.txt` | session-repository.test.js "round-trips every field, including both token dates" (sets `refreshToken`, `refreshTokenExpires`), "stores only schema fields", "storing the same id replaces the session", "concurrent stores of a new id end with one document" (mongodb-memory-server) |
| MANUAL: migration, reinstall, app loads, survives restart | MANUAL | `row6-7-manual.txt`, `row6-migration-proxy.txt` | Not run (no Docker / real DB / dev store). Proxy: migrations.test.js "001: up twice, unique id enforced, down twice", "runner: up applies once and records it, down reverses the last". Owner steps: runbook §7.1–7.3 |
| MANUAL: uninstall removes the shop's sessions | MANUAL | `row6-7-manual.txt` | Not run on a store. Proxy: webhooks.test.js "app/uninstalled deletes only that shop's sessions, also when redelivered". Owner step: runbook §7.4 |

**Checks**
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (57/57), exit 0 (`verify-slice.txt`)
- Docker and `npm run migrate` were not run (owner tasks, per C8).

**Known issues**
- The web env needs `SCOPES=read_products` where the Shopify CLI does not inject it (documented in runbook §7.3; env file not touched).
- `eslint.config.js` still names the deleted `web/privacy.js` in a `no-unused-vars` override (stale, harmless; outside this slice's scope).
- `app/uninstalled` uses the library handler via `findSessionsByShop`, so it removes at most 100 sessions per delivery; `shop/redact` has no cap.
- Rate limit store is in memory: per process, reset on restart.
- `shopify.app.toml` scopes and webhook subscriptions are not live until `npm run deploy`; not validated by the CLI. Network access declaration in the Dev Dashboard is an owner task, not verified.

### Follow-up: owner checks on the dev store (2026-11-26) — both MANUAL rows PASS
Supersedes the MANUAL rows and "not run" notes above.
- `migrations` collection lists `001-session-indexes`; `shopify_sessions` held one session for the dev store.
- Owner reported: after reinstall and a `npm run dev` restart, the product count still shows.
- After uninstall, `shopify_sessions` returned `[]`.
- Fixed during the checks: `npm run migrate` needs only `MONGO_URI` (`loadDbConfig`, 58/58 tests).
- No consent screen appeared on the dev store.
- `npm run deploy` fails until `application_url` is a hosted URL (replaces the "not live until deploy" note: `npm run dev` delivered `app/uninstalled`).

# 04/04 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 04/01, 04/02, 04/03 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| D[0-9] ' docs/plans/04-timer-api/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01–03, `docs/runbook.md`, `docs/api.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every check and record commands and output as evidence, citing exact test names. "`npm run migrate` is safe to run twice" is proven on `mongodb-memory-server`.
2. `docs/runbook.md`: the owner runs `npm run migrate -w shopify-app-template-node` once to build the timer indexes.
3. Check `docs/api.md` against the routes and validators. List known issues in `## Result`.

## Done when
- Each checklist row has PASS or FAIL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

**Files:** `docs/runbook.md` (new section 8, timer indexes), this file. No code changed.

**Evidence** in `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-04/`, one file per row, each with the command and full output. All tests ran on `mongodb-memory-server` (MongoDB 8.0.4) with a stubbed Shopify library.

| Row | Result | Tests (exact names) | Evidence |
| --- | --- | --- | --- |
| CRUD works and invalid input returns 400 with details | PASS (6/6) | api: "create, read, list, update and delete", "invalid input is a 400 with field details", "list pagination meta, search and sort"; repo: "create, find, replace and delete"; service: "each field and cross-field rule", "PATCH validates the merged timer and recomputes sortAt" | `row1-crud-and-400.txt` |
| Shop A cannot read, change or delete shop B's timer | PASS (4/4) | api: "another shop's timer is a 404 and is not listed", "every route needs a session token"; repo: "shop A cannot read, replace, delete or list shop B's timer"; service: "a missing timer or another shop's is not found" | `row2-tenant-isolation.txt` |
| Status tests cover each state and boundary | PASS (1/1) | service: "status in each state and at both boundaries; disabled wins" (start-1ms scheduled, start active, end-1ms active, end expired, evergreen active, disabled wins) | `row3-status.txt` |
| Operator injection and unknown fields rejected or stripped | PASS (5/5) | api: "invalid input is a 400 with field details" (`name.$ne`, `q[$ne]`, NUL in `q`), "unknown and server-owned fields are stripped; PATCH applies no defaults"; repo: "operator objects never reach a query", "create ignores server-owned fields in data, but keeps a given createdAt"; service: "create applies defaults, strips server fields and returns exactly the public keys" | `row4-injection-unknown-fields.txt` |
| `npm run migrate` is safe to run twice | PASS (3/3), memory server only | "runner: up applies once and records it, down reverses the last" (`migrateUp` from `web/scripts/migrate.js`, second run returns `[]`), "002: up twice, down twice, names match the model's indexes", "001: up twice, unique id enforced, down twice" | `row5-migrate-twice.txt`, `row5-NOTE.txt` |

**Checks:** `tools/verify-slice.sh` exit 0: LINT PASS, TESTS PASS (84 pass, 0 fail, 0 skipped) (`verify-slice.log`).

**Not run:** the `npm run migrate` CLI entry (`main()`: env file and real MongoDB), Docker, any real Shopify session. The owner runs the migration once (runbook section 8).

**`docs/api.md` against routes and validators:** paths, methods and status codes (201 create, 200 others), field rules and defaults, list query (`limit` 1–50 default 20, `cursor` max 200, `q` max 100 with control characters rejected, `sort` default `oldest`, bracketed keys 400), PATCH (`type` forbidden, `appearance` merged, at least one field), 32 KB body limit (413), `$`/`.` keys (400), and the rate limit (100/min per shop, in memory) all match the code. Known issues:
- Minor: "Unknown fields ... are ignored" is true, but a PATCH carrying only unknown fields is a 400 on `body` (at least one known field is required). The doc implies this without saying it.
- Minor: `q` is trimmed, so a whitespace-only `q` behaves like no search. Not documented.
- Resolved since slice 03: `web/src/ops/metrics.js` now labels with the mount path (`/api/timers/:id`), covered by "metrics label timer routes with the full pattern, for success and error responses".

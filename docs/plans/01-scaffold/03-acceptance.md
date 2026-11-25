# 01/03 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 01/01, 01/02 · Parallel with: none

## Decisions you need
All of A1–A6. From the repo root run `grep -E '^\| A[1-6] ' docs/plans/01-scaffold/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`
- The `## Result` sections of slices 01 and 02

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual checklist row and record the command and its output as evidence.
2. Write `docs/runbook.md`: Node 26 setup, `npm ci`, lint, test, build, and the owner's manual steps (install Shopify CLI, `shopify app dev`, install on the dev store, open the app page). Never mention starting containers any way other than `docker stack deploy`.
3. List known issues (audit advisories, template deviations, anything NOT RUN) in `## Result`.
4. Leave manual rows as MANUAL; do not mark them passed.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence.
- `tools/verify-slice.sh` prints both PASS lines.
- Append `## Result`.

## Result
DONE. Not committed. Node 26.0.0, npm 11.12.1.

**Files:** `docs/runbook.md` (new), this file.

**Evidence** (command and full output per file): `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/cb4a560f-f45b-43d9-9e76-89341d2790e0/scratchpad/evidence-01/` (scratchpad; may be cleared on reboot).

**Acceptance checklist**
| Row | Result | Evidence |
| --- | --- | --- |
| `npm ci && npm run lint && npm test && npm run build` pass | PASS | `npm ci` exit 0; `npm run lint` exit 0; `npm test` 1 test, 1 pass, 0 fail; `CI=true npm run build` exit 0 (one-off `CI=true`, as the template build needs it or `SHOPIFY_API_KEY`; `web/frontend/dist/` removed afterwards) |
| `tools/verify-slice.sh` prints PASS | PASS | `LINT: PASS`, `TESTS: PASS`, exit 0 |
| `shopify app dev` installs the app and its page opens | MANUAL | Not run (needs owner login and dev store). Local CLI present: `npx --no-install shopify version` prints `5.1.0`. Steps in `docs/runbook.md` §5 |
| No secret is tracked by git | PASS | Checked `git ls-files` plus `git add -A --dry-run` (63 files). Only env-like files are `web/.env.example` and `web/frontend/.env.example`, names only. Content grep for Shopify tokens (`shpss_`/`shpat_`/`shpca_`/`shppa_`), private keys, AWS/GitHub tokens and `SECRET/API_KEY/TOKEN/PASSWORD=value`: one hit, the `<your-api-key>` placeholder in `web/frontend/vite.config.js`. `git check-ignore` confirms `.env`, `web/.env`, `web/frontend/.env`, `web/database.sqlite` are ignored. `shopify.app.toml` `client_id` is empty |

**Known issues**
- `npm audit --audit-level=high`: FAIL (exit 1), so CI fails at its last step. 12 advisories (7 high, 5 moderate), same as slices 01 and 02: `semver` (via `simple-update-notifier`/`nodemon`; plain `npm audit fix` offered), `decode-uri-component` (via `query-string`/`vi-fetch`), `vite`/`esbuild`, `i18next`, `react-router` (these need `--force`). All template dev/build or frontend dependencies. Not fixed; check not weakened.
- Template deviations (see slice 01 Result): archived template upgraded (CLI 5.1.0, shopify-api 15, Express 5, API version October26); root `build` skips `shopify app build`; REST resources removed; `productCreate` mutation changed but never run against a store.
- ESLint overrides on four template files (slice 02 Result); remove each when its file is rewritten.
- `expiringOfflineAccessTokens` is off; needs an owner decision in plan 03.
- Frontend still on template Polaris 10 with i18n files (plan 05).
- NOT RUN: CI on GitHub (not pushed), `shopify app dev` / store install / app page (MANUAL), authenticated Admin API calls, `shopify app config validate` (needs a linked app).

# 09/03 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 09/01, 09/02 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| I[1-8] ' docs/plans/09-analytics/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01 and 02, `docs/runbook.md`, `docs/api.md`

## Scope (files you own)
This plan folder, `docs/**`

## Tasks
1. Run every non-manual check with evidence. Confirm the widget's request matches the server's validation end to end (same field names, types and path).
2. `docs/runbook.md`: short owner steps: run `npm run migrate -w shopify-app-template-node`, restart `npm run dev`, open a product page in a new session, and see the count rise once; reload does not raise it.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

**Changed:** `docs/runbook.md` (new section 14, owner steps; section 9 step 5 now points to it). Nothing else.

**Checklist** (evidence in `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-09/`)
| Row | Result | Evidence |
| --- | --- | --- |
| Repeating a request counts once (test, including concurrent) | PASS | `01-repeat-counts-once.txt`: web/test/impressions.test.js "a repeat is a 202 that counts once; no personal data is stored" (3 sequential, total 1) and "20 concurrent identical requests count once; 20 sessions count 20" |
| Deleting a timer removes its stats | PASS | `02-delete-removes-stats.txt`: web/test/impressions.test.js "deleting a timer removes its stats and keys; redact removes the shop's" |
| MANUAL: count rises once per new session | MANUAL | `03-manual-new-session.txt`; owner steps in runbook section 14 |

**Contract, widget to server** (`00-contract-widget-server.txt`, script `contract-check.mjs`): the real `watchImpression` with a fake browser sends one `POST /apps/countdown/impressions`, `Content-Type: application/json`, body `{"timerId","sessionId"}` (89 bytes, under the 1 KB limit); that body passes the server's `impressionBody` Joi schema unchanged. `shopify.app.toml` maps `/apps/countdown` to `/proxy`; the route is `POST /proxy/impressions`. `timerId` comes from `String(doc._id)` in the GET payload (24 hex). CONTRACT: PASS.

**Commands**
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (182 tests, 0 fail) — `00-verify-slice.txt`
- `node --test --test-name-pattern=... web/test/impressions.test.js` → 2/2 and 1/1 pass
- `node contract-check.mjs` → CONTRACT: PASS

**Known issues**
- Counts are indicative (I7): the app proxy signs the query, not the body, and visitors can invent session ids; only the 60/minute limit and the unique key protect it.
- A session is one browser tab (`sessionStorage`): a new tab opened by typing the URL counts again.
- No retry: a beacon that fails (network, 429, server down) is lost for that session. Browsers without `crypto.randomUUID` are not counted.
- A timer deleted between the existence check and the write can leave an orphan stats row; a failed stats delete after a timer delete leaves stats behind. Both cleared by shop redact.
- Not checked against a real store: Shopify forwarding `POST` through the app proxy with a valid signature, and the dashboard column against live data. The 003 migration has not been run on any real database.

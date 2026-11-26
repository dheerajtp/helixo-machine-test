# 12/04 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 12/01, 12/02, 12/03 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| L[0-9] ' docs/plans/12-no-gap/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01–03, `docs/runbook.md`

## Scope (files you own)
This plan folder, `docs/**`

## Tasks
1. Run every non-manual check with evidence.
2. `docs/runbook.md`: short owner steps: save any timer once (this writes the data), then check a product with and without a timer; if the gap remains, send the `npm run dev` log line about the sync.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence. Append `## Result`.

## Result

Evidence: `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-12/` (one file per row, plus `00-full-verify.txt`).

Full run: `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (165/165).

| Row | Verdict | Evidence |
| --- | --- | --- |
| Value rebuilt after create, update, delete; failed write does not fail the request | PASS | `row1-sync-rebuilt.txt`: `node --test web/test/timer-api.test.js web/test/target-sync.test.js` 14/14. Tests "targeting is rewritten after create, update and delete, and only then", "a failed targeting write does not fail the request and logs no data", "writes only this shop's enabled, unexpired timers", "userErrors count as failure: retried once, then logged by type only", "a hanging write is aborted on each attempt". |
| MANUAL: no gap without a timer | MANUAL | `row2-no-gap.txt`: widget tests "an unreserved slot is reserved only when a countdown is drawn into it", "a reserved slot keeps its space when there is no timer" pass; CSS hides an unreserved slot. Owner: runbook §13 step 3. |
| MANUAL: targeted product, no jump | MANUAL | `row3-no-jump.txt`: same tests; Liquid adds `cdt-slot--reserve` when a rule matches. Owner: runbook §13 step 2. The widget itself is confirmed working on the owner's dev store (before this plan's theme change). |
| Past start refused by form and API; existing timers editable | PASS | `row4-no-past-start.txt`: 29/29. Service "a new or changed start may not be in the past" and "the real clock is used when none is passed"; form "a new or changed start may not be in the past" and "a new form starts at the next 5-minute mark, so only the end date is needed". The service throws `VALIDATION_ERROR`, mapped to 400 in `web/src/http/errors.js`. |

Docs changed: `docs/runbook.md` — new §13 (owner steps); §9 step 4–5 and §12 step 3 no longer ask for a start in the past.

Known issues:
- No HTTP-level test sends a past `startAt`; the 400 is shown by the service test plus the shared error mapping.
- The date picker's `allow` restriction and the Shopify-side metafield write and Liquid read are unverified until a store run (§13).
- A shop with existing timers has no metafield until its next timer change, so the block reserves space until then (L4).
- The timer request waits for the sync: up to about 6 s extra if Shopify hangs. Concurrent changes can write out of order until the next change.
- A start picked in the current minute and saved at the minute boundary can be refused by the server.
- The theme may still add spacing around `.shopify-app-block`; Shopify page caching can lag `now` at a timer's start or end (L5 covers it).

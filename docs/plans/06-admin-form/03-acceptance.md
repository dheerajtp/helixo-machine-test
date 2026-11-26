# 06/03 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 06/01, 06/02 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| F[0-9] ' docs/plans/06-admin-form/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01 and 02, `docs/runbook.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual check and record evidence. "Server validation errors appear on the right fields" is proven for the mapping by tests; seeing it on screen stays an owner step.
2. `docs/runbook.md`: numbered owner steps for create, edit, picker and errors. Also cover the plan 05 dashboard checks (section 9), now using the form instead of console snippets.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

Evidence folder: `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-06/` (one file per row, plus `00-verify-and-build.txt`).

### Checklist
| Row | Verdict | Evidence |
| --- | --- | --- |
| Create and edit a fixed and an evergreen timer | MANUAL | `01-create-edit-fixed-evergreen.txt`; owner steps in `docs/runbook.md` §10 steps 1–5. Supporting form tests pass. |
| Pick products and collections; selection survives editing | MANUAL | `02-pick-products-collections.txt`; owner steps §10 steps 6–8. Supporting target tests pass. |
| Server validation errors appear on the right fields | PASS (mapping); on screen MANUAL | `03-server-validation-errors.txt`: the real API Joi schemas (`createBody`, `patchBody`) rejected bad create/patch bodies, the details were shaped as `errorHandler.js` does (`path.join(".")`), fed to `serverErrors`, and every mapped key is one the form renders (`errors.<key>`); none fell to the banner. Plus the unit test "server details map to form fields". On screen: §10 step 9. |

### Commands
- `tools/verify-slice.sh` → exit 0, LINT: PASS, TESTS: PASS (116/116).
- `CI=true npm run build` → exit 0 (admin bundle 227.66 kB, 71.59 kB gzipped).
- `node --test web/test/timer-form.test.js web/test/timer-targets.test.js` → 14/14 pass.
- `node <scratchpad>/checks/server-errors-check.mjs <repo>` → RESULT: PASS (3 cases).

### Changed
- `docs/runbook.md`: §9 now creates timers with the form, Edit is enabled, Safari console steps (Cmd+Option+C, frame menu); the console is needed only for paging. New §10: numbered owner steps for open/close and discard, create fixed and evergreen, browser validation, edit, products, collections, server field errors (one-shot `fetch` patch, since the form checks everything the server checks), request error banner, plus the list of things no slice checked in a browser.

### Known issues
- Nothing in plan 06 has run in a browser: layout, Polaris events, modal closing paths, the resource picker and chips are unverified (runbook §10 list).
- Server messages shown under fields are raw Joi text using API names and units, e.g. `"endAt" must be after startAt`, `"urgencyThresholdSeconds" must be ...` (seconds, while the field is minutes). Only reachable when browser validation is bypassed.
- Saved targets show "Product <number>" / "Collection <number>" on edit: no Direct API access in `shopify.app.toml` (changing that needs owner approval).
- `s-modal` cannot veto closing: the discard prompt appears after the modal closes and "Keep editing" reopens it.
- Time is a text field (no Polaris time field); choice lists stack vertically, unlike the image.
- Line breaks in the description are rejected (the API forbids control characters).
- Paging (§9 step 7) still needs 25 timers from a console snippet.

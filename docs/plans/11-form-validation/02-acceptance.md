# 11/02 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Haiku · Prerequisites: 11/01 · Parallel with: none

## Decisions you need
K1–K3 — run `grep -E '^\| K[1-3] ' docs/plans/11-form-validation/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, `## Result` of `01-live-validation.md`, section 10 of `docs/runbook.md`

## Scope (files you own)
`docs/plans/11-form-validation/**`, `docs/runbook.md`

## Tasks
1. Run `tools/verify-slice.sh` and `CI=true npm run build`; record the commands, output and exact test names for the first checklist row.
2. Update section 10 step 4 of `docs/runbook.md` with short owner steps for the two MANUAL rows, including `9:30 pm,` and `23:59 pm`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence. Append `## Result`.

## Result

Evidence (command and full output per row): `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-13/` (files `11-*`). Nothing was run in a browser.

| Checklist row | Verdict | Evidence |
| --- | --- | --- |
| Logic tests cover touched fields, rechecking, end-after-start and time rewriting | PASS | `node --test test/timer-form.test.js` (in `web/`): 18/18 pass, including "leaving untouched fields shows nothing", "a bad value shows its error on leaving, not while typing, and clears when fixed", "a unit change rechecks the duration", "end before start appears once both are complete", "a server error stays until its field changes", "times are rewritten as h:mm AM/PM" (cases `9:30 pm,` and `23:59 pm` kept as typed), "rewriting a time leaves an edit form unchanged and keeps the stored instant". `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (194/194). `CI=true npm run build` (in `web/frontend`) → built, exit 0. Files `11-row1-timer-form.txt`, `11-verify-slice.txt`, `11-build.txt`. |
| MANUAL: leaving a field with a bad value shows its error; fixing it clears the error | MANUAL | `docs/runbook.md` section 10 step 4, "Errors on leaving a field (plan 11)": name, `21:30` → `9:30 PM`, `9:30 pm,`, `23:59 pm`, fix clears, Cancel/X closes on first click. |
| MANUAL: an untouched new form shows no errors | MANUAL | Same paragraph, first step. |

Changed: `docs/runbook.md` section 10 step 4 (one paragraph added). README limitation about submit-only validation removed in the same run (13/03).

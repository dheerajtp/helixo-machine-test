# 13/03 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 13/01, 13/02 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| M[1-5] ' docs/plans/13-hardening/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01 and 02, `README.md`

## Scope (files you own)
This plan folder, `docs/**`, `README.md`

## Tasks
1. Run every non-manual check with evidence.
2. `docs/runbook.md`: short owner steps for backup then restore-verify.
3. `README.md`: update the rate limiting section and the known limitations (ceiling added; backups written but not yet proven until the owner runs them). Mark slice 10/01 in `docs/plans/10-ops-delivery/00-README.md` as done by plan 13.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

Evidence (command and full output per row): `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-13/` (files `13-*`). No Docker and no real database were used.

| Checklist row | Verdict | Evidence |
| --- | --- | --- |
| Rotating `X-Forwarded-For` is stopped at the shop ceiling, another shop unaffected (test) | PASS | `node --test test/proxy-ceiling.test.js` (in `web/`): 5/5 pass, including "timer: rotating X-Forwarded-For hits the shop ceiling, another shop does not", "impression: rotating X-Forwarded-For hits the shop ceiling, another shop does not", "requests refused by the per-shopper limit do not count against the shop", "timer and impression ceilings are counted separately", "default ceilings are 3000 timer and 600 impressions per minute". File `13-row1-ceiling.txt`. |
| Scripts pass a syntax check, print no secrets, fail loudly when the container is not running | PASS | `bash -n` on `tools/*.sh tools/mongo/*.sh` and `node --check tools/mongo/temp-db.js`: all ok. `bash tools/mongo/test.sh` (fakes, no Docker): "all checks passed", including "backup fails when the container is not running", "verify fails when the container is not running", "no credential in output or arguments". File `13-row2-scripts.txt`. |
| MANUAL: backup then restore-verify passes on the owner's Mac | MANUAL | Owner steps in `docs/runbook.md` section 15. |

Changed:
- `docs/runbook.md`: section 3 lists `bash tools/mongo/test.sh`; new section 15 (backup, restore check, no secret printed).
- `README.md`: rate-limit table has the two shop ceilings; limitation text updated; backup limitation now "written, self-checked against fakes, not proven until run", links `docs/operations.md` and runbook section 15; removed "Form validation runs on submit, not as each field is left."
- `docs/plans/10-ops-delivery/00-README.md`: slice 01 row annotated "done by plan 13". The checkbox was left unticked on purpose (orchestrator said not to tick status rows); tick it if that was meant to be allowed.

Checks:
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (194/194), before and after the doc edits (`13-verify-slice.txt`, `13-verify-slice-final.txt`).
- shellcheck → NOT RUN (not installed).

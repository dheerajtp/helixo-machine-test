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

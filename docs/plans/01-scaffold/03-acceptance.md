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
2. Write `docs/runbook.md`: Node 22 setup, `npm ci`, lint, test, build, and the owner's manual steps (install Shopify CLI, `shopify app dev`, install on the dev store, open the app page). Never mention starting containers any way other than `docker stack deploy`.
3. List known issues (audit advisories, template deviations, anything NOT RUN) in `## Result`.
4. Leave manual rows as MANUAL; do not mark them passed.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence.
- `tools/verify-slice.sh` prints both PASS lines.
- Append `## Result`.

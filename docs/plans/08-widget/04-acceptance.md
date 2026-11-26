# 08/04 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 08/01, 08/02, 08/03 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| H[0-9]+ ' docs/plans/08-widget/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01–03, `docs/runbook.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual check and record evidence, including the built size.
2. `docs/runbook.md`: short owner steps: `npm run dev`, add the app block to the product template in the theme editor, create a timer, check it on a product page (desktop and phone), check with the app stopped, and measure CLS.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

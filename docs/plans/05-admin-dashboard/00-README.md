# 05 — Admin dashboard

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [04](../04-timer-api/00-README.md)

## Goal
- Merchants see all their timers and their status, and can delete or disable them

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| E1 | **UI kit.** Latest Shopify Polaris (web components) with App Bridge; no custom component library. If the template cannot support them, reply BLOCKED. |
| E2 | **Table.** Name, type, target, status badge, start/end or duration, actions (edit, enable/disable, delete with confirmation). |
| E3 | **States.** Loading, empty (with create button), error with retry, and next/previous paging. |
| E4 | **API client.** One module that attaches the session token and unwraps the envelope. |
| E5 | **UI approval gate.** Before any UI code, the owner must approve a reference image (see `CLAUDE.md`), saved in `docs/ui/`. UI slices reply BLOCKED if the approved image is missing. |
| E6 | **Confirmations** (delete and other destructive actions) use the Polaris modal; no custom React Portal modal. |
| E7 | **English only.** No translation library or translation setup. |
| E8 | **Approved design (owner, 2026-11-26).** `docs/ui/dashboard-list.png` (table: name and description, status badge, type, target, schedule, impressions, actions menu with Edit, Disable/Enable, Delete; search, sort, previous/next) and `docs/ui/dashboard-states.png` (empty, loading, error with retry, no search match, delete confirmation, toast). These replace `admin-reference.png` for the list. |
| E9 | **List (owner decision).** Rows follow the reference, with name search and start-date sort, and show each timer's impression count (data arrives in plan 09). Shows 0 until then. |
| E10 | **Create and Edit** are shown disabled until plan 06 adds the form. |
| E11 | **Template cleanup.** Remove the product demo (page, card, `/api/products*`, `product-creator.js`), `@shopify/polaris` React, and the template's translation setup and its packages (E1, E7). Add no npm dependency; Polaris web components load from Shopify's CDN. |
| E12 | **Accepted differences (owner, 2026-11-26).** Loading shows a spinner instead of skeleton lines, and paging shows Polaris arrow buttons instead of "Previous" / "Next" text. |

## Status
- [x] 01 — App shell and API client
- [x] 02 — Timer list page
- [x] 03 — Acceptance (two MANUAL rows open)

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/frontend/**`, `web/src/app.js`, `web/product-creator.js`, `web/test/**`, `eslint.config.js`, lockfile |
| 02 | 01 | none | Opus | `web/frontend/{pages,components,utils}/**`, `web/test/**` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md`, `CLAUDE_FRONTEND_REACT.md` and (for backend files) `CLAUDE_BACKEND_MONGODB.md`; never commit; never read or change `web/config/` or `web/frontend/.env`; never run Docker.

## Acceptance checklist
- [ ] MANUAL: list, disable and delete work in Shopify admin
- [ ] MANUAL: empty and error states appear
- [x] `npm run build` passes

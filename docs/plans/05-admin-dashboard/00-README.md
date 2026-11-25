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
| E8 | **Admin reference.** Follow `docs/ui/admin-reference.png` (title, create button, search, sort, list rows with actions menu; create form in a modal with name, start/end date and time, description, color picker, size, position, urgency effect). It overrides earlier decisions here where they differ. Fields the PRD needs but the image lacks require a new approved image first. |
| E9 | **List (owner decision).** Rows follow the reference, with name search and start-date sort, and show each timer's impression count (data arrives in plan 09). |

## Status
- [ ] 01 — App shell and API client
- [ ] 02 — Timer list page
- [ ] 03 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/frontend/**` shell, `web/frontend/api/**` |
| 02 | 01 | none | Sonnet | `web/frontend/pages/**`, `web/frontend/components/**` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] MANUAL: list, disable and delete work in Shopify admin
- [ ] MANUAL: empty and error states appear
- [ ] `npm run build` passes

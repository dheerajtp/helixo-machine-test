# 06 — Timer create and edit form

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [05](../05-admin-dashboard/00-README.md)

## Goal
- Merchants create and edit both timer types with targeting and appearance

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| F1 | **One form** for create and edit; type locked on edit. |
| F2 | **Picker.** Shopify Resource Picker through App Bridge, multi-select, max 100. |
| F3 | **Dates** are entered in the browser's local time and sent as UTC ISO strings; the form states the time zone. |
| F4 | **Validation** mirrors decision D1 limits in the browser; server field errors show next to their fields. |
| F5 | **Preview: not built** unless the owner asks; the approved image (F9) has none, so adding it needs a new image. |
| F6 | **UI approval gate.** Before any UI code, the owner must approve a reference image (see `CLAUDE.md`), saved in `docs/ui/`. UI slices reply BLOCKED if the approved image is missing. |
| F7 | **Admin reference.** Follow `docs/ui/admin-reference.png` (title, create button, search, sort, list rows with actions menu; create form in a modal with name, start/end date and time, description, color picker, size, position, urgency effect). It overrides earlier decisions here where they differ. Fields the PRD needs but the image lacks require a new approved image first. |
| F9 | **Approved form (owner, 2026-11-26).** `docs/ui/timer-form.png`: one modal for create and edit (title and button text change, type locked), with type, evergreen duration as number plus unit, targeting, background color, size, position, urgency effect, urgency minutes (default 5) and enabled. It wins over F7 and F8. Plan 05 leaves Create and Edit disabled; this plan enables them. |
| F8 | **Form fields (owner decision).** Reference fields plus "Timer type" below the name (evergreen shows duration instead of dates) and "Apply to" with the resource picker above the color picker. One color picker (background only; text color is automatic). "Promotion description" is the shopper-facing text. Size Small/Medium/Large. Urgency effect Color pulse / Blinking text / None, with adjustable threshold minutes (default 5). Where F1–F5 differ, this wins. |

## Status
- [x] 01 — Form fields, validation, save
- [x] 02 — Resource picker
- [x] 03 — Acceptance (owner browser checks open)

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/frontend/{api,components,pages,utils}/**`, `web/test/**` |
| 02 | 01 | none | Sonnet | `web/frontend/{components,utils}/**`, `web/test/**` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_FRONTEND_REACT.md`; never commit; never read or change `web/config/` or `web/frontend/.env`; never run Docker. No backend or `shopify.app.toml` change and no new dependency.

## Acceptance checklist
- [ ] MANUAL: create and edit a fixed and an evergreen timer
- [ ] MANUAL: pick products and collections; selection survives editing
- [ ] Server validation errors appear on the right fields

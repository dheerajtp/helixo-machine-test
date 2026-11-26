# 11 — Live validation in the timer form

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [06](../06-admin-form/00-README.md)

## Goal
- Merchants see what is wrong with a field as soon as they leave it, not only after pressing Create or Save

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| K1 | **When errors show.** Not while typing. When the merchant leaves a field (blur; for date fields and selects, on change) its error shows if invalid. Once a field shows an error, it is rechecked on every change and clears as soon as it is valid. Submit still checks everything. |
| K2 | **Fields:** name, description, start and end date and time (including "End must be after start", once both are complete), duration, background color, urgency minutes. Untouched empty fields stay clean until submit. |
| K3 | **Time fields.** On leaving, a valid time is rewritten as `h:mm AM/PM` (`21:30` becomes `9:30 PM`). Anything else, such as `9:30 pm,` or `23:59 pm`, is left as typed with the error "Enter a time like 9:30 PM or 21:30". |
| K4 | **No change** to the rules, messages, layout, the API or dependencies. The existing `validateForm` stays the only source of errors. |

## Status
- [ ] 01 — Live validation and tests
- [ ] 02 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/frontend/{components/form,utils}/**`, `web/test/timer-form*` |
| 02 | 01 | none | Haiku | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_FRONTEND_REACT.md`; never commit; never read or change `web/config/` or `web/frontend/.env`.

## Acceptance checklist
- [ ] Logic tests cover touched fields, rechecking, end-after-start and time rewriting
- [ ] MANUAL: leaving a field with a bad value shows its error; fixing it clears the error
- [ ] MANUAL: an untouched new form shows no errors

# 04 — Timer domain and admin API

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [03](../03-auth-tenancy/00-README.md)

## Goal
- Merchants' timers can be stored and managed safely through the API

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| D1 | **Collection `timers`.** `shop`, `name` (1–100), `type` `fixed`/`evergreen`, `enabled`, `startAt`, `endAt` (fixed only, UTC, end > start), `durationSeconds` (evergreen only, 60–2592000), `targetType` `all`/`products`/`collections`, `targetIds` (Shopify GIDs, max 100, required unless `all`), `appearance` {`backgroundColor`, `textColor` hex; `position` `top`/`bottom` of widget block; `headline` max 120, plain text}, `urgencyThresholdSeconds` (default 300, 0–86400), timestamps. |
| D2 | **Positions** are relative to the app block (above or below its text), so no page overlay and no layout shift. |
| D3 | **Status** is computed, never stored: fixed `scheduled`/`active`/`expired` by dates; evergreen `active`; any disabled timer `disabled`. |
| D4 | **API.** `GET/POST /api/timers`, `GET/PATCH/DELETE /api/timers/:id`. List uses cursor pagination, default 20, max 50. Another shop's id returns 404. `type` cannot change after creation. PATCH validates the merged result. |
| D5 | **Delete** is permanent and also removes that timer's stats. |
| D6 | **Indexes** `{shop:1,_id:-1}` and `{shop:1,enabled:1,targetType:1}`, created by a versioned, reversible migration in `web/src/migrations/` run with `npm run migrate`. Mongoose schema also validates. |

## Status
- [ ] 01 — Model, migration, repository
- [ ] 02 — Service: rules and status
- [ ] 03 — Joi schemas, controllers, routes, API docs
- [ ] 04 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/src/models/**`, `web/src/repositories/timer*`, `web/src/migrations/**` |
| 02 | 01 | none | Sonnet | `web/src/services/timer*` |
| 03 | 02 | none | Sonnet | `web/src/routes/timers*`, `web/src/controllers/timer*`, `web/src/validators/timer*`, `docs/api.md` |
| 04 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] CRUD works and invalid input returns 400 with details
- [ ] Shop A cannot read, change or delete shop B's timer (test)
- [ ] Status tests cover each state and boundary
- [ ] Operator injection and unknown fields are rejected or stripped (test)
- [ ] `npm run migrate` is safe to run twice

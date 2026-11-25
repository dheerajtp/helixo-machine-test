# 04 — Timer domain and admin API

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [03](../03-auth-tenancy/00-README.md)

## Goal
- Merchants' timers can be stored and managed safely through the API

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| D1 | **Collection `timers`.** `shop`, `name` (1–100), `type` `fixed`/`evergreen`, `enabled`, `startAt`, `endAt` (fixed only, UTC, end > start), `durationSeconds` (evergreen only, 60–2592000), `targetType` `all`/`products`/`collections`, `targetIds` (Shopify GIDs, max 100, required unless `all`), `description` (promotion text shown to shoppers, max 120, plain text), `appearance` {`backgroundColor` hex; `size` `small`/`medium`/`large`, default `medium`; `position` `top`/`bottom` of widget block}, `urgencyEffect` `colorPulse`/`blinkingText`/`none`, default `colorPulse`, `urgencyThresholdSeconds` (default 300, 0–86400), timestamps. |
| D2 | **Positions** are relative to the app block (above or below its text), so no page overlay and no layout shift. |
| D3 | **Status** is computed, never stored: fixed `scheduled`/`active`/`expired` by dates; evergreen `active`; any disabled timer `disabled`. |
| D4 | **API.** `GET/POST /api/timers`, `GET/PATCH/DELETE /api/timers/:id`. List uses cursor pagination, default 20, max 50, with name search `q` (max 100, escaped) and `sort` by start date oldest/newest (default oldest; evergreen timers sort by `createdAt`). Another shop's id returns 404. `type` cannot change after creation. PATCH validates the merged result. |
| D5 | **Delete** is permanent. Stats do not exist yet; plan 09 (I5) adds their removal. |
| D6 | **Indexes** `{shop:1,_id:-1}`, one supporting the start-date sort and cursor and `{shop:1,enabled:1,targetType:1}`, created by a versioned, reversible migration in `web/migrations/` (the plan 03 folder and runner), run with `npm run migrate -w shopify-app-template-node`. Mongoose schema also validates. |
| D7 | **Sort key (owner approved).** Server-owned `sortAt` = `startAt` for fixed, `createdAt` for evergreen. Index `{shop:1,sortAt:1,_id:1}`; never returned to clients. |
| D8 | **Shop cleanup.** `redactShop` also deletes the shop's timers (plan 03, C4). |
| D9 | **Defaults and text.** `enabled` true, `position` `top`, `description` empty; `name`, `type` and `backgroundColor` (`#RRGGBB`) are required. Text is trimmed, control characters are rejected, and it is stored as written; every place that shows it must render it as text, never HTML. |

## Status
- [x] 01 — Model, migration, repository
- [x] 02 — Service: rules and status
- [x] 03 — Joi schemas, controllers, routes, API docs
- [x] 04 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/src/models/**`, `web/src/repositories/timer*`, `web/migrations/**`, `web/src/services/shopDataService.js`, `web/test/**` |
| 02 | 01 | none | Sonnet | `web/src/services/timer*`, `web/src/validators/timerDocument.js`, `web/test/**` |
| 03 | 02 | none | Sonnet | `web/src/routes/timers*`, `web/src/controllers/timer*`, `web/src/validators/timerRequests.js`, `web/src/app.js`, `web/test/**`, `docs/api.md` |
| 04 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit; never read or change `web/config/`; never run Docker or the migration against the real database. Add no dependency.

## Acceptance checklist
- [x] CRUD works and invalid input returns 400 with details
- [x] Shop A cannot read, change or delete shop B's timer (test)
- [x] Status tests cover each state and boundary
- [x] Operator injection and unknown fields are rejected or stripped (test)
- [x] `npm run migrate` is safe to run twice

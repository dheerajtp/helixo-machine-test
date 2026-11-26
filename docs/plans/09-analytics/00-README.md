# 09 — Impression analytics

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [06](../06-admin-form/00-README.md), [08](../08-widget/00-README.md)

## Goal
- Merchants see how many visitor sessions saw each timer

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| I1 | **Definition.** One impression per visitor session per timer, sent when the timer becomes visible. |
| I2 | **Route.** `POST /proxy/impressions` {`timerId`, `sessionId` UUID}, signature-verified, 202, 60/minute per shop and IP; unknown or other-shop timer is 404. |
| I3 | **Idempotency.** `impression_keys` {shop,timerId,sessionId} unique with 24 h TTL; the key insert and `$inc` on `timer_stats` {shop,timerId,day (UTC)} (unique) run in one majority-write transaction. Duplicate returns 202 without counting. |
| I4 | **No personal data** is stored. |
| I5 | **Admin.** `GET /api/timers/stats?ids=` (max 50) returns totals and last 7 days; dashboard shows total per timer. Webhook cleanup and timer delete remove stats. |
| I6 | **Contract.** Storefront: `POST /apps/countdown/impressions` (app path `/proxy/impressions`), JSON `{"timerId":"<24 hex>","sessionId":"<uuid>"}`, 202 envelope with `data: null` whether new or repeated, body limit 1 KB. Admin: `GET /api/timers/stats?ids=<comma-separated 24 hex, max 50>` returns `data: [{ "timerId", "total", "last7Days": [{ "day": "YYYY-MM-DD", "count" }] }]`, one entry per own timer asked for (0 when none); other shops' ids are left out. |
| I7 | **Trust.** The app proxy signs the query, not the body, and visitors can invent session ids, so counts are indicative, not audit-grade. The limit in I2 and I3's uniqueness are the protection. |
| I8 | **Migration** `web/migrations/003-impression-indexes.js`, reversible; the owner runs it. |

## Status
- [x] 01 — Models, migration, repository, service, endpoints, cleanup
- [x] 02 — Widget beacon and dashboard column (gated while 09/01 in flight)
- [x] 03 — Acceptance (one MANUAL row open)

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | 02 | Opus | `web/src/**`, `web/migrations/**`, `web/test/**`, `docs/api.md` |
| 02 | none (contract is I6) | 01 | Sonnet | `widget/src/**`, `widget/test/**`, `web/frontend/**`, `web/test/impression-client*` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and the rules file for the code touched; never commit; never read or change `web/config/` or `web/frontend/.env`; never run Docker or a migration against the real database; no new dependency.

## Acceptance checklist
- [x] Repeating a request counts once (test, including concurrent)
- [x] Deleting a timer removes its stats
- [ ] MANUAL: count rises once per new session

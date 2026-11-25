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

## Status
- [ ] 01 — Models, migration, repository, service, endpoints, cleanup
- [ ] 02 — Widget beacon and dashboard column
- [ ] 03 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | `web/src/**/impression*`, `web/src/**/stats*`, `web/migrations/**`, `web/src/webhooks/**`, `web/src/services/shopDataService.js`, `web/src/services/timer*`, `docs/api.md` |
| 02 | 01 | none | Sonnet | `widget/src/**`, `web/frontend/**` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] Repeating a request counts once (test, including concurrent)
- [ ] Deleting a timer removes its stats
- [ ] MANUAL: count rises once per new session

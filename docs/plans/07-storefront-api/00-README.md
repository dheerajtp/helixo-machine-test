# 07 — Storefront timer API

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [04](../04-timer-api/00-README.md)

## Goal
- One fast, cached, safe call returns the timer to show on a product page

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| G1 | **Route.** Shopify app proxy: storefront `/apps/countdown/timer` maps to `GET /proxy/timer?productId&collectionIds`. Proxy signature is verified; the shop comes from the signed query; failure is 401. |
| G2 | **Selection.** Only enabled, not expired, already started. Priority: product, then collection, then all; newest `createdAt` wins a tie. One timer or `data: null` with 200. |
| G3 | **Payload.** `id`, `type`, `endAt` or `durationSeconds`, `appearance`, `urgencyThresholdSeconds`, `serverNow`. Nothing else. |
| G4 | **Caching.** `Cache-Control: public, max-age=60` and `ETag`; `serverNow` is excluded from the ETag, and a fixed timer's `max-age` never passes its `endAt`. |
| G5 | **Limits.** 300 requests/minute per shop and client IP; `collectionIds` max 50; response under 200 ms (indexed query, projection, `maxTimeMS` 500). |

## Status
- [ ] 01 — Proxy verification, selection service, endpoint, docs
- [ ] 02 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Opus | `web/src/routes/proxy*`, `web/src/services/storefront*`, `web/src/auth/proxy*`, `web/src/repositories/timer*`, `shopify.app.toml`, `docs/api.md` |
| 02 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] Priority and tie-break tests pass
- [ ] Bad signature returns 401
- [ ] Response has no shop-private fields
- [ ] Local timing under 200 ms

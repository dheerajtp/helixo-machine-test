# 07 — Storefront timer API

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [04](../04-timer-api/00-README.md)

## Goal
- One fast, cached, safe call returns the timer to show on a product page

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| G1 | **Route.** Shopify app proxy: storefront `/apps/countdown/timer` maps to `GET /proxy/timer?productId&collectionIds`. Proxy signature is verified; the shop comes from the signed query; failure is 401. |
| G2 | **Selection.** Only enabled, not expired, already started. Priority: product, then collection, then all; newest `createdAt` wins a tie. One timer or `data: null` with 200. |
| G3 | **Payload.** `id`, `type`, `endAt` or `durationSeconds`, `description`, `appearance`, `urgencyEffect`, `urgencyThresholdSeconds`, `serverNow`. Nothing else (`description` and `urgencyEffect` added because plan 08 H9 shows them). |
| G4 | **Caching.** `Cache-Control: public, max-age=60` and `ETag`; `serverNow` is excluded from the ETag, and a fixed timer's `max-age` never passes its `endAt`. |
| G5 | **Limits.** 300 requests/minute per shop and client IP; `collectionIds` max 50; response under 200 ms (indexed query, projection, `maxTimeMS` 500). |
| G6 | **Scope.** The app proxy needs `write_app_proxy`; scopes become `read_products,write_app_proxy`. |
| G7 | **Client IP.** Requests arrive from Shopify, so the rate-limit key takes the shopper's IP from `X-Forwarded-For`, only after the signature passes; fall back to the shop alone. |

## Status
- [x] 01 — Proxy verification, selection service, endpoint, docs
- [x] 02 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Opus | `web/src/{routes,controllers,validators,services,auth}/{proxy,storefront}*`, `web/src/repositories/timer*`, `web/src/http/rateLimit.js`, `web/src/app.js`, `web/frontend/vite.config.js`, `web/test/**`, `shopify.app.toml`, `docs/api.md` |
| 02 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit; never read or change `web/config/` or `web/frontend/.env`; never run Docker or a migration against the real database. No new dependency.

## Acceptance checklist
- [x] Priority and tie-break tests pass
- [x] Bad signature returns 401
- [x] Response has no shop-private fields
- [x] Local timing under 200 ms

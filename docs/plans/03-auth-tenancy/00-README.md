# 03 — Shopify auth, tenancy and webhooks

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [02](../02-backend-core/00-README.md)

## Goal
- Only verified shops reach the admin API, and each sees only its own data

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| C1 | **Sessions.** `@shopify/shopify-app-session-storage-mongodb` (approved dependency), configured only inside `web/src/repositories/`; remove SQLite. |
| C2 | **Admin auth.** `/api/*` requires a valid Shopify session token; `req.shop` comes only from the verified session. A client-sent shop is ignored. |
| C3 | **Scoping.** Every repository function takes `shop` as its first argument and filters by it. |
| C4 | **Webhooks.** `app/uninstalled` deletes sessions; `shop/redact` deletes all shop data; `customers/data_request` and `customers/redact` acknowledge only (no customer data is stored). All HMAC-verified and idempotent; bad HMAC gets 401. |
| C5 | **Scopes.** `read_products` only. |
| C6 | **Rate limit.** `/api/*`: 100 requests/minute per shop, 429 `RATE_LIMITED`. In-memory store (single instance; documented). |

## Status
- [ ] 01 — Mongo session storage and admin auth middleware
- [ ] 02 — Webhooks and shop data cleanup
- [ ] 03 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Opus | `web/shopify.js`, `web/src/auth/**`, `web/src/repositories/session*` |
| 02 | 01 | none | Sonnet | `web/src/webhooks/**`, `shopify.app.toml` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] `/api/*` without a valid token returns 401
- [ ] A forged webhook returns 401; a replayed one has no extra effect
- [ ] MANUAL: reinstall on dev store works and uninstall removes the session

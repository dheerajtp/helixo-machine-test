# 13/01 — Shop ceiling on the storefront routes

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 13/02

## Decisions you need
M1 — run `grep -E '^\| M1 ' docs/plans/13-hardening/00-README.md`.

## Read first
- `web/src/http/rateLimit.js`, `web/src/routes/proxy.js`, `web/test/storefront-proxy.test.js` (how requests are signed), `docs/api.md` rate limit sections

## Scope (files you own)
`web/src/http/rateLimit.js`, `web/src/routes/proxy.js`, `web/test/proxy-ceiling*`, `docs/api.md`

## Tasks
1. Add the two ceilings (M1), each with its own store per app instance. Limits injectable so tests do not need thousands of requests. Existing limits, headers and responses unchanged.
2. Keep the `RateLimit` headers meaningful: say in Result which limiter's headers the client sees.
3. Tests: rotating `X-Forwarded-For` hits the ceiling; another shop is unaffected; a request refused by the per-shopper limit does not count against the shop; timer and impression ceilings are separate.
4. Document the ceilings in `docs/api.md`.

## Done when
- `tools/verify-slice.sh` passes. Append `## Result`.

## Result
- Changed: `web/src/http/rateLimit.js` (`createShopCeiling(limit)`, keyed on `req.shop`; updated the XFF comment), `web/src/routes/proxy.js` (ceiling on `GET /timer` and `POST /impressions`, after signature and per-shopper limiter; `createProxyRouter(shopify, { timerCeiling = 3000, impressionCeiling = 600 })`), `web/test/proxy-ceiling.test.js` (new, no database), `docs/api.md`.
- Checks: `tools/verify-slice.sh` -> LINT: PASS, TESTS: PASS (187 pass, 0 fail). No `ERR_ERL` warnings from the new test.
- Headers the client sees: both. draft-8 appends, so `RateLimit` / `RateLimit-Policy` list the per-shopper policy first (unchanged), then the shop ceiling. A per-shopper 429 carries only the per-shopper policy; a ceiling 429 carries both, the shop one at `r=0`, with `Retry-After` set by the ceiling.
- Side effects: any visitor can read the shop's remaining quota from these headers. Someone rotating `X-Forwarded-For` can use up a shop's ceiling and get its real shoppers a 429 until the window resets (inherent in M1).
- For 03: the "Rate limiting" section of `README.md` (table and the "a per-shop ceiling would close this" limitation) is now out of date; not in this slice's scope.

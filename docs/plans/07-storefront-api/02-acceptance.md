# 07/02 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 07/01 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| G[0-9] ' docs/plans/07-storefront-api/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slice 01, `docs/runbook.md`, `docs/api.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every check and record commands and output as evidence, citing exact test names.
2. `docs/runbook.md`: owner steps: restart `npm run dev`, approve the new scope, then open `https://<store>/apps/countdown/timer?productId=<number>` and check the JSON, the headers and that Shopify keeps `Cache-Control` and `ETag`.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

**Files changed.** `docs/runbook.md`: section 7 step 3 now names both scopes (`read_products,write_app_proxy`); new section 11 (restart `npm run dev`, approve the new scope, open `https://<store>.myshopify.com/apps/countdown/timer?productId=<number>` in Safari, check the JSON fields, `Cache-Control`, `ETag`, 304, the direct-call 401, and that an edit changes the ETag). This file.

**Checklist** (evidence in the session scratchpad `evidence-07/`, one file per row; full spec output in `proxy-spec.txt`, from `node --test --test-reporter=spec web/test/storefront-proxy.test.js`, 9 pass, 0 fail):

| Row | Verdict | Evidence |
| --- | --- | --- |
| Priority and tie-break tests pass | PASS | `priority is product, then collection, then all; newest wins a tie`; also `disabled, scheduled and expired timers are excluded; null when none` |
| Bad signature returns 401 | PASS | `missing, wrong, expired and malformed signatures are 401` (missing, wrong secret, expired, tampered, extra `signature`, bad shop, bad timestamp, unknown path); `another shop's timers are never returned` (a `shop` added after signing is 401) |
| Response has no shop-private fields | PASS | `payload has exactly the widget fields` (exact key set for fixed; evergreen has no `endAt`/`startAt`); repository `$project` is `STOREFRONT_FIELDS` (no `shop`, `name`, `targetIds`, `enabled`, `startAt`); service copies only `backgroundColor`, `size`, `position` from `appearance` |
| Local timing under 200 ms | PASS | `100 requests with 500 timers stay fast`: slowest of 100 = 2.9 ms (asserted < 200 ms), in-memory MongoDB |

**Commands.**
- `node --test --test-reporter=spec web/test/storefront-proxy.test.js` → PASS (9/9)
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (125 pass, 0 fail), run after the docs edit

**Known issues** (nothing here is verified against a real store):
- Not checked through Shopify: that the app proxy forwards `/apps/countdown/timer` to `/proxy/timer` with a valid signature, keeps `Cache-Control`/`ETag`/304, and the real latency through proxy and tunnel. Runbook section 11 is the owner's check.
- `write_app_proxy` re-approval after `npm run dev` restart is not verified; `shopify app deploy` was not run.
- Per-IP rate-limit key trusts the first `X-Forwarded-For` entry; if Shopify keeps a shopper-sent value, the IP part is spoofable (the shop part is not). Marked `shortcut:` in `web/src/http/rateLimit.js`.
- Rate-limit counter is in memory, per process (resets on restart).
- ETag is `"<id>-<updatedAt ms>"`: a raw DB edit that skips `updatedAt` would not change it.
- Shopify may cache the response for up to `max-age` (60 s), so an edit can take a minute to show.

# 08/01 — Countdown logic

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 08/02

## Decisions you need
H3, H4, H5, H9, H12: run `grep -E '^\| H(3|4|5|9|12) ' docs/plans/08-widget/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`, `docs/api.md` (storefront endpoint), `## Result` of `docs/plans/07-storefront-api/01-proxy-endpoint.md`

## Scope (files you own)
`widget/src/logic/**`, `widget/test/logic*`. Plain ES modules with no imports from outside `widget/src/logic`; inject `fetch`, clock and storage so Node can test them.

## Tasks
1. **Fetch (H5, H12):** `GET /apps/countdown/timer?productId&collectionIds` (at most 50 numeric ids; omit `collectionIds` entirely when there are none, the API rejects an empty value), `cache: "no-cache"`, 3 s timeout, one retry for network errors, timeouts and 5xx only. Returns the timer plus the clock offset, or `null`. Never throws. Check the response shape before trusting it.
2. **Time:** remaining seconds for fixed (with offset) and evergreen; split into days, hours, minutes, seconds; urgency when `0 < remaining <= urgencyThresholdSeconds`.
3. **Evergreen (H4):** start per timer id in `localStorage`; `sessionStorage` marks the current session, so an expired timer stays hidden for that session and restarts in the next one. Blocked or full storage, or a corrupt value, falls back to memory and never throws.
4. **Text color (H9):** black or white by the better WCAG contrast.
5. **Tests** with `node --test` in `widget/test/logic*.test.js`: expiry, evergreen reset across sessions, drift in both directions, blocked storage, bad responses, retry and timeout, contrast.

## Done when
- `tools/verify-slice.sh widget/test/logic*.test.js` passes (slice 02 adds widget tests to `npm test`).
- Append `## Result` listing the exports.

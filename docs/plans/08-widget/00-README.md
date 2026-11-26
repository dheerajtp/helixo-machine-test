# 08 — Storefront widget and theme extension

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [07](../07-storefront-api/00-README.md)

## Goal
- Shoppers see a smooth countdown on product pages that never breaks the store

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| H1 | **Build.** Preact (approved dependency) bundled by Vite into the extension's assets; target 15 KB gzipped, build fails above 30 KB. |
| H2 | **Delivery.** Theme App Extension app block for product pages; Liquid passes product id and collection ids. No ScriptTag. |
| H3 | **Fixed** countdown corrects client clock drift using `serverNow` (or the response `Date` header when cached). |
| H4 | **Evergreen.** Start time in `localStorage` per timer id; when expired it hides, and restarts in the next browser session (tracked with `sessionStorage`). Blocked storage means an in-memory countdown. |
| H5 | **Fetch** once per page load, 3 s timeout, one retry, no polling; any failure renders nothing and throws nothing. |
| H6 | **Layout.** The block reserves a fixed height from first paint so CLS is zero; with no timer the space stays empty. |
| H7 | **Safety.** Text is rendered as text only (never HTML). Urgency cue within the threshold, respecting `prefers-reduced-motion` and not announced every second to screen readers. |
| H8 | **UI approval gate.** Before any UI code, the owner must approve a reference image (see `CLAUDE.md`), saved in `docs/ui/`. UI slices reply BLOCKED if the approved image is missing. |
| H9 | **Appearance (owner decision).** Text is black or white, whichever contrasts better with `backgroundColor`. Shows `description`; supports `size` and `urgencyEffect` (`colorPulse`, `blinkingText`, `none`). Blinking is under 3 flashes per second, and `prefers-reduced-motion` disables both effects. |
| H10 | **Approved design (owner, 2026-11-26).** `docs/ui/widget.png`, style **A: digit tiles**, with its urgency, position, size, contrast and no-timer examples. Days hide when zero. "Bottom" puts the text under the digits. |
| H11 | **Reserved height** is the Large size's height at every viewport, with the description clamped to 2 lines and smaller sizes centred, because the size is unknown until the response arrives. |
| H12 | **Clock.** The browser may serve a cached response up to 60 s old, so fetch with `cache: "no-cache"` (a cheap 304) and take the server time from the `Date` header; fall back to `serverNow`. Refines H3. |
| H13 | **Build output** is not committed: the root `predev` and `predeploy` scripts build the widget into the extension's assets. |

## Status
- [ ] 01 — Countdown logic with unit tests
- [ ] 02 — Preact UI, build and size check
- [ ] 03 — Theme app extension and integration
- [ ] 04 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | 02 | Sonnet | `widget/src/logic/**`, `widget/test/logic*` |
| 02 | none | 01 | Sonnet | `widget/src/ui/**`, `widget/vite.config.js`, `widget/package.json`, `widget/scripts/**`, `widget/test/ui*`, root `package.json`, lockfile, `eslint.config.js`, `.gitignore` |
| 03 | 01, 02 | none | Sonnet | `extensions/countdown-timer/**`, `widget/src/index.js`, `widget/vite.config.js`, `widget/test/**` |
| 04 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_FRONTEND_REACT.md`; never commit; never read or change `web/config/` or `web/frontend/.env`; never run Docker or deploy. No dependency beyond Preact and the Vite tooling already in the repo.

## Acceptance checklist
- [ ] Size check passes
- [ ] Logic tests cover expiry, evergreen reset, drift and blocked storage
- [ ] MANUAL: timer shows on a dev-store product page
- [ ] MANUAL: with the API down the page works normally and CLS is about 0

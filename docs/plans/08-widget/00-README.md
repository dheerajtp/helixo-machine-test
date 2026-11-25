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

## Status
- [ ] 01 — Countdown logic with unit tests
- [ ] 02 — Preact UI, build and size check
- [ ] 03 — Theme app extension and integration
- [ ] 04 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | 02 | Sonnet | `widget/src/logic/**` |
| 02 | none | 01 | Sonnet | `widget/src/ui/**`, `widget/vite.config.js`, `widget/package.json` |
| 03 | 01, 02 | none | Sonnet | `extensions/countdown-timer/**`, `widget/src/index.js` |
| 04 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] Size check passes
- [ ] Logic tests cover expiry, evergreen reset, drift and blocked storage
- [ ] MANUAL: timer shows on a dev-store product page
- [ ] MANUAL: with the API down the page works normally and CLS is about 0

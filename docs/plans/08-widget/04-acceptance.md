# 08/04 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 08/01, 08/02, 08/03 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| H[0-9]+ ' docs/plans/08-widget/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01–03, `docs/runbook.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual check and record evidence, including the built size.
2. `docs/runbook.md`: short owner steps: `npm run dev`, add the app block to the product template in the theme editor, create a timer, check it on a product page (desktop and phone), check with the app stopped, and measure CLS.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

**Files.** `docs/runbook.md` (new section 12, storefront widget owner steps), this file. Evidence: `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/60c5a2f2-fbcb-4182-969e-183b60a1d0c4/scratchpad/evidence-08/` (`00-verify-slice.txt`, `01-size-check.txt`, `02-logic-tests.txt`, `03-manual-timer-on-product-page.txt`, `04-manual-api-down-cls.txt`).

**Checklist.**
| Row | Result | Evidence |
| --- | --- | --- |
| Size check passes | PASS | `CI=true npm run build -w widget` exit 0: `Widget size (script + CSS, gzipped): 7.45 KB (target 15.00 KB, limit 30.00 KB)` (JS 6.86 KB, CSS 0.77 KB). `widget/test/ui-size.test.js` "the size check fails only above 30 KB gzipped, script and CSS together" passes. |
| Logic tests cover expiry, evergreen reset, drift and blocked storage | PASS | 23/23 pass in `widget/test/logic*.test.js` + `controller.test.js`. Expiry: "remaining time rounds up and stops at zero on expiry", "counts down from the clock, then clears the slot and the interval at zero". Evergreen reset: "evergreen hides after expiry and restarts in the next session". Drift: "corrects drift in both directions, preferring the Date header", "falls back to serverNow without a Date header". Blocked storage: "evergreen uses memory when storage is blocked or full". |
| Timer shows on a dev-store product page | MANUAL | Needs the owner's dev store and theme editor; runbook section 12 steps 1–5. |
| With the API down the page works and CLS is about 0 | MANUAL | Needs a real storefront; runbook section 12 steps 6–7. Supporting tests: "no timer or a failed request draws nothing", "a rendering failure is swallowed and stops the ticking", "retries once after a 5xx or network error", "aborts a hung request and retries once". |

**Commands.** `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (152 pass, 0 fail). `CI=true npm run build -w widget` → PASS. Grep for `console.`, `innerHTML`, `dangerouslySetInnerHTML`, `ScriptTag`/`script_tag` in `widget/src` and the extension block/toml → no hits. Built `countdown-timer.js` is git-ignored (`.gitignore:31`, H13). `widget/src/ui/index.js` is confirmed gone.

**Known issues.**
- Nothing has run against a real store or theme: extension schema acceptance, app proxy signature and `Date` header, first-paint stylesheet, theme editor re-render, quick view and variant re-render are unverified.
- CLS cannot be measured in Safari (no layout-shift API); the runbook uses Chrome for that step.
- The reserved 134px stays as empty space when no timer matches the product (H6/H11, by design).
- `sessionStorage` is per tab, so an expired evergreen timer restarts in a new tab (H4 as written). Fixed countdowns can differ from the server by about 1 s (`Date` header resolution).
- Stopping `npm run dev` may also end the CLI's extension preview, so the "app stopped" check may show no block at all rather than an empty slot; the MongoDB-down check covers the API-error path.

### Follow-up: owner check on the dev store (2026-11-26)
- PASS: the countdown shows on a dev-store product page (style A, large, ticking); the proxy endpoint returned the same fixed timer.
- Still open: API-down behaviour and CLS (runbook 12, steps 6-7).

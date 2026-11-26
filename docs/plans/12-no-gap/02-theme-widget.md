# 12/02 — Theme block and widget

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 12/01

## Decisions you need
L2, L4, L5 — run `grep -E '^\| (L2|L4|L5) ' docs/plans/12-no-gap/00-README.md`.

## Read first
- `extensions/countdown-timer/blocks/countdown_timer.liquid`, `widget/src/index.js`, `widget/src/ui/countdown.css`, `widget/test/controller.test.js`
- Current shopify.dev docs for `app.metafields` in theme app extension Liquid

## Scope (files you own)
`widget/src/**`, `widget/test/**`, `extensions/countdown-timer/blocks/**`

## Tasks
1. Liquid: compute the reserve class (L4) with no inline script; handle no collections and more than one rule.
2. CSS and controller: L5. The theme's empty-element rules must not give an unreserved slot a size.
3. Tests for the controller: unreserved slot with and without a timer, reserved slot with none.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` (size check) pass. Append `## Result`, including what only a store can confirm.

## Result
**Changed**
- `extensions/countdown-timer/blocks/countdown_timer.liquid`: computes `cdt-slot--reserve` from `app.metafields.countdown.targets.value` (no inline script). Missing value or missing `rules` reserves. Rules are read in two halves of 50 (Liquid's `for` limit); collections capped at 50, as the widget sends.
- `widget/src/ui/countdown.css`: an unreserved slot is `display: none`; only `.cdt-slot--reserve` has the 134px.
- `widget/src/index.js`: adds `cdt-slot--reserve` after a countdown is drawn. A finished or missing timer never adds it, and nothing removes it.
- `widget/test/controller.test.js`: slot fixture has a `classList`; two new tests (unreserved with/without a timer, reserved with none).

**Checks**
- `tools/verify-slice.sh`: lint PASS, 154/154 tests PASS.
- `CI=true npm run build` (and `-w widget`): PASS, widget 7.49 KB gzipped. The root build also builds `web/frontend`, where Vite may load its env file on its own; it was not opened or printed.
- Throwaway LiquidJS check in the scratchpad (missing value, no/one/many rules, no collections, scheduled/expired windows, 100th rule): PASS. Not committed, and LiquidJS is not Shopify's Liquid.

**Only a store can confirm** (NOT RUN)
- Shopify renders the block and reads the app-data metafield written by 12/01 (namespace `countdown`, key `targets`, type `json`), including `offset: 50` on a JSON array.
- No visible gap on an untargeted product: the theme may still space the `.shopify-app-block` wrapper, which this slice does not style.
- A targeted product shows the timer without a jump.
- Shopify may cache the rendered page, so `now` in Liquid can lag at a timer's start or end; L5 covers it (one shift on start, empty space after end).
- In the theme editor, the block is now invisible on a product with no matching timer.

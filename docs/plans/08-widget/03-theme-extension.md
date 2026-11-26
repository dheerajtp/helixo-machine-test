# 08/03 — Theme app extension and integration

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 08/01, 08/02 · Parallel with: none

## Decisions you need
H2, H5–H7, H11, H12: run `grep -E '^\| H(2|5|6|7|11|12) ' docs/plans/08-widget/00-README.md`.

## Read first
- `## Result` of `01-countdown-logic.md` and `02-preact-ui.md`
- Current shopify.dev docs for theme app extensions (file layout, `shopify.extension.toml`, block schema, asset limits)

## Scope (files you own)
`extensions/countdown-timer/**`, `widget/src/index.js`, `widget/vite.config.js`, `widget/test/**`.

## Tasks
1. **Extension:** app block enabled on product templates only. Liquid renders the empty reserved container with the product id and up to 50 collection ids as escaped `data-` attributes, and loads the script deferred. No ScriptTag, no inline script, no secrets.
2. **Entry:** mount into each container, fetch once per page (shared if the block appears twice), tick once a second from the clock (not by counting ticks), stop at zero and clear the timer, remount cleanly in the theme editor (`shopify:section:load` / `unload`). Any failure renders nothing, logs nothing and never breaks the page.
3. **Tests** for the controller logic with fake DOM-free adapters where possible.

## Done when
- `CI=true npm run build` (with size check), `npm run lint` and `npm test` pass.
- Append `## Result`, naming what only a dev store can confirm.

## Result

**Files.** New `extensions/countdown-timer/shopify.extension.toml`, `extensions/countdown-timer/blocks/countdown_timer.liquid`, `widget/src/index.js`, `widget/test/controller.test.js`. Changed `widget/vite.config.js` (entry is now `src/index.js`).

**Behaviour.** App block "Countdown timer", `target: content`, product templates only. Empty `.cdt-slot` with escaped `data-product-id` and `data-collection-ids` (at most 50); external script with `defer`, stylesheet from the block schema. `createWidget(window)` makes one request per product per page load (two blocks share it), computes the end time once, ticks every second from the clock, clears at zero, and handles `shopify:section:load` / `unload`. `window.cdtStarted` stops a second script tag from starting it again.

**Checks.** `CI=true npm run build` PASS (7.45 KB gzipped, script plus CSS; limit 30 KB, target 15 KB); `npm run lint` PASS; `npm test` PASS (152, 0 fail). Headless Chrome on a local page with the built files, two blocks and a stubbed `fetch`: one request, no errors, both drawn at 134px, HTML in the description shown as text.

**Only a dev store can confirm** (no Shopify CLI deploy or theme check was run):
- Shopify accepts the toml and block schema, and the block can be added on product templates only.
- The real request through the app proxy (signature, `Date` header, `no-cache` revalidation) with real product and collection ids.
- Theme editor add, remove and re-render, including whether the script runs when the block is first added without a reload.
- Real theme: stylesheet applied from first paint (no layout shift), no style clashes, narrow screens, quick-view or variant re-rendering.

**For 08/04.** `widget/src/ui/index.js` (slice 02's temporary entry) is no longer used and can be deleted; it was outside this slice's scope. The built assets are not committed (H13), so `npm run dev` or `npm run deploy` from the root builds them; calling `shopify app dev` directly does not.

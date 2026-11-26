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

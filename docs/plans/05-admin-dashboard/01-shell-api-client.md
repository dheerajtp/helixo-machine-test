# 05/01 — App shell and API client

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: none

## Decisions you need
E1, E4, E7, E11: run `grep -E '^\| (E1|E4|E7|E11) ' docs/plans/05-admin-dashboard/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`, `docs/api.md`
- `web/frontend/{App,Routes,index}.jsx`, `index.html`, `vite.config.js`, `package.json`, `pages/**`, `components/**`, `utils/**`
- `web/src/app.js`, `web/test/{app,project,redirect-url}.test.js`, `eslint.config.js`
- Current Polaris web components and App Bridge docs on shopify.dev. Do not rely on memory for script URLs, element names or attributes; if they cannot be used here, reply BLOCKED (E1).

## Scope (files you own)
`web/frontend/**`, `web/src/app.js`, `web/product-creator.js`, `web/test/**`, `eslint.config.js`, `package-lock.json`.

## Tasks
1. **Shell:** load Polaris web components from Shopify's CDN next to App Bridge in `index.html`. Keep file routing, `ExitIframe`, `NotFound` and `react-query` (create the `QueryClient` once, not on every render). The home page is a placeholder `s-page` titled "Countdown Timer Manager"; slice 02 builds it. Rewrite `ExitIframe` and `NotFound` with web components.
2. **Cleanup (E11):** remove the demo page, `ProductsCard`, unused assets, the `NavMenu` page link, i18n files and packages, `@shopify/polaris`, `@shopify/stylelint-polaris`, and any other package no longer imported (`npm uninstall -w shopify-frontend-template-react`). Remove `/api/products*` from `app.js` and `product-creator.js`. Update the metrics test that used `/api/products/count`, and the `eslint.config.js` overrides that name deleted files.
3. **`api/client.js` (E4):** the only place that calls the backend. Gets a fresh token from App Bridge (`shopify.idToken()`) per request, sends `Authorization: Bearer`, supports `AbortSignal`, returns `{ data, meta }`, and throws one error type carrying `status`, `code`, `message`, `details` (also for network failure and non-JSON responses). A 403 with the library's re-authorize URL header sends the top window there. `api/timers.js`: `listTimers`, `updateTimer`, `deleteTimer` (create/get can wait for plan 06). Keep both free of React and testable in Node (inject `fetch` and the token function).
4. **Tests** in `web/test/` with `node --test`: token header, envelope unwrap, error mapping, network failure, query string building (empty values omitted).

## Done when
- `tools/verify-slice.sh`, `CI=true npm run build` and `npm audit --audit-level=high` pass; no import of a removed package remains.
- Append `## Result`: client exports, how to render Polaris web components and bind their events in React 18 (custom events and boolean attributes behave differently from DOM elements).

## Result

### Changed
- Shell: `web/frontend/{index.html,index.jsx,App.jsx}`, `components/{index.js,providers/index.js,providers/QueryProvider.jsx}`, `pages/{index,NotFound,ExitIframe}.jsx`. Polaris loads from `https://cdn.shopify.com/shopifycloud/polaris-2.js` (the stable channel for Polaris 2, per shopify.dev "Versioning for web components") after App Bridge.
- New: `web/frontend/api/{client,timers}.js`, `web/test/api-client.test.js`.
- `web/frontend/vite.config.js`: the `/api` dev proxy now skips paths ending in `.js`; without this the new `api/` source folder was proxied to the backend in dev.
- Removed: demo page, `ProductsCard`, `PolarisProvider`, `assets/`, `locales/`, `utils/i18nUtils.js`, `translation.yml`, `web/product-creator.js`, `/api/products*` in `web/src/app.js`, their `eslint.config.js` overrides, the `stylelint` key and the dead `coverage` script.
- Uninstalled: `@formatjs/*` (3), `@shopify/{app-bridge,i18next-shopify,polaris,stylelint-polaris}`, `i18next`, `i18next-resources-to-backend`, `react-i18next`, `stylelint`, `history`, `jsdom`, `supertest` (the frontend copy; `web` keeps its own). Kept `@shopify/app-bridge-react` (`NavMenu`, `useAppBridge`).
- `web/test/app.test.js`: the metrics-label and 32 KB tests use `/api/timers`.

### Checks
- `tools/verify-slice.sh`: LINT PASS, TESTS PASS (92/92).
- `CI=true npm run build`: PASS.
- `npm audit --audit-level=high`: PASS (2 moderate `react-router` advisories remain; the fix is a major upgrade, ask first).
- Grep for removed packages, `ProductsCard`, `product-creator`, `api/products` (excluding `*.md`, `web/config`, `.env`): no matches.
- Vite dev server with dummy ports: `/api/client.js` and `/api/timers.js?t=1` served by Vite; `/api/timers...` proxied.
- NOT RUN: the app inside Shopify admin (no store here). Web component rendering, `shopify.idToken()` and the re-authorize redirect are unverified in a real browser.

### Left over
- The product demo may have been the only user of the `write_products` scope. Scopes were not read or changed (auth change, ask first).

### Client exports (for slice 02)
- `api/timers.js`: `listTimers({ limit, cursor, q, sort }, { signal })`, `updateTimer(id, changes, { signal })`, `deleteTimer(id, { signal })`, `createTimersApi(request)`. Each resolves to `{ data, meta }`; `meta.pagination.nextCursor` is `null` on the last page.
- `api/client.js`: `createClient({ fetch, getToken, redirect })` returns `request(path, { method, query, body, signal })`; `ApiError { status, code, message, details }`. `status` is 0 with code `NETWORK_ERROR`; other client-made codes are `INVALID_RESPONSE` and `REAUTHORIZE` (the top window is already navigating). An abort rejects with `AbortError`, not `ApiError`.
- react-query 3 cancels only a promise that has a `.cancel` method or a `queryFn` that uses its `signal`: pass `({ signal }) => listTimers(params, { signal })`.

### Polaris web components in React 18.3 (tested with react-dom in jsdom, with stand-in elements)
- Use the tags directly (`<s-page heading="...">`). No import or wrapper is needed.
- These React props fire: `onClick`, `onInput`, `onFocus`, `onBlur`, `onSubmit`.
- These do NOT fire: `onChange` and every custom event (`onHide`, `onAfterHide`, `onShow`, `onDismiss`, ...). Use a `ref` with `addEventListener("change" | "hide" | "afterhide" | "dismiss", handler)` in a `useEffect`, and remove it in the cleanup.
- Booleans: `disabled={false}` renders `disabled="false"`, which is ON. Always write `disabled={busy || undefined}` (same for `loading`, `checked`, `hidden`, `dismissible`). This holds for client rendering too, although shopify.dev suggests only server rendering is affected.
- Use `class`, not `className` (it renders as `classname`).
- Strings, `slot`, `id`, `commandFor` and `command` work as written. Objects, arrays and functions are not set as properties: assign them through a `ref`.
- Modal: open and close with `commandFor` + `command="--show" | "--hide"`, or call `ref.current.showOverlay()` / `hideOverlay()`.
- There is no DOM test environment (jsdom was removed); keep testable logic in plain `.js` modules.

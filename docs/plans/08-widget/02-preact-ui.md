# 08/02 — Preact UI, build and size check

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 08/01

## Decisions you need
H1, H6, H7, H9–H11, H13: run `grep -E '^\| H(1|6|7|9|10|11|13) ' docs/plans/08-widget/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`, `docs/api.md` (storefront endpoint), `## Result` of `docs/plans/07-storefront-api/01-proxy-endpoint.md`, **the image** `docs/ui/widget.png`
- root `package.json`, `eslint.config.js`, `.gitignore`, `web/frontend/vite.config.js`

## Scope (files you own)
`widget/src/ui/**`, `widget/vite.config.js`, `widget/package.json`, `widget/scripts/**`, `widget/test/ui*`, root `package.json`, `package-lock.json`, `eslint.config.js`, `.gitignore`. Slice 01 owns `widget/src/logic/**`: do not import it yet.

## Tasks
1. **Workspace:** `widget` with Preact (approved), built by Vite with the repo's installed major version into one script and one stylesheet in `extensions/countdown-timer/assets/`. Add it to root workspaces; add `widget/test/**/*.test.js` to the root `test` script; add `predev` and `predeploy` (H13); ignore the built assets; lint `widget/` as browser code with JSX.
2. **Components** (one per file), props only: remaining time parts, description, appearance, urgency effect and flag. As style A in the image. All text through JSX text nodes, never `innerHTML`.
3. **CSS:** every selector prefixed with a widget class so the theme is not affected; inherit the theme font; sizes; position; both urgency effects (blink under 3 per second) off for `prefers-reduced-motion`; reserved height per H11.
4. **Accessibility:** the ticking digits are not announced every second; give a readable label that changes at most once a minute.
5. **Size check:** the build fails above 30 KB gzipped (script plus CSS) and prints the size; target 15 KB.

## Done when
- `npm install`, `CI=true npm run build`, `npm run lint`, `npm test` and `npm audit --audit-level=high` pass.
- Append `## Result` with component props, the built file names and the size.

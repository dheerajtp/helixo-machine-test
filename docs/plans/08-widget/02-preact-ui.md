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

## Result

**Files.** New `widget/`: `package.json` (preact ^11.2.0, vite ^6.4.6), `vite.config.js`, `scripts/check-size.js`, `src/ui/{index.js,Countdown.jsx,DigitTile.jsx,format.js,countdown.css}`, `test/ui-format.test.js`, `test/ui-size.test.js`. Changed: root `package.json` (workspace `widget`, test glob, `predev`, `predeploy`), `package-lock.json`, `eslint.config.js`, `.gitignore`.

**Component props.**
- `Countdown({ parts: { days, hours, minutes, seconds }, description, appearance: { backgroundColor, size, position }, textColor, urgencyEffect, urgent })`. `parts` are numbers. `textColor` is a CSS color (black or white from slice 01). `urgent` is a boolean.
- `DigitTile({ value, label })` (internal).
- The component does not handle expiry: stop rendering it (`render(null, el)`) at zero.

**For slice 03.**
- The Liquid container must have class `cdt-slot` and no other content (no whitespace-dependent styling needed): it reserves 134px and stays visible under themes that hide `div:empty`. Load `countdown-timer.css` from `<head>` or the block's `stylesheet` so the height applies from first paint.
- `src/ui/index.js` is a temporary entry exporting `h`, `render`, `Countdown`. Point `build.lib.entry` in `vite.config.js` at `src/index.js` and import `./ui/countdown.css` there (via `ui/index.js` or directly). Output is an IIFE.
- Built files (ignored by git): `extensions/countdown-timer/assets/countdown-timer.js` and `countdown-timer.css`.

**Size.** 5.88 KB gzipped, script plus CSS (JS 5.25, CSS 0.77), without slice 01 logic. Target 15 KB, limit 30 KB.

**Checks.** `npm install` PASS; `CI=true npm run build` PASS; `npm run lint` PASS; `npm test` PASS (145, 0 fail, includes slice 01's tests as they were at that time); `npm audit --audit-level=high` PASS (2 moderate, react-router in `web/frontend`, not from this slice). Headless Chrome screenshot of the built bundle: sizes (116/92/70px, 134px with two lines), bottom position, dark text, clamp, HTML shown as text, empty slot kept.

**Not checked.** The urgency animations and `prefers-reduced-motion` in motion (CSS only), a screen reader, narrow viewports, and a real theme.

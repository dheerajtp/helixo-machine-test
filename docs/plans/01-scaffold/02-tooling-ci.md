# 01/02 — ESLint, test runner, verify script, CI

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 01/01 · Parallel with: none

## Decisions you need
Tooling, CI, runtime. From the repo root run `grep -E '^\| (A2|A4|A5|A6) ' docs/plans/01-scaffold/00-README.md`.

## Read first
- `CLAUDE.md` (env and Docker rules)
- Root, `web/` and `web/frontend/` `package.json`
- The `## Result` of `01-scaffold-template.md`

## Scope (files you own)
`eslint.config.js`, `tools/verify-slice.sh`, `.github/workflows/ci.yml`, `web/test/**`, `package.json` files, `package-lock.json`.

## Tasks
1. **ESLint** flat config at the root covering `web/` (Node, ESM) and `web/frontend/` (JSX), ignoring build output. Dev dependencies: ESLint and only the plugins this needs. Root script `npm run lint`. Fix lint errors by configuration where the cause is template code; list any template file you would have to edit.
2. **Tests** with `node:test`; add `supertest` as a dev dependency of `web`. Root script `npm test`. Add one real test, `web/test/project.test.js`: `.nvmrc` and every `engines.node` agree on Node 26.
3. **`tools/verify-slice.sh [spec files]`**: executable, `set -u`, runs from the repo root; runs lint, then the given specs (all tests if none). Prints `LINT: PASS|FAIL` and `TESTS: PASS|FAIL`; exit code non-zero if either fails.
4. **CI** on push and pull request: Node from `.nvmrc`, `npm ci`, lint, test, build, `npm audit --audit-level=high`. The workflow MUST NOT define any env variable (no `env:` blocks) and MUST NOT use Docker. If the build cannot run without an env value, reply BLOCKED with options. If audit fails on template dependencies, report the advisories; do not weaken the check.

## Done when
- `npm run lint`, `npm test` and `npm run build` pass.
- `tools/verify-slice.sh` prints both PASS lines; with a deliberately failing temporary spec it prints `TESTS: FAIL` and exits non-zero (delete the spec afterwards).
- The CI file contains no `env:` key. CI itself is NOT RUN until the owner pushes.
- Append `## Result`.

## Result
DONE. Not committed.

**Files:** `eslint.config.js`, `tools/verify-slice.sh`, `.github/workflows/ci.yml`, `web/test/project.test.js`, `package.json` (`lint` and `test` scripts, `"type": "module"`, dev deps `eslint` 10, `@eslint/js`, `globals`), `web/package.json` (`supertest` 7), `package-lock.json`.

**ESLint:** no React plugin; ESLint 10 tracks JSX references itself. `react-hooks` rules are not enabled. `no-unused-vars` ignores `_`-prefixed parameters. No template file was edited; these are relaxed by configuration, only for the named file: `web/privacy.js` and `web/shopify.js` (`no-unused-vars` off), `web/product-creator.js` (`preserve-caught-error` off), `web/frontend/utils/i18nUtils.js` (`process` global). Remove an override when its file is rewritten.

**Checks (Node 26.0.0)**
- `npm run lint`: PASS. `npm test`: PASS (1 test). `CI=true npm run build`: PASS.
- `npm ci` (in a scratchpad copy): PASS.
- `tools/verify-slice.sh`: `LINT: PASS`, `TESTS: PASS`, exit 0. With a temporary failing spec (as argument, and in the full run): `TESTS: FAIL`, exit 1; spec deleted.
- No `env:` key and no Docker in the CI file.
- `npm audit --audit-level=high`: FAIL, so CI will fail at its last step. 12 advisories (7 high, 5 moderate), the same count as before this slice. High: `semver` (via `simple-update-notifier`, `nodemon`; non-breaking `npm audit fix` offered) and `decode-uri-component` (via `query-string`, `vi-fetch`). `vite`/`esbuild`, `i18next`, `react-router` are also listed. Check not weakened, no package upgraded.
- NOT RUN: CI on GitHub (owner has not pushed).

**For later slices:** specs go in `web/test/**/*.test.js` (the `npm test` glob); spec paths passed to `verify-slice.sh` are relative to the repo root. The root package is now ESM.

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
2. **Tests** with `node:test`; add `supertest` as a dev dependency of `web`. Root script `npm test`. Add one real test, `web/test/project.test.js`: `.nvmrc` and every `engines.node` agree on Node 22.
3. **`tools/verify-slice.sh [spec files]`**: executable, `set -u`, runs from the repo root; runs lint, then the given specs (all tests if none). Prints `LINT: PASS|FAIL` and `TESTS: PASS|FAIL`; exit code non-zero if either fails.
4. **CI** on push and pull request: Node from `.nvmrc`, `npm ci`, lint, test, build, `npm audit --audit-level=high`. The workflow MUST NOT define any env variable (no `env:` blocks) and MUST NOT use Docker. If the build cannot run without an env value, reply BLOCKED with options. If audit fails on template dependencies, report the advisories; do not weaken the check.

## Done when
- `npm run lint`, `npm test` and `npm run build` pass.
- `tools/verify-slice.sh` prints both PASS lines; with a deliberately failing temporary spec it prints `TESTS: FAIL` and exits non-zero (delete the spec afterwards).
- The CI file contains no `env:` key. CI itself is NOT RUN until the owner pushes.
- Append `## Result`.

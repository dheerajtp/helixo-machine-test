# 01 — Repository and Shopify scaffold

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: nothing

## Goal
- A running Shopify app skeleton installed on your dev store
- Lint, test and verify tooling that every later plan uses

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| A1 | **Layout.** From `Shopify/shopify-app-template-node`: backend `web/` (code in `web/src/`), admin UI `web/frontend/`, theme extension `extensions/countdown-timer/`, widget source `widget/`. |
| A2 | **Runtime.** Node 22 LTS pinned in `.nvmrc` and `engines`; npm with committed lockfile; JavaScript everywhere (ESM). |
| A3 | **Template check first.** Slice 01 checks the template and Shopify CLI against current shopify.dev docs. If the template is archived or incompatible, reply BLOCKED with the options. |
| A4 | **Tooling.** ESLint (flat config); tests with built-in `node:test` plus `supertest`; `tools/verify-slice.sh [spec files]` runs lint then those tests (all tests if none given) and prints PASS/FAIL lines. |
| A5 | **CI.** GitHub Actions: `npm ci`, lint, test, build, `npm audit --audit-level=high`. |
| A6 | **Secrets.** `.gitignore` covers env files but keeps `.env.example`; env variables are defined only in `web/` and `web/frontend/`, each with a names-only `.env.example`; no root env file. A root `.gitignore` already exists: merge the template's entries into it, never overwrite it. |

## Status
- [ ] 01 — Scaffold from template, pin Node, ignore files
- [ ] 02 — ESLint, test runner, verify script, CI
- [ ] 03 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Sonnet | repo root, `web/**`, `extensions/**` |
| 02 | 01 | none | Sonnet | `eslint.config.js`, `tools/**`, `.github/**`, `package.json` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] `npm ci && npm run lint && npm test && npm run build` pass
- [ ] `tools/verify-slice.sh` prints PASS
- [ ] MANUAL: `shopify app dev` installs the app on your dev store and its page opens
- [ ] No secret is tracked by git

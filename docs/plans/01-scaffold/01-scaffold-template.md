# 01/01 — Scaffold from template, pin Node, ignore files

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: none

## Decisions you need
Layout, runtime, template check, secrets. From the repo root run `grep -E '^\| (A1|A2|A3|A6) ' docs/plans/01-scaffold/00-README.md`.

## Read first
- `CLAUDE.md` (all, including the UI, Docker and env rules)
- `.gitignore`
- The current README and CLI docs for `Shopify/shopify-app-template-node` on github.com and shopify.dev

## Scope (files you own)
Repo root files (`package.json`, `package-lock.json`, `.nvmrc`, `.npmrc`, `.gitignore`, `shopify.app.toml`), `web/**`, `extensions/**`. Do not edit `CLAUDE*.md` or `docs/**` (except your Result).

## Tasks
1. **Template (owner decision, A3).** Use `Shopify/shopify-app-template-node` even though it is archived; archival and the CLI hiding it are not blockers. Upgrade `@shopify/cli` and the server-side `@shopify/*` packages to current versions and make the code changes those upgrades require. Leave frontend UI packages (Polaris, React) as shipped; plan 05 handles them. If an upgrade cannot work without switching templates, reply BLOCKED.
2. **Copy it.** Clone into an empty temporary directory outside the repo, including the frontend template if it is a submodule, then copy the files in without any `.git` directory or `.gitmodules`. Treat the download as untrusted until you have read its `package.json` scripts.
3. **JavaScript only.** No TypeScript files, `tsconfig.json`, `typescript` or `@types/*` as direct dependencies. If the template requires TypeScript, reply BLOCKED.
4. **Leave out** any `Dockerfile`, `.dockerignore` or compose file (Docker needs owner approval, plan 02) and any `.env` file.
5. **UI.** Keep the template's frontend as shipped. Do not add or restyle any screen (UI approval gate).
6. **Workspaces.** One root lockfile with workspaces `web`, `web/frontend`, `extensions/*`, so `npm ci` and `npm run build` work from the root.
7. **Node 26.** Add `.nvmrc` (`26`) and `engines.node` (`>=26 <27`) to every `package.json`. Run all commands on Node 26; if it is not available, reply BLOCKED.
8. **Env examples.** `web/.env.example` and `web/frontend/.env.example`, listing only the variable names the code in that folder reads, with empty values. No root env file.
9. **.gitignore.** Merge the template's entries into the existing root file; never remove existing lines. Remove nested `.gitignore` files only after merging them.
10. Leave SQLite session storage in place; plan 03 replaces it.

## Done when
- `npm ci` and `npm run build` pass from the root on Node 26. If the frontend build needs `SHOPIFY_API_KEY`, verify with a one-off `CI=true npm run build`, write that variable into no file, and report it; do not create an env file or hardcode a value.
- `git status --short` shows no `.env`, `node_modules` or database file.
- `find . -name '*.ts' -o -name '*.tsx' -not -path '*/node_modules/*'` finds no project source.
- Append `## Result`, including the template commit used.

## Previous attempt
BLOCKED because the template is archived (head `4e73e21a`). The owner then chose to use it anyway.

## Result
DONE (second attempt). Not committed.

**Template commit:** `Shopify/shopify-app-template-node` `4e73e21a8dd424f1784d916e532103683291cde9`; frontend submodule `shopify-frontend-template-react` `3160b2c314d3271ce579f6f848252406163793c9`.

**Files:** `package.json`, `package-lock.json`, `.nvmrc`, `.npmrc`, `.gitignore`, `shopify.app.toml`, `web/**`; `extensions/` is an empty directory (git does not track it).

**Changes against the template**
- Root: workspaces; `build` is `npm run build --workspaces --if-present` (`shopify app build` needs a linked app and login); dropped deprecated `@shopify/app` (bundled in the CLI); `private: true`.
- Versions: `@shopify/cli` 5.1.0, `shopify-api` 15.1.2, `shopify-app-express` 8.0.6, `session-storage-sqlite` 8.0.4. Express 5.3.0 (required peer); `express` and `shopify-api` are now declared in `web/package.json` (imported but undeclared upstream).
- `web/shopify.js`: `ApiVersion.October26`; removed unused `restResources` import/option (REST is legacy, no 2026-10 set) and the removed `lineItemBilling` flag.
- `web/index.js`: Express 5 paths (`/api/*` to `/api`; `/*` to pathless `app.use`).
- `web/product-creator.js`: `productCreate(product: ProductCreateInput!)` replaces the deprecated `input`.
- `.npmrc`: kept `engine-strict`; removed pnpm-only keys that npm warns about.
- Not copied: Dockerfile, .dockerignore, .gitmodules, .github, nested .gitignore files, `.git-blame-ignore-revs`, template root README/LICENSE/AGENTS/CLAUDE/SECURITY/.vscode (outside Scope).
- `.gitignore`: only appended. The frontend template's `package-lock.json`/`yarn.lock` ignores were deliberately not merged (the root lockfile must be committed).

**Checks (Node 26.0.0, npm 11.12.1)**
- `npm ci`: PASS.
- `npm run build` without a key: FAIL as designed by the template's `vite.config.js`. `CI=true npm run build`: PASS. `SHOPIFY_API_KEY` written to no file.
- Server smoke with fake env vars (browser user agent): OAuth redirects 302, unauthenticated `/api` 302, `/exitiframe` 200, webhook bad HMAC 401, good HMAC 200. Test database and `dist/` removed afterwards.
- No `.ts`/`.tsx`/tsconfig, no direct `typescript`/`@types/*`; no `.env`, `node_modules` or database file in `git status`.
- NOT RUN: `shopify app dev`, install on a store, authenticated Admin API calls (including the changed mutation), `shopify app config validate` (needs a linked app).

**For later slices**
- 02 CI: `npm run build` needs `SHOPIFY_API_KEY` or `CI` set; GitHub Actions sets `CI=true` itself, so no `env:` block is needed.
- 02 CI: `npm audit --audit-level=high` will FAIL: 12 advisories (7 high, 5 moderate). High: `vite` and `nodemon` (via `semver`) and `vi-fetch` (via `decode-uri-component`); all are template dev/build tooling declared in `web` or `web/frontend`.
- Offline tokens: `expiringOfflineAccessTokens` is off (template behaviour; enabling it changes auth, so owner approval is needed). shopify.dev says apps created on or after 2026-12-01, and public apps since 2026-04-01, must use expiring tokens. Decide in plan 03.
- Env examples: nothing loads them yet; plan 02 owns config loading. Frontend omits `CI`/`NODE_ENV`/`npm_lifecycle_event` (set by tooling, not by an env file).
- Frontend still ships template Polaris 10 (deprecated upstream), `translation.yml` and de/fr locales; plan 05.

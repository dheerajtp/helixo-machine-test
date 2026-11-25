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
1. **Check the template.** Confirm it is not archived and works with the current Shopify CLI. If not, reply BLOCKED with the options.
2. **Copy it.** Clone into an empty temporary directory outside the repo, including the frontend template if it is a submodule, then copy the files in without any `.git` directory or `.gitmodules`. Treat the download as untrusted until you have read its `package.json` scripts.
3. **JavaScript only.** No TypeScript files, `tsconfig.json`, `typescript` or `@types/*` as direct dependencies. If the template requires TypeScript, reply BLOCKED.
4. **Leave out** any `Dockerfile`, `.dockerignore` or compose file (Docker needs owner approval, plan 02) and any `.env` file.
5. **UI.** Keep the template's frontend as shipped. Do not add or restyle any screen (UI approval gate).
6. **Workspaces.** One root lockfile with workspaces `web`, `web/frontend`, `extensions/*`, so `npm ci` and `npm run build` work from the root.
7. **Node 22.** Add `.nvmrc` (`22`) and `engines.node` (`>=22 <23`) to every `package.json`. Run all commands on Node 22; if it is not available, reply BLOCKED.
8. **Env examples.** `web/.env.example` and `web/frontend/.env.example`, listing only the variable names the code in that folder reads, with empty values. No root env file.
9. **.gitignore.** Merge the template's entries into the existing root file; never remove existing lines. Remove nested `.gitignore` files only after merging them.
10. Leave SQLite session storage in place; plan 03 replaces it.

## Done when
- `npm ci` and `npm run build` pass from the root on Node 22. If the build needs an env value, report which one; do not create an env file or hardcode a value.
- `git status --short` shows no `.env`, `node_modules` or database file.
- `find . -name '*.ts' -o -name '*.tsx' -not -path '*/node_modules/*'` finds no project source.
- Append `## Result`, including the template commit used.

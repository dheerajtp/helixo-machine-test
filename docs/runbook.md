# Runbook

How to set up, check and run the app locally. Commands run from the repository root.

## 1. Node

The project pins Node 26 in `.nvmrc` and in every `engines.node`; `.npmrc` sets `engine-strict`, so other versions fail to install.

```sh
nvm install   # reads .nvmrc
nvm use
node --version   # v26.x
```

## 2. Install

```sh
npm ci
```

Uses the committed `package-lock.json`. Do not run `npm install` unless you mean to change dependencies.

## 3. Checks

```sh
npm run lint              # ESLint over web/ and web/frontend/
npm test                  # node:test, specs in web/test/**/*.test.js
CI=true npm run build     # builds web/frontend
tools/verify-slice.sh     # lint + all tests; prints LINT: and TESTS: PASS/FAIL
tools/verify-slice.sh web/test/project.test.js   # lint + only the given specs
```

The frontend build needs `SHOPIFY_API_KEY` or `CI` set; without either it stops on purpose (template `vite.config.js`). For a one-off local build use `CI=true`. Do not write the key into any file.

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, test, build and `npm audit --audit-level=high`. The audit step currently fails on template dev and build dependencies; see the known issues in `docs/plans/01-scaffold/03-acceptance.md`.

## 4. Env files

Env variables live only in `web/.env` and `web/frontend/.env`. Each folder has a names-only `.env.example`. Env files are git-ignored and never committed. There is no root env file. During `shopify app dev` the CLI supplies the Shopify values itself.

## 5. Run on the dev store (owner, manual)

The Shopify CLI is a local dependency (`@shopify/cli` 5.1.0), so you do not install it globally. Run it with `npx shopify` or the npm scripts.

1. Check the CLI: `npx shopify version` prints `5.1.0`.
2. Start the dev server: `npm run dev` (runs `shopify app dev`). On first run the CLI asks you to log in to your Partner account, pick or create the app, and pick the dev store. It fills `client_id` in `shopify.app.toml`; that value is public, not a secret.
3. Install the app on the dev store: open the preview URL that the CLI prints and approve the install.
4. Open the app page: in the store admin, go to Apps, open the app, and check that its page loads inside the admin.

Stop the dev server with Ctrl+C.

## 6. Containers

MongoDB and any other containers come in a later plan. They are started only with:

```sh
docker stack deploy -c docker-compose.yml <stack-name>
```

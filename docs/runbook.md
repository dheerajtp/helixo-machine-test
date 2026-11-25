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

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, test, build and `npm audit --audit-level=high`. Tests use an in-memory MongoDB (`mongodb-memory-server`), so they need no Docker.

## 4. Env files

The backend reads `web/config/.env` at boot (variables already set in the shell win), validates it, and stops with a message naming each missing or invalid variable. The frontend uses `web/frontend/.env`. Each app folder has a names-only `.env.example`. `web/config/` is git-ignored and never committed. There is no root env file. During `shopify app dev` the CLI supplies the Shopify values and `BACKEND_PORT` itself; `web/config/.env` still needs `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_URI` and `METRICS_TOKEN` (16 or more characters).

Create the folder, the env file and the MongoDB keyfile once:

```sh
mkdir -p web/config
cp web/.env.example web/config/.env      # then fill in the values
openssl rand -base64 756 > web/config/mongo-keyfile
chmod 600 web/config/.env web/config/mongo-keyfile
```

`MONGO_URI` has the form `mongodb://USER:PASSWORD@localhost:27017/countdown?replicaSet=rs0&authSource=admin`, with the same user and password as `MONGO_USERNAME` and `MONGO_PASSWORD` (URL-encoded). Set `NODE_ENV=production` only on a production host.

## 5. MongoDB (owner, manual)

MongoDB runs in the Docker stack `helixo`, as a single-member replica set `rs0` on port 27017. The stack mounts `web/config/` read-only; on first start its healthcheck initiates the replica set and creates the root user from `MONGO_USERNAME` and `MONGO_PASSWORD`.

1. Start Docker Desktop.
2. Once per machine: `docker swarm init`.
3. Start the stack: `docker stack deploy -c docker-compose.yml helixo`.
4. Check it: `docker service ps helixo_mongo` shows the task `Running`. The healthcheck runs every 10 s with a 40 s start period, so give it up to a minute on first start; `docker ps` then shows the container as `healthy`.
5. Stop it: `docker stack rm helixo`. The data stays in the named volume.

Containers are started only with `docker stack deploy -c docker-compose.yml helixo`.

## 6. Run on the dev store (owner, manual)

The Shopify CLI is a local dependency (`@shopify/cli` 5.1.0), so you do not install it globally. Run it with `npx shopify` or the npm scripts.

1. Check the CLI: `npx shopify version` prints `5.1.0`.
2. Start the dev server: `npm run dev` (runs `shopify app dev`). On first run the CLI asks you to log in to your Partner account, pick or create the app, and pick the dev store. It fills `client_id` in `shopify.app.toml`; that value is public, not a secret.
3. Install the app on the dev store: open the preview URL that the CLI prints and approve the install.
4. Open the app page: in the store admin, go to Apps, open the app, and check that its page loads inside the admin.

5. Check the backend: the boot log has a line `"msg":"Listening"` with the backend `port`. Then:

   ```sh
   curl -i http://localhost:<port>/health   # 200, {"success":true,"message":"OK",...}
   curl -i http://localhost:<port>/ready    # 200 once MongoDB is connected
   ```

   `/ready` returns 503 `NOT_READY` while MongoDB is unreachable (for example after `docker stack rm helixo`) and during shutdown; the server keeps running and retries the connection.

Stop the dev server with Ctrl+C. The backend drains requests for up to 10 s, closes MongoDB and exits 0.

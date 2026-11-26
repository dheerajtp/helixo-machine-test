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

The backend reads `web/config/.env` at boot (variables already set in the shell win), validates it, and stops with a message naming each missing or invalid variable. The frontend uses `web/frontend/.env`. Each app folder has a names-only `.env.example`. `web/config/` is git-ignored and never committed. There is no root env file. During `shopify app dev` the CLI supplies the Shopify values and `BACKEND_PORT` itself; `web/config/.env` still needs `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_APP_USERNAME`, `MONGO_APP_PASSWORD`, `MONGO_URI` and `METRICS_TOKEN` (16 or more characters).

Create the folder, the env file and the MongoDB keyfile once:

```sh
mkdir -p web/config
cp web/.env.example web/config/.env      # then fill in the values
openssl rand -base64 756 > web/config/mongo-keyfile
chmod 600 web/config/.env web/config/mongo-keyfile
```

`MONGO_URI` has the form `mongodb://APP_USER:APP_PASSWORD@localhost:27017/countdown?replicaSet=rs0&authSource=admin`, with the same user and password as `MONGO_APP_USERNAME` and `MONGO_APP_PASSWORD` (URL-encoded). The app user has `readWrite` on `countdown` only; `MONGO_USERNAME` is the root user, for administration. Set `NODE_ENV=production` only on a production host.

## 5. MongoDB (owner, manual)

MongoDB runs in the Docker stack `helixo`, as a single-member replica set `rs0` on port 27017. The stack mounts `web/config/` read-only; on first start its healthcheck initiates the replica set and creates the root user from `MONGO_USERNAME` and `MONGO_PASSWORD` and the app user from `MONGO_APP_USERNAME` and `MONGO_APP_PASSWORD`. Changing a password in the env file does not change it in an existing database.

Known limits: port 27017 is published on all network interfaces (Swarm cannot bind a published port to one address), and the container can read all of `web/config/`. Remove the stack when you are not developing.

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

## 7. Auth, sessions and webhooks (owner, manual, plan 03)

1. **Migrations.** With MongoDB up (section 5), run once: `npm run migrate -w shopify-app-template-node`. It applies pending migrations from `web/migrations/` and records them in the `migrations` collection; running it again does nothing. `npm run migrate -w shopify-app-template-node -- down` reverses the last applied one. The app builds no indexes at boot (`autoIndex` off), so run this before using the app.
2. **Authorize again.** Sessions now live in MongoDB (`shopify_sessions`); the old SQLite sessions were not migrated. Open the app on the dev store and approve it again. `web/database.sqlite` is no longer used and can be deleted.
3. **Scopes.** The app asks only for `read_products`. Where the Shopify CLI does not inject it, set `SCOPES=read_products` in `web/config/.env`. The scope change needs re-approval on the dev store. The template's "populate products" demo fails until plan 05 removes it.
4. **Webhooks.** `app/uninstalled` and the compliance topics (`customers/data_request`, `customers/redact`, `shop/redact`) are declared in `shopify.app.toml` with `uri = "/api/webhooks"`; for local work `npm run dev` should apply them to the dev store using its tunnel URL (not yet verified). Do not run `npm run deploy` until the app has a hosted URL: it resolves `/api/webhooks` against `application_url`, still a placeholder, and Shopify rejects the version. Every delivery is HMAC-verified (bad signature: 401). Check: uninstall the app on the dev store and confirm the shop has no documents left in `shopify_sessions`.
5. **Rate limit.** `/api/*` allows 100 requests per minute per shop, then 429 `RATE_LIMITED`. Webhooks and OAuth are not limited. The counter is in memory: it resets on restart and is per process, so with more than one instance each one counts separately.
6. **Network access.** Shopify's network access declaration for the app is set by the owner in the Dev Dashboard; it is not verified here.

## 8. Timer indexes (owner, manual, plan 04)

1. **Migrate once.** With MongoDB up (section 5), run `npm run migrate -w shopify-app-template-node` once to build the timer indexes (`002-timer-indexes`: `shop_1__id_-1`, `shop_1_sortAt_1__id_1`, `shop_1_enabled_1_targetType_1`). If section 7 was already run, this applies only `002-timer-indexes`; running it again does nothing. `-- down` drops these three indexes and leaves the timers. Run it before creating timers: the app builds no indexes at boot. The log line `Migrations finished` lists what was applied (`[]` on a repeat run).

## 9. Timer dashboard (owner, manual, plan 05)

Needs sections 5–8 done and `npm run dev` running. The list shows 20 timers per page. Create and Edit are disabled until plan 06 adds the form, so test timers are made from the browser console.

1. **Open the app.** In the store admin, open the app. The page heading is "Countdown Timer Manager". While the first request runs, a spinner shows.
2. **Empty state.** With no timers for this shop, the page shows "Create your first timer" with a disabled "Create timer" button.
3. **Open the app frame's console.** Open DevTools on the admin tab (Chrome: Cmd+Option+J). In the console's context dropdown (top left, default `top`), pick the app's iframe (its URL is your dev tunnel). `typeof shopify.idToken` must print `"function"`; if not, the wrong frame is selected.
4. **Create two timers.** Paste and run:

   ```js
   (async () => {
     const post = async (body) => {
       const res = await fetch("/api/timers", {
         method: "POST",
         headers: { Authorization: `Bearer ${await shopify.idToken()}`, "Content-Type": "application/json" },
         body: JSON.stringify(body),
       });
       console.log(res.status, await res.json());
     };
     const now = Date.now();
     await post({
       name: "Fixed test", type: "fixed", description: "Ends in 7 days",
       startAt: new Date(now - 3600e3).toISOString(), endAt: new Date(now + 7 * 864e5).toISOString(),
       targetType: "all", targetIds: [], appearance: { backgroundColor: "#d72c0d" },
     });
     await post({
       name: "Evergreen test", type: "evergreen", durationSeconds: 1800,
       targetType: "all", targetIds: [], appearance: { backgroundColor: "#008060" },
     });
   })();
   ```

   Each line must start with `201`. Reload the app page.
5. **List.** Both rows show. "Fixed test": status Active, type Fixed, target "All products", start and end in your local time. "Evergreen test": Active, Evergreen, "30 minutes per visitor". Impressions show 0 (counting arrives in plan 09).
6. **Disable / Enable.** Open a row's actions menu and pick Disable. A "Timer disabled" toast shows and the badge turns Disabled. Pick Enable: "Timer enabled", badge back to Active. Edit in the menu is disabled.
7. **Paging.** Make 23 more timers (25 in total), then reload:

   ```js
   (async () => {
     for (let i = 1; i <= 23; i += 1) {
       const res = await fetch("/api/timers", {
         method: "POST",
         headers: { Authorization: `Bearer ${await shopify.idToken()}`, "Content-Type": "application/json" },
         body: JSON.stringify({ name: `Paging ${i}`, type: "evergreen", durationSeconds: 600, targetType: "all", targetIds: [], appearance: { backgroundColor: "#202223" } }),
       });
       if (res.status !== 201) { console.log(i, res.status, await res.json()); break; }
     }
     console.log("done");
   })();
   ```

   Page 1 shows 20 rows; Next shows the other 5; Previous returns to page 1 with the same rows. The rate limit is 100 requests per minute, so do not run this more than about three times a minute.
8. **Search and sort.** Type `fixed` in "Search timers": after a short pause only "Fixed test" shows and you are on page 1. Type `zzz`: "No timers match "zzz"" with a "Clear search" button, which brings the full list back. Switch Sort between oldest and newest: the order flips and paging restarts at page 1.
9. **Delete.** Pick Delete in a row's menu. A modal asks `Delete "<name>"?`. Cancel closes it and nothing changes. Delete again and confirm: the modal closes, a "Timer deleted" toast shows and the row is gone. While the request runs, the buttons are disabled.
10. **Delete the last row of a later page.** On page 2 with one row left (delete rows until one remains), delete it: the list goes back to page 1.
11. **Error state with retry.** In DevTools, Network tab, set throttling to "Offline", then change the sort (or reload the app frame). After the automatic retries (react-query retries 3 times, so allow about 10 s) the page shows "Timers could not be loaded" with a Retry button. Set throttling back to "No throttling" and press Retry: the list returns. Alternative: stop MongoDB with `docker stack rm helixo`; each try then waits for the 5 s server-selection timeout, so allow about 30 s. Start it again with `docker stack deploy -c docker-compose.yml helixo`.
12. **Clean up.** Delete the test timers from the list, or keep them for plan 06.

Not yet checked in a real browser (from slice 05/02); watch for these while doing the steps above and report any that fail:

- Every Polaris web component renders as in `docs/ui/dashboard-list.png` and `docs/ui/dashboard-states.png`.
- Table paging: the Previous and Next controls fire (`s-table` `nextpage` / `previouspage` events).
- The actions menu opens from its button (`s-menu` with `commandFor`).
- Icons show: `menu-horizontal`, `plus`, `edit`, `delete`.
- The Sort select reacts to a change (`s-select` `change` event).
- The delete modal opens and closes (`showOverlay`, `hideOverlay`, `afterhide`).
- Toasts show for success and failure.
- `shopify.idToken()` attaches a working token, and a stale session sends the top window to re-authorize.
- Known edge: if all rows of a later page are deleted elsewhere and you then open that page without a search, it shows the no-match message with an empty query.

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
3. **Scopes.** The app asks for `read_products` (and, from plan 07, `write_app_proxy`; see section 11). Where the Shopify CLI does not inject them, set `SCOPES=read_products,write_app_proxy` in `web/config/.env`. The scope change needs re-approval on the dev store. The template's "populate products" demo fails until plan 05 removes it.
4. **Webhooks.** `app/uninstalled` and the compliance topics (`customers/data_request`, `customers/redact`, `shop/redact`) are declared in `shopify.app.toml` with `uri = "/api/webhooks"`; for local work `npm run dev` should apply them to the dev store using its tunnel URL (not yet verified). Do not run `npm run deploy` until the app has a hosted URL: it resolves `/api/webhooks` against `application_url`, still a placeholder, and Shopify rejects the version. Every delivery is HMAC-verified (bad signature: 401). Check: uninstall the app on the dev store and confirm the shop has no documents left in `shopify_sessions`.
5. **Rate limit.** `/api/*` allows 100 requests per minute per shop, then 429 `RATE_LIMITED`. Webhooks and OAuth are not limited. The counter is in memory: it resets on restart and is per process, so with more than one instance each one counts separately.
6. **Network access.** Shopify's network access declaration for the app is set by the owner in the Dev Dashboard; it is not verified here.

## 8. Timer indexes (owner, manual, plan 04)

1. **Migrate once.** With MongoDB up (section 5), run `npm run migrate -w shopify-app-template-node` once to build the timer indexes (`002-timer-indexes`: `shop_1__id_-1`, `shop_1_sortAt_1__id_1`, `shop_1_enabled_1_targetType_1`). If section 7 was already run, this applies only `002-timer-indexes`; running it again does nothing. `-- down` drops these three indexes and leaves the timers. Run it before creating timers: the app builds no indexes at boot. The log line `Migrations finished` lists what was applied (`[]` on a repeat run).

## 9. Timer dashboard (owner, manual, plan 05)

Needs sections 5–8 done and `npm run dev` running. The list shows 20 timers per page. Timers are made with the form (plan 06, section 10); only paging still uses the browser console.

1. **Open the app.** In the store admin, open the app. The page heading is "Countdown Timer Manager". While the first request runs, a spinner shows.
2. **Empty state.** With no timers for this shop, the page shows "Create your first timer" with a "Create timer" button that opens the form.
3. **Open the app frame's console** (needed only for step 7 and section 10 step 9). Safari: once, turn on Settings > Advanced > "Show features for web developers". On the admin tab press Cmd+Option+C. In the frame menu at the right end of the console's input line, pick the app's frame (its URL is your dev tunnel). `typeof shopify.idToken` must print `"function"`; if not, the wrong frame is selected. Chrome: Cmd+Option+J, then the context dropdown at the top left of the console.
4. **Create two timers** with the form (section 10, steps 2 and 3): "Fixed test", fixed, start one hour ago, end in 7 days, description "Ends in 7 days", All products; and "Evergreen test", evergreen, 30 minutes, All products.
5. **List.** Both rows show. "Fixed test": status Active, type Fixed, target "All products", start and end in your local time. "Evergreen test": Active, Evergreen, "30 minutes per visitor". Impressions show 0 (counting arrives in plan 09).
6. **Disable / Enable.** Open a row's actions menu and pick Disable. A "Timer disabled" toast shows and the badge turns Disabled. Pick Enable: "Timer enabled", badge back to Active. Edit in the menu opens the form (section 10).
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
11. **Error state with retry.** In DevTools (Chrome), Network tab, set throttling to "Offline", then change the sort (or reload the app frame). After the automatic retries (react-query retries 3 times, so allow about 10 s) the page shows "Timers could not be loaded" with a Retry button. Set throttling back to "No throttling" and press Retry: the list returns. If your Safari's Network tab has no offline option, use the alternative. Alternative: stop MongoDB with `docker stack rm helixo`; each try then waits for the 5 s server-selection timeout, so allow about 30 s. Start it again with `docker stack deploy -c docker-compose.yml helixo`.
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

## 10. Timer form (owner, manual, plan 06)

Needs section 9 steps 1–3 working. Compare the modal with `docs/ui/timer-form.png` as you go, also at a narrow window width.

1. **Open and close.** Press "Create timer" in the title bar: a modal "Create New Timer" opens. Press Cancel: it closes with no prompt. Open it again, type a name, then close it with the X, Escape and a click outside (one per try): each time "Discard unsaved changes?" asks. "Keep editing" brings the modal back with the name kept; discarding and reopening shows an empty form.
2. **Create a fixed timer.** Name "Fixed test", Timer type Fixed. Pick start and end dates; type the times as `9:30 PM` or `21:30`. The line under the dates names your time zone. Leave "Show on" at All products, pick a background color (the hex field follows it, and typing a hex moves the picker), set size, position, urgency notification and minutes. Press "Create timer": the modal closes, a "Timer created" toast shows and the row appears with start and end as you typed them.
3. **Create an evergreen timer.** Timer type Evergreen: the dates are replaced by Duration and Unit. Enter 30 Minutes and create it. The row shows "30 minutes per visitor".
4. **Browser validation.** Open the form and press "Create timer" with everything empty: errors show under Timer name, Start and End (date and time). Set end before start: the error shows under End. Evergreen with duration 0: error under Duration. A hex like `12345`: error under the color. While a request runs, pressing the button again does nothing.
5. **Edit.** In a row's actions menu pick Edit: the modal is titled "Edit Timer", the button says "Save changes", every value is filled in and the timer type cannot be changed. Change the name and save: "Timer saved" toast and the new name in the list. Edit again and close without changes: no prompt.
6. **Pick products.** Create a timer with "Show on" Specific products. Pressing "Create timer" with nothing picked shows "Select at least one product". Press "Browse products": the Shopify picker opens above the modal. Pick two products: they show as chips with their titles. Open the picker again: the two are preselected; press Cancel in the picker: the chips stay. Remove one chip with its x: the form stays open and no discard prompt shows. Save.
7. **Selection survives editing.** Edit that timer: "Show on" is Specific products and the chip shows "Product <number>" (titles are not stored; see known issues). Open the picker: the saved product is preselected. Save without changes, edit again: still the same product.
8. **Collections.** Repeat steps 6 and 7 with Specific collections ("Browse collections", "Collection <number>" on edit). Switch "Show on" from collections to products: the collection chips are cleared.
9. **Server field errors on screen.** The form checks everything the server checks, so make the browser send bad values once. In the app frame's console (section 9 step 3) run:

   ```js
   const realFetch = window.fetch;
   window.fetch = (url, init) => {
     if (init?.method === "POST") {
       window.fetch = realFetch; // one request only
       const body = JSON.parse(init.body);
       body.name = "x".repeat(101);
       body.appearance.backgroundColor = "red";
       if (body.type === "fixed") body.endAt = body.startAt;
       init = { ...init, body: JSON.stringify(body) };
     }
     return realFetch(url, init);
   };
   ```

   Fill a valid fixed timer and press "Create timer". The modal stays open with a red banner "Validation failed", the server's messages under Timer name, End and the color field, and your values kept. Press "Create timer" again: it saves (the patch was one-shot).
10. **Request error banner.** Open Edit on a timer, then delete that timer in another admin tab. Press "Save changes": the banner shows "Timer not found" and the modal stays open.
11. **Picker failure.** Not needed unless the picker fails to open; then a banner "The picker could not be opened. Try again." shows in the form.

Report any step that fails, and especially these, which no slice could check in a browser:

- The modal layout against `docs/ui/timer-form.png`, on a wide and a narrow window, and on the Shopify mobile app if you use it.
- Each Polaris field reacts to input: text, number, text area, selects, checkbox, the "Show on" and type choice lists, date picker (it opens inside the modal), color picker.
- The X, Escape, outside click and Cancel all close the modal and lead to the discard prompt only when something changed.
- The resource picker opens above the modal, preselects, caps at 100 and cancel keeps the chips; removing a chip moves keyboard focus somewhere sensible.
- Toasts, focus on open, and screen reader labels.

## 11. Storefront timer API (owner, manual, plan 07)

Needs sections 5–10 done and at least one timer that is enabled and running now (for example "Fixed test" from section 9).

1. **Restart the dev server.** Stop `npm run dev` with Ctrl+C and start it again. `shopify.app.toml` now has an `[app_proxy]` block (`/apps/countdown` on the store forwards to `/proxy` on the app) and the scope `write_app_proxy`; the CLI applies both on start.
2. **Approve the new scope.** Open the app in the store admin. Shopify asks to approve the changed access (app proxy); approve it. If it does not ask, open the preview URL the CLI prints. Where the CLI does not inject scopes, set `SCOPES=read_products,write_app_proxy` in `web/config/.env` first.
3. **Find a product id.** In the store admin open a product; the number at the end of the URL (`/admin/products/<number>`) is its id. Use a product your running timer targets (an "All products" timer matches every product).
4. **Open the endpoint in Safari.** If the dev store has a password, open the storefront once and enter it. Then open `https://<store>.myshopify.com/apps/countdown/timer?productId=<number>` (add `&collectionIds=<number>,<number>` to test collection timers). The page shows JSON: `success: true`, and `data` with exactly `id`, `type`, `endAt` (fixed) or `durationSeconds` (evergreen), `description`, `appearance`, `urgencyEffect`, `urgencyThresholdSeconds`, `serverNow`. No `shop`, `name`, `targetIds`, `startAt` or `enabled`. A product with no running timer gives `data: null`, still 200.
5. **Check the headers.** Safari: Develop > Show Web Inspector (Cmd+Option+I), Network tab, reload, select the `timer` request, Headers. Check:
   - Status 200, `Content-Type: application/json`.
   - `Cache-Control: public, max-age=60` (lower for a fixed timer ending within a minute). Report the exact value if Shopify changed it.
   - `ETag` present, of the form `"<24 hex>-<number>"` (`"none"` when `data` is null). Report if it is missing.
   - Reload: the request shows 304 or comes from cache, and `serverNow` in a fresh 200 changes while the `ETag` stays the same.
6. **Signature check.** Open the backend directly, not through the store: `curl -i "http://localhost:<port>/proxy/timer?productId=1"` (port from the `"msg":"Listening"` log line). It returns 401 `UNAUTHORIZED` with `Cache-Control: no-store`.
7. **Edit changes the ETag.** Edit the timer in the app (for example its description), wait up to 60 s (the cache), reload the URL: the new description shows and the `ETag` changed.

Report any step that fails, and especially these, which no slice could check against a real store:

- Shopify forwards `/apps/countdown/timer` to `/proxy/timer` with a valid signature (a 401 in step 4 means it does not).
- Shopify keeps `Cache-Control`, `ETag` and the 304 answer unchanged.
- The response time shown in the Network tab (the app itself answers in under 5 ms locally; the rest is Shopify and the tunnel).
- The `X-Forwarded-For` header Shopify sends (only visible in the backend; the per-IP rate limit depends on its first entry).


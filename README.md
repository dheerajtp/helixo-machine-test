# Countdown Timer + Analytics

A Shopify app for promotion countdown timers. Merchants create timers in the Shopify admin; shoppers see them on product pages; the app counts how many visitor sessions saw each one.

## What it does

- **Two timer types.** *Fixed*: the same start and end for everyone. *Evergreen*: starts on each visitor's first view, kept in `localStorage`, and restarts in a later browser session after it expires.
- **Targeting:** all products, chosen products, or chosen collections (Shopify resource picker).
- **Appearance:** background colour (text turns black or white for contrast), size, position, promotion text, and an urgency effect (colour pulse or blinking) near the end.
- **Dashboard:** status (active, scheduled, expired, disabled), search, sort, paging, enable/disable, delete with confirmation, impressions per timer.
- **Storefront:** a theme app extension block (no ScriptTag). It reserves space only on targeted products and renders nothing if anything fails.

## Stack

Node 26, Express 5, MongoDB 8 (Mongoose), React 18 with Polaris web components and App Bridge, Preact for the widget, Vite, Joi, Shopify CLI 5.

## Setup

You need Node 26 (`.nvmrc`), Docker Desktop, a Shopify Partner account and a development store.

```sh
# 1. Install
nvm use
npm ci

# 2. Configure (never committed)
mkdir -p web/config
cp web/.env.example web/config/.env            # fill in the MongoDB values and METRICS_TOKEN
openssl rand -base64 756 > web/config/mongo-keyfile
chmod 600 web/config/.env web/config/mongo-keyfile

# 3. Start MongoDB (a single-member replica set, in Docker Swarm)
docker swarm init                              # once per machine
docker stack deploy -c docker-compose.yml helixo

# 4. Build the indexes (once, and after pulling new migrations)
npm run migrate -w shopify-app-template-node

# 5. Run (builds the widget, then starts `shopify app dev`)
npm run dev
```

On first run the CLI asks you to log in and pick the app and store. Open the preview URL and approve the install. Then, in **Online Store → Themes → Edit theme**, open the product template and choose **Add block → Apps → Countdown timer**.

While `shopify app dev` runs, the CLI supplies the Shopify values. `web/config/.env` needs `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_APP_USERNAME`, `MONGO_APP_PASSWORD`, `MONGO_URI` and `METRICS_TOKEN` (16+ characters). The URI has the form `mongodb://APP_USER:APP_PASSWORD@localhost:27017/countdown?replicaSet=rs0&authSource=admin`.

Use `npm run dev`, not `shopify app dev` directly: the widget bundle is built by the npm script and is not committed. Full instructions and troubleshooting are in [docs/runbook.md](docs/runbook.md).

## Checks

```sh
npm run lint
npm test                    # node:test; the database tests use an in-memory MongoDB
CI=true npm run build       # admin app, and the widget with its size limit
```

CI runs these plus `npm audit --audit-level=high`. The tests need about 1 GB of free disk for the temporary database.

## Architecture

```
Shopify admin ── React app ──/api──►┐
                                    │  Express: routes → controllers → services → repositories ──► MongoDB
Storefront ── Preact widget ─ app ──►│
              (theme block)   proxy └── app-data metafield ──► read by the theme block (Liquid)
```

| Folder | Contents |
| --- | --- |
| `web/src` | Backend |
| `web/frontend` | Admin app |
| `widget` | Storefront widget source |
| `extensions/countdown-timer` | Theme app extension |
| `web/migrations` | Versioned, reversible index migrations |

### Data

Every document carries `shop`, and every query is scoped by it.

| Collection | Holds | Indexes |
| --- | --- | --- |
| `timers` | Timer, targeting and appearance | by shop; start-date sort and cursor; shop + enabled + target type |
| `timer_stats` | Impressions per timer per UTC day | unique shop + timer + day |
| `impression_keys` | Which session was already counted | unique shop + timer + session; expires after 24 h |
| `shopify_sessions` | Shopify sessions and tokens | unique id; shop |

### Decisions

- **Own session store** on the app's Mongoose connection instead of the template's SQLite, so there is one database and one connection.
- **App proxy** for the storefront: same origin as the shop (no CORS), and Shopify signs each request, so the shop is never taken from a value the browser can choose.
- **Status is computed, never stored**, so it cannot go stale.
- **Targeting is also written to an app-data metafield.** The theme block reads it before the page is painted, so space is reserved only where a timer will appear, with no gap elsewhere and no layout shift. A failed write never fails the timer request. Until the first successful write the block reserves space on every product; after a later failure it works from the older data until the next change, and the widget still draws a timer it did not reserve space for (one shift).
- **Impressions are idempotent:** the session key and the daily counter are written in one transaction.
- **No queue or cache server.** One instance and MongoDB are enough at this size.

## Performance

- Widget: about 7.8 KB gzipped, script and styles (target 15 KB; the build fails above 30 KB).
- One request per page for the timer, with a 3 s timeout, one retry and no polling.
- `Cache-Control: public, max-age=60` and an `ETag`; unchanged timers answer `304`.
- Timer selection is a single indexed query that picks the winner inside the database, with a projection and a 500 ms limit. Locally, the slowest of 100 requests against 500 timers was under 5 ms (the app only; Shopify's proxy and the network are not included and have not been measured).
- Reserved height, so the countdown does not move the page when it arrives.
- Countdown corrects the shopper's clock from the server's, and is computed from the clock rather than by counting ticks.

## Rate limiting

`express-rate-limit`, counted per minute:

| Routes | Limit | Key |
| --- | --- | --- |
| `/api/*` | 100 | shop (from the verified session) |
| `GET /proxy/timer` | 300 | shop + shopper IP |
| `POST /proxy/impressions` | 60 | shop + shopper IP |

Over the limit: `429` with `RateLimit` headers. Storefront limits apply only after the signature check. Webhooks and OAuth are not limited.

Limitations: counters are in memory, so they reset on restart and are per process; more than one instance would need a shared store. The shopper IP is the first `X-Forwarded-For` entry. If Shopify passes through a value sent by the browser, a shopper could vary it to avoid the per-IP limit; a per-shop ceiling would close this.

## Security

- Admin requests need a verified session token; storefront requests a verified proxy signature; webhooks a verified HMAC.
- All input is validated with Joi, unknown fields are dropped, and MongoDB operator keys are rejected.
- Merchant text is stored as written and only ever rendered as text, never HTML.
- The app's database user can only read and write the app database.
- No customer data is stored. The privacy webhooks are implemented; `shop/redact` deletes the shop's data.
- Scopes: `read_products`, `write_app_proxy`.

## API

See [docs/api.md](docs/api.md).

## Assumptions

- One app instance, and a development store; the app is not deployed to a hosted URL.
- English only.
- Times are entered in the merchant's browser time zone and stored in UTC.
- One timer per product page: a product timer beats a collection timer, which beats an all-products timer; the newest wins a tie.
- An impression is one per visitor session per timer, where a session is a browser tab.
- A fixed timer cannot be given a start time in the past.

## Known limitations and what I would improve

- **Not yet verified on a real store:** that untargeted products have no gap, the product page with the app stopped, layout shift, and impression counting through the app proxy.
- **Not deployed.** `npm run deploy` needs a hosted `application_url`.
- **Impression counts are indicative:** a determined visitor can invent session ids.
- **Database backup and restore** scripts are not written yet.
- Saved product and collection targets show as numbers when editing, not names (needs Direct API access).
- Server validation messages use field names and API units.
- Form validation runs on submit, not as each field is left.
- Two overlapping edits of one timer: the later one wins.
- The widget has no live preview in the admin.
- Port 27017 is published on all interfaces by Docker Swarm; remove the stack when not developing.
- The admin screens use Polaris web components, whose behaviour is not covered by automated tests.

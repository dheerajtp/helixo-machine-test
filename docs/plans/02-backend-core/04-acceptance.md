# 02/04 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 02/01, 02/02, 02/03 · Parallel with: none

## Decisions you need
From the repo root run `grep -E '^\| (B[0-9]+) ' docs/plans/02-backend-core/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01–03, `docs/runbook.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual check and record commands and output as evidence.
2. Update `docs/runbook.md`: create `web/config/` with `.env` and `mongo-keyfile` (`openssl rand -base64 756`), start Docker Desktop, `docker swarm init` once, `docker stack deploy -c docker-compose.yml helixo`, how to check the service is healthy (`docker service ps helixo_mongo`), `docker stack rm helixo` to stop, then `npm run dev` and curl `/health` and `/ready` on the backend port printed at boot. Never mention any other way of starting containers.
3. Owner steps stay MANUAL (do not run Docker). List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result
**Changed:** `docs/runbook.md` (sections 3–6: env file in `web/config/`, keyfile, MongoDB stack steps, `/health` and `/ready` checks, clean stop; CI audit note updated, it now passes), this file.

Evidence: `/private/tmp/claude-501/-Users-dheerajtp-helixo-machine-test/4aeccd5c-8804-4204-8274-c552b8c7f003/scratchpad/evidence-02/` (`01-npm-ci.txt` … `08-verify-slice-after-docs.txt`, smoke script `05-smoke.sh` and output `05-smoke-output.txt`, test names `06-test-names.txt`).

**Checks**
- `npm ci`: PASS
- `tools/verify-slice.sh`: PASS (lint; 33/33 tests), before and after the docs change
- `CI=true npm run build`: PASS
- `npm audit --audit-level=high`: PASS (exit 0; moderate findings only)
- Smoke (scratchpad copy of `web/` without `config/`, fake env on the command line via `env -i`, unreachable `MONGO_URI`): see the rows below
- `grep -nE 'compose up|docker run|docker-compose up' docs/runbook.md`: no match

**Acceptance checklist**
| Row | Result | Evidence |
| --- | --- | --- |
| `curl /health` returns 200; `/ready` returns 503 when Mongo is stopped | PASS (Mongo unreachable); MANUAL (real stack stopped, and `/ready` 200 with it running) | Smoke: `/health` 200 success envelope, `/ready` 503 `NOT_READY`. Tests `/health is 200 even when the database is down`, `/ready: 200 when ready, 503 without the database or while shutting down` |
| Invalid input returns the error envelope with field details | PASS (tests only) | `validation strips unknown fields, converts, and reports each field` (details `name`, `count`), `validation covers params, query and headers, allowing unknown headers`, `operator and dotted keys are rejected at any depth`, `empty PATCH body is rejected, including one with only unknown fields`, `not found and body-parser errors` |
| Missing env var stops the boot with a clear message | PASS | Smoke: `Invalid configuration: "MONGO_URI" is required` exit 1; both missing names listed with exit 1. Tests `each missing required value is named`, `errors name the variable and never include values` |
| Ctrl+C closes cleanly | PASS (SIGINT) | Smoke: SIGINT exit 0 in 4 s, SIGTERM exit 0 in 5 s, `Shutting down` logged |

**MANUAL (owner, Docker not run here):** create `web/config/` (`.env`, `mongo-keyfile`), `docker swarm init`, `docker stack deploy -c docker-compose.yml helixo`, `docker service ps helixo_mongo` healthy, `npm run dev`, `curl /health` 200 and `/ready` 200, then `docker stack rm helixo` and `/ready` 503. Steps are in `docs/runbook.md` sections 4–6.

**Known issues**
- The Docker stack, the real mongosh healthcheck (`docker/mongo/health.js`, tested only against a stub) and `/ready` 200 against the real replica set are untested.
- No production route uses `validate()` yet; the validation row is proven on an in-test Express app only. Plan 03 adds the first real routes.
- Shutdown with MongoDB unreachable takes 4–5 s (pending server selection), within the 10 s drain.
- Helmet defaults `Referrer-Policy: no-referrer` and `Cross-Origin-Resource-Policy: same-origin` are on; embedding in the Shopify admin is unchecked (MANUAL on the dev store).
- `NODE_ENV` is no longer set by scripts; production must set `NODE_ENV=production` in `web/config/.env`.
- `/api/*` without a session returns 302 to `/api/auth` (template behaviour), not an envelope.

**Owner manual checks (2026-11-26):** stack deployed and `helixo_mongo` healthy; `/health` and `/ready` 200 with it running; app preview loads in the Shopify admin; after `docker stack rm helixo`, `/ready` 503 `NOT_READY`. These close the MANUAL items and the untested-Docker and admin-embedding known issues above.

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

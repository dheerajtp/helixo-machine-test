# 02/01 — Config, Docker MongoDB, connection

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: none

## Decisions you need
From the repo root run `grep -E '^\| (B1|B2|B3|B9|B10|B11) ' docs/plans/02-backend-core/00-README.md`.

## Read first
- `CLAUDE.md` (Docker and env rules), `CLAUDE_BACKEND_MONGODB.md` sections 7, 11, 19
- `web/package.json`, `web/.env.example`, `web/shopify.js`, `web/index.js` (which env names are read), `.gitignore`

## Scope (files you own)
`docker-compose.yml`, `docker/mongo/health.js`, `.gitignore`, `web/.env.example`, `web/src/config.js`, `web/src/db/**`, `web/test/**`, `web/package.json`, `package-lock.json`.

## Tasks
1. **Compose file.** The owner approved this exact content (2026-11-25). Write `docker-compose.yml` byte for byte; if you think it must change, reply BLOCKED.
```yaml
version: "3.8"

services:
  mongo:
    image: mongo:8.0
    entrypoint: ["bash", "-c"]
    command:
      - |
        install -m 400 -o mongodb -g mongodb /run/config/mongo-keyfile /tmp/keyfile
        exec docker-entrypoint.sh mongod --replSet rs0 --keyFile /tmp/keyfile --bind_ip_all
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
      - ./web/config:/run/config:ro
      - ./docker/mongo:/opt/helixo:ro
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--norc", "/opt/helixo/health.js"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 40s
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: "1"
          memory: 1G

volumes:
  mongo-data:
```
2. **`docker/mongo/health.js`** (mongosh script, runs inside the container). Parse `/run/config/.env` for `MONGO_USERNAME` and `MONGO_PASSWORD` (lines `NAME=value`; strip one pair of surrounding quotes). Missing values: throw. Try `db.getSiblingDB("admin").auth(user, password)`. If it succeeds and `db.hello().isWritablePrimary`, `quit(0)`. Otherwise use the localhost exception: `rs.initiate({_id: "rs0", members: [{_id: 0, host: "localhost:27017"}]})` (ignore only "already initialized"), wait up to 5 s for primary, create the user with role `root` on `admin`. Idempotent; any other error throws. Never print the password.
3. **`.gitignore`:** append `web/config/`.
4. **`web/.env.example`:** add `MONGO_USERNAME=`, `MONGO_PASSWORD=`, `MONGO_URI=`, `METRICS_TOKEN=`, with a comment that the file is copied to `web/config/.env` and the URI form is `mongodb://USER:PASSWORD@localhost:27017/countdown?replicaSet=rs0&authSource=admin` (password URL-encoded). Never create `web/config/`.
5. **`web/src/config.js`:** export `loadConfig(source = process.env)` returning a frozen object, and `loadEnvFile()` (path resolved from the module, not cwd; ignore only ENOENT). Joi schema: `NODE_ENV` development|test|production, default development; `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `HOST` required; `SCOPES` string, empty allowed; `BACKEND_PORT`/`PORT` port, default 3000; `MONGO_URI` required, `mongodb` scheme; `METRICS_TOKEN` min 16. Unknown variables allowed. Errors name the variable and never include values.
6. **`web/src/db/connection.js`** (mongoose): `connect(uri, {logger})` retries with backoff (1 s doubling to 30 s) until connected or `disconnect()` is called, never logs the URI; options and settings as B2 (also `strictQuery` true); `isReady()` pings with `maxTimeMS` 1000; `disconnect()`.
7. **Scripts (B11):** remove `cross-env` and the `NODE_ENV=` prefixes; `dev` stays `node --watch index.js`, `serve` becomes `node index.js`. Check `web/index.js` still behaves when `NODE_ENV` is unset.
8. **Tests:** config (valid, each missing required value, no value leaked in errors); connection against `mongodb-memory-server` `MongoMemoryReplSet` with one member, MongoDB 8.0 binary set in code (ready, transaction commits, disconnect). Tests need no env variables and no Docker.

## Done when
- `npm ci` and `tools/verify-slice.sh` pass; `node --check docker/mongo/health.js` passes.
- The compose block above and `docker-compose.yml` are identical; it has no `env_file` or `environment`.
- Do NOT run `docker swarm init`, `docker stack deploy` or any other command that starts containers or changes Docker. Report the Docker run as NOT RUN.
- Append `## Result`.

## Result
**Changed:** `docker-compose.yml` (new, identical to the approved block), `docker/mongo/health.js`, `web/src/config.js`, `web/src/db/connection.js`, `web/.env.example`, `web/package.json` (added `joi`, `mongoose`, dev `mongodb-memory-server`; removed `cross-env` and the `NODE_ENV=` prefixes), `package-lock.json`, `web/test/{config,db-connection,mongo-health}.test.js`. `.gitignore` already had `web/config/`, so it is unchanged.

**Checks**
- `npm ci`: PASS
- `tools/verify-slice.sh`: PASS (lint; 13/13 tests, MongoDB 8.0.4 in memory)
- `node --check docker/mongo/health.js`: PASS
- Compose block vs `docker-compose.yml`: identical; no `env_file`/`environment`
- `npm audit --audit-level=high`: PASS (3 moderate, in web/frontend dependencies)
- Docker run (`docker stack deploy`, real healthcheck in mongosh): NOT RUN. `health.js` is tested only against a stub.

**Notes**
- `npm install -w web` also matches the nested `web/frontend` workspace. Use `-w shopify-app-template-node`.
- `METRICS_TOKEN` is required (the slice only said "min 16"); `web/config/.env` needs it, plus `MONGO_URI`.
- `NODE_ENV` is no longer set by `serve`: production must set `NODE_ENV=production` in `web/config/.env`. Unset, `web/index.js` serves `frontend/` as in development.
- One combined shell command (file writes plus checks) was denied by the permission classifier; the files were then written one at a time with the Write tool.

**For slice 02/03**
- `web/src/config.js`: `loadEnvFile()`, `loadConfig(source)`; keys are the env names, `PORT` already resolves `BACKEND_PORT`. `loadConfig` throws; the caller exits.
- `web/src/db/connection.js`: `connect(uri, {logger})` (logger needs `warn(string)`; resolves only once connected or after `disconnect()`, so do not await it before listening), `isReady()`, `disconnect()`.
- `web/index.js` does not load the env file or connect yet (slice 03).

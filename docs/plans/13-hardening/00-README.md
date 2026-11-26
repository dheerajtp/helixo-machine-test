# 13 — Rate-limit ceiling, backup and restore

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [07](../07-storefront-api/00-README.md), [09](../09-analytics/00-README.md); takes over slice 10/01

## Goal
- Faking a header cannot get round the storefront limits, and the database can be backed up and the backup proven restorable

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| M1 | **Shop ceiling.** Besides the per-shopper limits, per minute per shop: `GET /proxy/timer` 3000, `POST /proxy/impressions` 600, counted separately, keyed on the signed shop only. It runs after the signature check and after the per-shopper limiter, so requests already refused do not use it up. Same 429 envelope. In memory, like the others. |
| M2 | **Backup.** `tools/backup.sh`: `mongodump` of the `countdown` database from the running `helixo_mongo` container into one timestamped gzip archive in `backups/` (git-ignored, owner-only file mode), deleting archives older than 7 days only after a successful new one. |
| M3 | **Restore check.** `tools/restore-verify.sh [archive]` (default: newest): restore into a temporary database, compare document counts per collection with the counts recorded at backup time, always drop the temporary database, exit non-zero on any difference. It never writes to `countdown`. |
| M4 | **Credentials** are read inside the container from the mounted `/run/config/.env` (root user). They never appear in the host's process list, script output, arguments, the repo or a new env file. No new env variable. |
| M5 | **Targets.** `docs/operations.md`: RPO 24 h, RTO 1 h, daily cron example, how to restore for real, replica-set notes (single member today), and that copies should be kept off the machine. |

## Status
- [x] 01 — Shop ceiling on the storefront routes
- [x] 02 — Backup and restore scripts, operations doc
- [x] 03 — Acceptance (one MANUAL row open)

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | 02 | Sonnet | `web/src/http/rateLimit.js`, `web/src/routes/proxy.js`, `web/test/proxy-ceiling*`, `docs/api.md` |
| 02 | none | 01 | Sonnet | `tools/backup.sh`, `tools/restore-verify.sh`, `tools/mongo/**`, `docs/operations.md` |
| 03 | 01, 02 | none | Opus | this plan folder, `docs/**`, `README.md` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit; never read or change `web/config/`; never run Docker; no `docker-compose.yml` change; never use `docker compose`; no new dependency.

## Acceptance checklist
- [x] Rotating `X-Forwarded-For` is stopped at the shop ceiling, and another shop is unaffected (test)
- [x] The scripts pass a syntax check, print no secrets, and fail loudly when the container is not running
- [ ] MANUAL: backup then restore-verify passes on the owner's Mac

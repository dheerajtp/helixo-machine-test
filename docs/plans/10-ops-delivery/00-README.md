# 10 — Operations and delivery

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [09](../09-analytics/00-README.md)

## Goal
- The remaining backend rules are met and the submission is ready

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| J1 | **Backups.** `tools/backup.sh` (mongodump, keeps 7 days) and `tools/restore-verify.sh` (restores into a temporary database, compares document counts, drops it). |
| J2 | **Targets.** RPO 24 h, RTO 1 h, written in `docs/operations.md` with a daily cron example and replica-set notes. |
| J3 | **Database** is the MongoDB replica set inside the Docker stack (no Atlas or host install). Backup scripts run against that container and store backups outside it. |
| J4 | **README** covers setup, architecture decisions, assumptions, rate limiting, performance, trade-offs; `docs/api.md` lists every endpoint. |
| J5 | **Final audit** against rules §21 and every PRD requirement. |

## Status
- [ ] 01 — Backup and restore scripts, operations doc
- [ ] 02 — README and API docs
- [ ] 03 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | 02 | Sonnet | `tools/backup.sh`, `tools/restore-verify.sh`, `docs/operations.md` |
| 02 | none | 01 | Sonnet | `README.md`, `docs/api.md` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit.

## Acceptance checklist
- [ ] Backup then restore-verify passes locally
- [ ] At least 5 meaningful unit tests pass; CI green
- [ ] A new person can run the app from the README
- [ ] MANUAL: record the Loom video and submit

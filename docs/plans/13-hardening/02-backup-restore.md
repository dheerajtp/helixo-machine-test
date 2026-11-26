# 13/02 — Backup and restore scripts, operations doc

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 13/01

## Decisions you need
M2–M5 — run `grep -E '^\| M[2-5] ' docs/plans/13-hardening/00-README.md`.

## Read first
- `docker-compose.yml` (do not change it), `docker/mongo/health.js` (how the env file is read), `docs/runbook.md` sections 4 and 5, `CLAUDE.md` Docker rules, `CLAUDE_BACKEND_MONGODB.md` section 16

## Scope (files you own)
`tools/backup.sh`, `tools/restore-verify.sh`, `tools/mongo/**`, `docs/operations.md`

## Tasks
1. Scripts per M2–M4, `bash`, `set -euo pipefail`, runnable from any directory, working on macOS (BSD tools). Find the container by the Swarm service `helixo_mongo`; clear error if it is not running. Pass nothing secret on a command line visible on the host; inside the container prefer a method that keeps the password out of `ps` (for example `--config` file with mode 600 in `/tmp`, removed on exit).
2. A failed or partial dump leaves no archive behind and deletes nothing old.
3. `docs/operations.md` (M5).
4. Test without Docker: put a fake `docker` on `PATH` in a temporary directory and check the failure paths, retention and that no secret is printed. Record the commands in Result.

## Done when
- `bash -n` passes on both scripts and the fake-docker checks pass. Append `## Result`, stating that no real database was used.

## Result

**No real database was used, and Docker was never run.** Everything below used a fake `docker`, `mongodump`, `mongorestore` and `mongosh`.

Files: `tools/backup.sh`, `tools/restore-verify.sh`, `tools/mongo/{container.sh,with-config.sh,temp-db.js,test.sh}`, `docs/operations.md`.

Commands:
- `for f in tools/*.sh tools/mongo/*.sh; do bash -n "$f"; done` — PASS
- `node --check tools/mongo/temp-db.js` — PASS
- `bash tools/mongo/test.sh` (macOS bash 3.2; it copies the scripts to a temp dir and puts the fakes first on a PATH without `/usr/local/bin`) — PASS: container not running, no archive, failed / truncated / empty dump leaves nothing and deletes nothing, 7-day retention, file modes, config file mode 600 and removed, count match and mismatch, restore failure, temporary database dropped, no credential in output or arguments
- `git check-ignore backups/x.archive.gz backup.log` — PASS (both already ignored)
- shellcheck — NOT RUN (not installed)

Not verified until the MANUAL acceptance item runs against the real container:
- The "done dumping countdown.<name> (N documents)" log line of `mongodump`, which the counts are parsed from (if it differs, the backup fails with "no collections").
- `mongodump`/`mongorestore` accepting `uri` in `--config`, `--nsFrom`/`--nsTo` behaviour, a whole-stream gzip archive passing `gzip -t`, and `mongosh --eval` of `temp-db.js`.
- The real-restore command and the cron lines in `docs/operations.md`.

For 03: `README.md` and the runbook do not yet link to `docs/operations.md`.

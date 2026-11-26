# Operations: backup and restore

## Targets

| Target | Value | Meaning |
| --- | --- | --- |
| RPO | 24 h | At most one day of data is lost, with the daily backup below. |
| RTO | 1 h | The database is back within an hour of deciding to restore. |

These are targets. A backup counts as recovery only after the restore check has passed on it, and the RTO is unproven until a real restore has been timed.

## Back up

With the stack running (`docker stack deploy -c docker-compose.yml helixo`), from the repository root:

```sh
tools/backup.sh
```

- Writes `backups/countdown-<UTC time>.archive.gz` (a gzip `mongodump` of the `countdown` database) and `countdown-<UTC time>.counts` (documents per collection in that archive). Keep the two together.
- `backups/` is git-ignored, and only your user can read it.
- Archives older than 7 days are deleted, only after a new backup succeeds. A failed, cut-off or empty dump leaves nothing behind and deletes nothing.
- The root credentials are read inside the container from the mounted env file. The scripts take no password and need no new env variable.

## Check that a backup restores

```sh
tools/restore-verify.sh                    # newest archive
tools/restore-verify.sh backups/<archive>  # a chosen one
```

It restores into a temporary database `countdown_verify_...`, compares the document count of every collection with the `.counts` file, drops the temporary database and exits non-zero on any difference. It never writes to `countdown`. It compares counts only, not document contents or indexes.

## Daily schedule (cron)

`crontab -e`, with your repository path. This runs at 02:00 and checks each new archive:

```cron
PATH=/usr/local/bin:/usr/bin:/bin
0 2 * * * /path/to/repo/tools/backup.sh >> /path/to/repo/backup.log 2>&1 && /path/to/repo/tools/restore-verify.sh >> /path/to/repo/backup.log 2>&1
```

- `PATH` must contain the `docker` command (`command -v docker`).
- Docker and the stack must be running, and the machine awake: cron does not run a missed job later. A missed night breaks the 24 h RPO.
- Nothing sends an alert on failure. Read `backup.log` (git-ignored) or check the date of the newest archive.
- On macOS, cron may need Full Disk Access if the repository is in a protected folder such as Documents or Desktop.

## Keep copies off the machine

`backups/` is on the same disk as the database volume, so it does not survive losing the machine. Copy each archive and its `.counts` file to another machine or storage service. The archives are not encrypted and contain shop data, including stored Shopify sessions with their access tokens: encrypt the copies, limit who can read them, and expire them.

The env files and the MongoDB keyfile in `web/config/` are not in the backup. Store them separately in a password manager.

## Restore for real

This overwrites live data. Everything written after the backup is lost.

1. Stop the app (Ctrl+C on `npm run dev`) so nothing writes during the restore.
2. Make sure the stack is running. On a new machine, first recreate `web/config/` (runbook section 4), start the stack (section 5) and wait until the container is `healthy`; that creates the database users.
3. First copy the archive you will restore, and its `.counts` file, out of `backups/`. Then, if the database still answers, run `tools/backup.sh` so you can go back to the current state. That run deletes archives older than 7 days, which is why the copy comes first.
4. Check the archive you will restore: `tools/restore-verify.sh <path to the copied archive>`.
5. From the repository root, restore it:

   ```sh
   cid=$(docker ps -q --filter label=com.docker.swarm.service.name=helixo_mongo)
   docker exec -i -u root "$cid" bash -c "$(cat tools/mongo/with-config.sh)" with-config \
     mongorestore --archive --gzip --nsInclude='countdown.*' --drop --stopOnError \
     < <path to the copied archive>
   ```

   `--drop` replaces each collection that is in the archive. A collection that exists now but not in the archive is left as it is.
6. Start the app and check the dashboard and one product page.

A restore also brings back data deleted since the backup, including shops that uninstalled or were redacted. Delete those shops' data again.

## Replica set

MongoDB runs as a replica set `rs0` with **one member** (`localhost:27017`). That gives transactions, not redundancy: if the container is down the app has no database, and if the volume is lost only the backups remain. A production setup needs at least three members on separate hosts, which changes the stack file and the connection string and is not set up here.

The dump is not a point-in-time snapshot: each collection is read at a slightly different moment while the app keeps writing. Stop the app first if you need all collections to match exactly.

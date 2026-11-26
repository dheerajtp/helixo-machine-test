#!/usr/bin/env bash
# Self-check for backup.sh and restore-verify.sh: fake docker and mongo tools, no database, no Docker.
set -euo pipefail

tools=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
node=$(command -v node)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/repo"
cp -R "$tools" "$tmp/repo/tools"
backups="$tmp/repo/backups"

# The container's env file path points at a fake one in the copies.
password="p@ss:w'rd/ %1"
printf 'MONGO_USERNAME=rootuser\r\nMONGO_PASSWORD="%s"\n' "$password" > "$tmp/env"
for file in "$tmp/repo/tools/mongo/with-config.sh" "$tmp/repo/tools/mongo/temp-db.js"; do
  sed "s|/run/config/.env|$tmp/env|" "$file" > "$file.new" && mv "$file.new" "$file"
done

cat > "$tmp/bin/docker" <<'FAKE'
#!/usr/bin/env bash
echo "docker $*" >> "$FAKE/argv"
case $1 in
  ps) [ -z "${DOWN:-}" ] && echo abc123; exit 0 ;;
  exec)
    shift
    while [ "$1" != abc123 ]; do shift; done
    shift
    exec "$@" ;;
esac
exit 9
FAKE
cat > "$tmp/bin/mongodump" <<'FAKE'
#!/usr/bin/env bash
echo "mongodump $*" >> "$FAKE/argv"
config=${!#}
config=${config#--config=}
ls -l "$config" | cut -c1-10 > "$FAKE/mode"
cp "$config" "$FAKE/config"
echo "$config" > "$FAKE/config-path"
if [ -n "${FAIL_DUMP:-}" ]; then printf partial; echo "Failed: boom" >&2; exit 1; fi
if [ -n "${TRUNCATED:-}" ]; then printf data | gzip | head -c 10; else printf data | gzip; fi
[ -n "${EMPTY:-}" ] && exit 0
printf '2026-01-01T00:00:00\tdone dumping countdown.timers (3 documents)\n' >&2
printf '2026-01-01T00:00:00\tdone dumping countdown.sessions (1 document)\n' >&2
FAKE
cat > "$tmp/bin/mongorestore" <<'FAKE'
#!/usr/bin/env bash
echo "mongorestore $*" >> "$FAKE/argv"
cat > /dev/null
[ -z "${FAIL_RESTORE:-}" ] || { echo "Failed: boom" >&2; exit 1; }
FAKE
# Runs the real temp-db.js against a stub db.
cat > "$tmp/bin/mongosh" <<FAKE
#!$node
const fs = require("fs");
const script = process.argv[process.argv.indexOf("--eval") + 1];
const counts = { timers: Number(process.env.TIMERS || 3), sessions: 1 };
const db = {
  getSiblingDB: (name) => ({
    auth: (user, pwd) => {
      if (user !== "rootuser" || pwd !== $("$node" -p 'JSON.stringify(process.argv[1])' "$password")) throw new Error("auth failed");
    },
    dropDatabase: () => fs.appendFileSync(process.env.FAKE + "/dropped", name + "\n"),
    getCollectionNames: () => Object.keys(counts),
    getCollection: (collection) => ({ countDocuments: () => counts[collection] }),
  }),
};
new Function("db", "require", "print", script)(db, require, console.log);
FAKE
chmod +x "$tmp"/bin/*
ln -s "$node" "$tmp/bin/node"

# /usr/local/bin is left out so a real docker can never be reached.
export FAKE="$tmp" PATH="$tmp/bin:/usr/bin:/bin"
[ "$(command -v docker)" = "$tmp/bin/docker" ] || { echo "fake docker not first on PATH" >&2; exit 1; }
cd "$tmp"

fail() { echo "FAIL: $1" >&2; cat "$tmp/out" >&2; exit 1; }
run() { # expected exit status (0 or 1), label, command...
  local expected=$1 label=$2 status=0
  shift 2
  "$@" >> "$tmp/out" 2>&1 || status=1
  [ "$status" = "$expected" ] || fail "$label"
  echo "ok: $label"
}
backup="$tmp/repo/tools/backup.sh"
verify="$tmp/repo/tools/restore-verify.sh"
files() { ls -A "$backups" 2> /dev/null | tr '\n' ' '; }

run 1 "backup fails when the container is not running" env DOWN=1 "$backup"
grep -q "no running container" "$tmp/out" || fail "clear error"
run 1 "verify fails with no archive" "$verify"

mkdir -p "$backups"
touch -t 202001010000 "$backups/countdown-20200101T000000Z.archive.gz" "$backups/countdown-20200101T000000Z.counts"
before=$(files)
for mode in FAIL_DUMP TRUNCATED EMPTY; do
  run 1 "backup fails on $mode" env "$mode=1" "$backup"
  [ "$(files)" = "$before" ] || fail "$mode left or deleted files: $(files)"
done

run 0 "backup succeeds" "$backup"
[ ! -e "$backups/countdown-20200101T000000Z.archive.gz" ] && [ ! -e "$backups/countdown-20200101T000000Z.counts" ] || fail "old backup kept"
[ "$(ls -A "$backups" | wc -l | tr -d ' ')" = 2 ] || fail "unexpected files: $(files)"
for file in "$backups"/*; do
  [ "$(ls -l "$file" | cut -c1-10)" = "-rw-------" ] || fail "mode of $file"
done
[ "$(ls -ld "$backups" | cut -c1-10)" = "drwx------" ] || fail "mode of backups/"
[ "$(cat "$tmp/mode")" = "-rw-------" ] || fail "config mode"
[ ! -e "$(cat "$tmp/config-path")" ] || fail "config file not removed"
"$node" -e '
  const uri = require("fs").readFileSync(process.argv[1], "utf8").replace("uri: ", "").trim();
  const url = new URL(uri);
  if (decodeURIComponent(url.username) !== "rootuser" || decodeURIComponent(url.password) !== process.argv[2]) process.exit(1);
' "$tmp/config" "$password" || fail "config URI does not decode to the credentials"
echo "ok: retention, file modes, config file"

: > "$tmp/dropped"
run 0 "verify passes on matching counts" "$verify"
run 1 "verify fails on a count difference" env TIMERS=2 "$verify"
run 1 "verify fails when mongorestore fails" env FAIL_RESTORE=1 "$verify"
[ "$(grep -c '^countdown_verify_' "$tmp/dropped")" = 3 ] || fail "temporary database not dropped every time"
grep -q -- '--nsFrom=countdown\.\* --nsTo=countdown_verify_' "$tmp/argv" || fail "restore not redirected"
run 1 "verify fails when the container is not running" env DOWN=1 "$verify"

if grep -qF -e "$password" -e rootuser -e '%72%6f%6f%74' "$tmp/out" "$tmp/argv"; then
  fail "a credential reached output or arguments"
fi
echo "ok: no credential in output or arguments"
echo "all checks passed"

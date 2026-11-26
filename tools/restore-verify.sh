#!/usr/bin/env bash
# Usage: restore-verify.sh [archive]   (default: the newest in backups/)
# Restores into a temporary database, compares document counts, drops it. Never writes to countdown.
set -euo pipefail
umask 077

tools=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$tools/mongo/container.sh"

[ $# -le 1 ] || die "usage: restore-verify.sh [archive]"
archive=${1:-}
if [ -z "$archive" ]; then
  # Glob order is name order, and the names are timestamps.
  for file in "$tools"/../backups/countdown-*.archive.gz; do
    [ -f "$file" ] && archive=$file
  done
  [ -n "$archive" ] || die "no archive found in backups/"
fi
[ -f "$archive" ] || die "no such archive: $archive"
counts=${archive%.archive.gz}.counts
[ -s "$counts" ] || die "missing counts file: $counts"
gzip -t "$archive" || die "the archive is damaged: $archive"

find_mongo
target="countdown_verify_$(date +%s)_$$"

temp_db() {
  docker exec -u root "$cid" mongosh --quiet --norc \
    --eval "const action = '$1', target = '$target'; $(cat "$tools/mongo/temp-db.js")"
}

work=$(mktemp -d)
cleanup() {
  status=$?
  rm -rf "$work"
  if ! temp_db drop > /dev/null; then
    echo "error: could not drop the temporary database $target; drop it by hand" >&2
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT

echo "checking $archive in temporary database $target"
if ! mongo_tool -i -- mongorestore --archive --gzip --stopOnError \
  --nsInclude='countdown.*' --nsFrom='countdown.*' --nsTo="$target.*" < "$archive" > "$work/log" 2>&1; then
  cat "$work/log" >&2
  die "mongorestore failed"
fi

temp_db count > "$work/output" || die "could not count the restored documents"
sed -n 's/^COUNT //p' "$work/output" | sort > "$work/restored"
sort "$counts" > "$work/expected"

if ! diff "$work/expected" "$work/restored" > "$work/diff"; then
  echo "counts differ (< recorded at backup, > restored):" >&2
  cat "$work/diff" >&2
  die "restore check failed"
fi

cat "$work/restored"
echo "restore check passed"

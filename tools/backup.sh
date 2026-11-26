#!/usr/bin/env bash
# Dumps the countdown database to backups/ and keeps 7 days of archives. See docs/operations.md.
set -euo pipefail
umask 077

tools=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$tools/mongo/container.sh"
backups="$tools/../backups"

find_mongo
mkdir -p "$backups"
chmod 700 "$backups"

name="countdown-$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backups/$name.archive.gz"
[ ! -e "$archive" ] || die "$archive already exists"

work=$(mktemp -d "$backups/.partial.XXXXXX")
trap 'rm -rf "$work"' EXIT

if ! mongo_tool -- mongodump --db=countdown --archive --gzip > "$work/archive" 2> "$work/log"; then
  cat "$work/log" >&2
  die "mongodump failed; no backup written"
fi
gzip -t "$work/archive" || die "the archive is incomplete; no backup written"

# Counts come from mongodump's own log, so they match the archive even while the app is writing.
sed -nE 's/.*done dumping countdown\.(.+) \(([0-9]+) documents?\).*/\1 \2/p' "$work/log" > "$work/counts"
# An empty dump must not count as a success: it would let the old, good archives expire.
[ -s "$work/counts" ] || { cat "$work/log" >&2; die "mongodump reported no collections; no backup written"; }

# Counts first: an archive without its counts must never exist.
mv "$work/counts" "$backups/$name.counts"
mv "$work/archive" "$archive"

find "$backups" -maxdepth 1 -type f \( -name 'countdown-*.archive.gz' -o -name 'countdown-*.counts' \) -mtime +7 -delete

echo "backup written: $(cd "$backups" && pwd)/$name.archive.gz"

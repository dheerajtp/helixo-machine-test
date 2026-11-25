#!/usr/bin/env bash
# Usage: tools/verify-slice.sh [spec files]   (paths relative to the repo root)
set -u
cd "$(dirname "$0")/.." || exit 1

status=0

if npm run lint; then
  echo "LINT: PASS"
else
  echo "LINT: FAIL"
  status=1
fi

if [ "$#" -gt 0 ]; then
  node --test "$@"
else
  npm test
fi
if [ $? -eq 0 ]; then
  echo "TESTS: PASS"
else
  echo "TESTS: FAIL"
  status=1
fi

exit "$status"

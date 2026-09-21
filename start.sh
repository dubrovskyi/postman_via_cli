#!/usr/bin/env bash
#
# Convenience wrapper around start.js: installs dependencies if needed,
# clears the previous reports and runs the collection.
#
#   ./start.sh <collection> [environment] [extra newman options]
#   ./start.sh -c collections/api.json -e environments/stage.json --bail
#
set -euo pipefail

cd "$(dirname "$0")"

REPORT_DIR=reports

if [ $# -lt 1 ]; then
  echo "Seems like you supplied not enough arguments" >&2
  node start.js --help
  exit 2
fi

if [ ! -d node_modules ]; then
  echo "installing dependencies"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi

echo "cleaning previous reports"
rm -rf "$REPORT_DIR"

echo "run tests"
node start.js "$@"

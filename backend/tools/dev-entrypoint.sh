#!/bin/sh
set -eu

# Named development volumes survive image rebuilds. Refresh them after lock changes.
if ! sha256sum -c node_modules/.clouds-package-lock.sha256 >/dev/null 2>&1; then
  npm ci
  sha256sum package-lock.json > node_modules/.clouds-package-lock.sha256
fi
exec "$@"

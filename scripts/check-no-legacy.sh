#!/usr/bin/env bash
# Only inspect workflows, so this script cannot match its own patterns.
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -rEn 'gauntlet/|\.omp/|\.opencode/|\.grok/' .github/workflows/; then
  echo 'FAIL: legacy tooling reference in GitHub workflows' >&2
  exit 1
else
  status=$?
  # grep returns 1 for no matches; other failures must not pass the guard.
  [ "$status" -eq 1 ]
fi

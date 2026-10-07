#!/bin/sh
# Repository-specific identity guard. Git runs this even with --no-verify.
set -eu

expected_name='Rolando Oxalc'
expected_email='qj.oxalc@gmail.com'
expected_identity="$expected_name <$expected_email>"

for role in AUTHOR COMMITTER; do
  identity=$(git var "GIT_${role}_IDENT")
  # Git appends the timestamp and timezone after the closing email bracket.
  actual_identity=$(printf '%s\n' "$identity" | sed 's/> .*$/>/')
  if [ "$actual_identity" != "$expected_identity" ]; then
    printf '%s\n' "Commit blocked: $role identity '$actual_identity' is not the oxalc88 personal identity." >&2
    printf '%s\n' "Expected: $expected_identity" >&2
    printf '%s\n' "Set repository-local user.name to '$expected_name' and user.email to '$expected_email'; remove conflicting GIT_AUTHOR_* / GIT_COMMITTER_* overrides." >&2
    exit 1
  fi
done

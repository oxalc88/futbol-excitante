#!/bin/sh
# Install a branch-independent local hook without changing global/work settings.
set -eu
root=$(git rev-parse --show-toplevel)
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
hooks_dir="$common_dir/oxalc88-hooks"
current_hooks=$(git config --get core.hooksPath || :)
if [ -n "$current_hooks" ] && [ "$current_hooks" != "$hooks_dir" ]; then
  printf '%s\n' "Existing core.hooksPath '$current_hooks' must be preserved; refusing to replace it." >&2
  exit 1
fi
# Git's normal active hooks must not be silently disabled by this installation.
for hook in "$common_dir"/hooks/*; do
  [ -f "$hook" ] && [ -x "$hook" ] || continue
  case "$hook" in *.sample) continue ;; esac
  printf '%s\n' "Existing active hook '$hook' must be preserved; refusing to replace it." >&2
  exit 1
done
mkdir -p "$hooks_dir"
cp "$root/scripts/git/oxalc88-prepare-commit-msg.sh" "$hooks_dir/prepare-commit-msg"
chmod 755 "$hooks_dir/prepare-commit-msg"
git config --local user.name 'Rolando Oxalc'
git config --local user.email 'qj.oxalc@gmail.com'
git config --local user.useConfigOnly true
git config --local core.hooksPath "$hooks_dir"
printf '%s\n' "Installed oxalc88 identity guard at $hooks_dir/prepare-commit-msg"

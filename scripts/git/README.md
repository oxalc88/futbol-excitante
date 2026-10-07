# Personal commit identity

This repository uses the personal GitHub account `oxalc88`. GitHub attributes the existing author/committer identity `Rolando Oxalc <qj.oxalc@gmail.com>` to that account.

Install the local identity and hook with:

```sh
sh scripts/git/install-personal-hooks.sh
```

The installer changes only this repository's Git settings. It copies the guard into the common Git directory so it stays installed across branch changes and shared worktrees. Fresh clones need to run the installer. Existing active hooks are preserved by refusing conflicting installations.

The `prepare-commit-msg` hook rejects an incorrect author or committer, including `--author`, environment overrides, and `--no-verify`. It does not modify commit messages or use the network. GitHub authentication is separate from commit attribution; use the personal `gh` profile and the existing `github-personal` SSH push URL for publication.

---
name: gauntlet-version
description: Show the currently installed PES Simulator Gauntlet system version and active Grok role/model.
user-invocable: true
disable-model-invocation: true
---

Read `gauntlet/VERSION.json` and report exactly one compact status line using the file's `version` plus the current active agent/session role and model when available:

`Gauntlet <version> · <agent-or-role> · <model>`

Do not infer a different version from changelog labels. `gauntlet/VERSION.json` is authoritative for the Gauntlet system SemVer.

If the current agent/model cannot be determined from the session, report `unknown` for that field rather than guessing.

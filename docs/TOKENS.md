# Token log

One row per task or PR and per model. Update this file in each PR.

Format comes from `analysis/grok-build-sessions/sessions.csv` on `archive/gauntlet-legacy`, with fewer columns.

- **Total**: all tokens of the sessions (input + output). Most input is cached context.
- **Not cached**: input tokens minus cached input tokens.
- **Output**: output + reasoning tokens.
- **Effort**: `default` means no effort was set; Codex used its default.

To measure Codex sessions: `python3 scripts/token-usage.py <YYYY-MM-DD> <worktree>...`.
For pi, read the session files in `~/.pi/agent/sessions/`.

| Date (Lima) | Task / PR | Tool | Role | Model | Effort | Sessions | Total | Not cached | Output | Source |
|---|---|---|---|---|---|---:|---:|---:|---:|---|
| 2026-10-25 | #67 player figures (reference) | Codex CLI | write | gpt-6.1-sol | default | 1 | 439,379 | 20,238 | 5,008 | ~/.codex/sessions (wt-figures) |
| 2026-10-25 | #67 player figures (reference) | Codex CLI | review | gpt-6-luna | default | 2 | 163,394 | 39,165 | 4,359 | ~/.codex/sessions (wt-figures) |
| 2026-10-25 | #69 C5 fake gamepad smoke | Codex CLI | write | gpt-6.1-sol | default | 2 | 6,017,112 | 107,903 | 29,510 | ~/.codex/sessions (wt-c5) |
| 2026-10-25 | #69 C5 fake gamepad smoke | Codex CLI | helper | gpt-6-astra | medium | 1 | 471,741 | 31,916 | 1,699 | ~/.codex/sessions (wt-c5) |
| 2026-10-25 | #69 C5 fake gamepad smoke | Codex CLI | review | gpt-6-luna | default | 2 | 257,508 | 36,122 | 2,356 | ~/.codex/sessions (wt-c5) |
| 2026-10-25 | C10 keeper control | Codex CLI | write | gpt-6.1-sol | default | 2 | 4,454,301 | 108,115 | 23,770 | ~/.codex/sessions (wt-c10) |
| 2026-10-25 | C10 keeper control | Codex CLI | helper | gpt-6-sol | medium | 1 | 1,221,661 | 61,276 | 7,694 | ~/.codex/sessions (wt-c10) |
| 2026-10-25 | C10 keeper control | Codex CLI | review | gpt-6-luna | default | 2 | 442,021 | 85,006 | 6,748 | ~/.codex/sessions (wt-c10) |
| 2026-10-25 | #70 Static build ready | Codex CLI | write | gpt-6.1-sol | default | 2 | 651,800 | 33,737 | 6,066 | ~/.codex/sessions (wt-static) |
| 2026-10-25 | #70 Static build ready | Codex CLI | review | gpt-6-luna | default | 2 | 130,943 | 29,414 | 3,708 | ~/.codex/sessions (wt-static) |
| 2026-10-25 | #71 Match sound | Codex CLI | write | gpt-6.1-sol | default | 1 | 656,045 | 64,539 | 6,935 | ~/.codex/sessions (wt-audio) |
| 2026-10-25 | #71 Match sound | Codex CLI | review | gpt-6-luna | default | 1 | 159,974 | 32,031 | 3,878 | ~/.codex/sessions (wt-audio) |
| 2026-10-25 | Quick play menu and tips | pi | write | nan/mimo-v2.6-flash | default | 4 | 7,130,679 | 273,925 | 129,586 | ~/.pi/agent/sessions (wt-menu) |
| 2026-10-25 | Quick play menu and tips | Codex CLI | review | gpt-6.1-sol | default | 1 | 345,410 | 38,148 | 2,093 | ~/.codex/sessions (wt-menu) |
| 2026-10-25 | CPU difficulty selector | pi | write | nan/mimo-v2.6-flash | default | 2 | 5,364,702 | 177,966 | 67,248 | ~/.pi/agent/sessions (wt-difficulty) |
| 2026-10-25 | CPU difficulty selector | Codex CLI | review | gpt-6.1-sol | default | 2 | 286,475 | 43,618 | 1,162 | ~/.codex/sessions (wt-difficulty) |

Values at 2026-10-25 01:20 Lima; quick play values at 02:40 Lima; CPU difficulty values at 03:16 Lima (pi total includes cached input; one pi session was stopped before it wrote code). C10 (#68), C5 (#69), static build (#70) and sound (#71) values are final.

# Token log

One row per task or PR and per model. Update this file in each PR.

Format comes from `analysis/grok-build-sessions/sessions.csv` on `archive/gauntlet-legacy`, with fewer columns.

- **Total**: all tokens of the sessions (input + output). Most input is cached context.
- **Not cached**: input tokens minus cached input tokens.
- **Output**: output + reasoning tokens.
- **Effort**: `default` means no effort was set; Codex used its default.
- **Role**: plan, write, test (UI and screenshots), verify, review, helper.
For Claude Code sessions, read `modelUsage` in the `claude -p --output-format json` output.

To measure Codex sessions: `python3 scripts/token-usage.py <YYYY-MM-DD> <worktree>...`.
For pi, read the session files in `~/.pi/agent/sessions/`.

| Date (Lima) | Task / PR | Tool | Role | Model | Effort | Sessions | Total | Not cached | Output | Source |
|---|---|---|---|---|---|---:|---:|---:|---:|---|
| 2026-10-25 | #67 player figures (reference) | Codex CLI | write | gpt-6.1-sol | default | 1 | 439,379 | 20,238 | 5,008 | ~/.codex/sessions (wt-figures) |
| 2026-10-25 | #67 player figures (reference) | Codex CLI | review | gpt-6-luna | default | 2 | 163,394 | 39,165 | 4,359 | ~/.codex/sessions (wt-figures) |
| 2026-10-25 | #69 C5 fake gamepad smoke | Codex CLI | write | gpt-6.1-sol | default | 2 | 6,017,112 | 107,903 | 29,510 | ~/.codex/sessions (wt-c5) |
| 2026-10-25 | #69 C5 fake gamepad smoke | Codex CLI | helper | gpt-6-astra | medium | 1 | 471,741 | 31,916 | 1,699 | ~/.codex/sessions (wt-c5) |
| 2026-10-25 | #69 C5 fake gamepad smoke | Codex CLI | review | gpt-6-luna | default | 2 | 257,508 | 36,122 | 2,356 | ~/.codex/sessions (wt-c5) |
| 2026-10-25 | #68 C10 keeper control | Codex CLI | write | gpt-6.1-sol | default | 2 | 4,454,301 | 108,115 | 23,770 | ~/.codex/sessions (wt-c10) |
| 2026-10-25 | #68 C10 keeper control | Codex CLI | helper | gpt-6-sol | medium | 1 | 1,221,661 | 61,276 | 7,694 | ~/.codex/sessions (wt-c10) |
| 2026-10-25 | #68 C10 keeper control | Codex CLI | review | gpt-6-luna | default | 2 | 442,021 | 85,006 | 6,748 | ~/.codex/sessions (wt-c10) |
| 2026-10-25 | #70 Static build ready | Codex CLI | write | gpt-6.1-sol | default | 2 | 651,800 | 33,737 | 6,066 | ~/.codex/sessions (wt-static) |
| 2026-10-25 | #70 Static build ready | Codex CLI | review | gpt-6-luna | default | 2 | 130,943 | 29,414 | 3,708 | ~/.codex/sessions (wt-static) |
| 2026-10-25 | #71 Match sound | Codex CLI | write | gpt-6.1-sol | default | 1 | 656,045 | 64,539 | 6,935 | ~/.codex/sessions (wt-audio) |
| 2026-10-25 | #71 Match sound | Codex CLI | review | gpt-6-luna | default | 1 | 159,974 | 32,031 | 3,878 | ~/.codex/sessions (wt-audio) |
| 2026-10-25 | #72 Quick play menu and tips | pi | write | nan/mimo-v2.6-flash | default | 4 | 7,130,679 | 273,925 | 129,586 | ~/.pi/agent/sessions (wt-menu) |
| 2026-10-25 | #72 Quick play menu and tips | Codex CLI | review | gpt-6.1-sol | default | 1 | 345,410 | 38,148 | 2,093 | ~/.codex/sessions (wt-menu) |
| 2026-10-25 | #74 CPU difficulty selector | pi | write | nan/mimo-v2.6-flash | default | 2 | 5,364,702 | 177,966 | 67,248 | ~/.pi/agent/sessions (wt-difficulty) |
| 2026-10-25 | #74 CPU difficulty selector | Codex CLI | review | gpt-6.1-sol | default | 2 | 286,475 | 43,618 | 1,162 | ~/.codex/sessions (wt-difficulty) |
| 2026-10-25 | pi comparison (throwaway, no PR) | pi | write | nan/deepseek-v4-flash | default | 1 | 782,894 | 58,990 | 27,968 | ~/.pi/agent/sessions (wt-cmp-deepseek-v4-flash) |
| 2026-10-25 | pi comparison (throwaway, no PR) | Codex CLI | review | gpt-6.1-sol | default | 1 | 241,071 | 40,159 | 1,765 | ~/.codex/sessions (wt-cmp-deepseek-v4-flash) |
| 2026-10-25 | pi comparison (throwaway, no PR) | pi | write | nan/glm5.3-flash | default | 1 | 513,456 | 34,868 | 12,668 | ~/.pi/agent/sessions (wt-cmp-glm5.3-flash) |
| 2026-10-25 | pi comparison (throwaway, no PR) | Codex CLI | review | gpt-6.1-sol | default | 1 | 178,774 | 35,374 | 1,641 | ~/.codex/sessions (wt-cmp-glm5.3-flash) |
| 2026-10-25 | pi comparison (throwaway, no PR) | pi | write | nan/mimo-v2.6-flash | default | 1 | 602,421 | 45,955 | 24,498 | ~/.pi/agent/sessions (wt-cmp-mimo-v2.6-flash) |
| 2026-10-25 | pi comparison (throwaway, no PR) | Codex CLI | review | gpt-6.1-sol | default | 1 | 187,616 | 42,808 | 1,336 | ~/.codex/sessions (wt-cmp-mimo-v2.6-flash) |
| 2026-10-25 | #73 PS4 pad preset | pi | write | nan/mimo-v2.6-flash | default | 8 | 23,306,567 | 794,917 | 358,306 | ~/.pi/agent/sessions (wt-ps-preset) |
| 2026-10-25 | #73 PS4 pad preset | Codex CLI | review | gpt-6.1-sol | default | 4 | 1,182,064 | 179,471 | 6,168 | ~/.codex/sessions (wt-ps-preset) |
| 2026-10-25 | #75 C7 part 3 acceleration and turn | pi | write | nan/mimo-v2.6-flash | default | 3 | 6,475,746 | 271,245 | 151,381 | ~/.pi/agent/sessions (wt-c7p3) |
| 2026-10-25 | #75 C7 part 3 acceleration and turn | Codex CLI | review | gpt-6.1-sol | default | 2 | 444,439 | 67,253 | 3,071 | ~/.codex/sessions (wt-c7p3) |
| 2026-10-25 | #75 C7 part 3 pad-smoke fix | pi | write | nan/mimo-v2.6-flash | default | 2 | 45,888 | 8,132 | 1,532 | ~/.pi/agent/sessions (wt-c7p3) |
| 2026-10-25 | #75 C7 part 3 pad-smoke fix | Codex CLI | review | gpt-6.1-sol | default | 1 | 127,871 | 19,920 | 559 | ~/.codex/sessions (wt-c7p3) |
| 2026-10-25 | #75 C7 part 3 pad-smoke deterministic setup | pi | write | nan/mimo-v2.6-flash | default | 3 | 5,143,463 | 247,627 | 82,652 | ~/.pi/agent/sessions (wt-c7p3) |
| 2026-10-25 | #75 C7 part 3 pad-smoke deterministic setup | Codex CLI | review | gpt-6.1-sol | default | 1 | 136,478 | 22,856 | 726 | ~/.codex/sessions (wt-c7p3) |
| 2026-10-25 | #76 Model roles and docs-only CI | pi | write | nan/mimo-v2.6-flash | default | 1 | 86,600 | 12,675 | 6,469 | ~/.pi/agent/sessions (wt-model-roles) |
| 2026-10-25 | #76 Model roles and docs-only CI | Codex CLI | review | gpt-6.1-sol | medium | 1 | 81,348 | 16,881 | 1,160 | ~/.codex/sessions (wt-model-roles) |
| 2026-10-25 | #78 pad-smoke flaky fix | pi | write | nan/mimo-v2.6-flash | default | 1 | 16,471 | 5,208 | 1,151 | ~/.pi/agent/sessions (wt-padflaky) |
| 2026-10-25 | #78 pad-smoke flaky fix | Codex CLI | review | gpt-6.1-sol | medium | 1 | 95,612 | 25,657 | 512 | ~/.codex/sessions (wt-padflaky) |
| 2026-10-25 | #79 Keeper controls | pi | write | nan/mimo-v2.6-flash | default | 6 | 31,239,710 | 1,052,593 | 460,525 | ~/.pi/agent/sessions (wt-keeper) |
| 2026-10-25 | #79 Keeper controls | Codex CLI | review | gpt-6.1-sol | medium | 6 | 2,638,956 | 311,288 | 14,708 | ~/.codex/sessions (wt-keeper) |
| 2026-10-25 | Keeper e2e (#79) | pi | write | nan/mimo-v2.6-flash | default | 3 | 1,635,976 | 285,838 | 83,194 | ~/.pi/agent/sessions (wt-keeper) |
| 2026-10-25 | Keeper e2e (#79) | pi | write | nan/glm5.3-flash | default | 1 | 66,328 | 20,863 | 14,233 | ~/.pi/agent/sessions (wt-keeper) |
| 2026-10-25 | Keeper e2e (#79) | Codex CLI | review | gpt-6.1-sol | medium | 1 | 151,099 | 30,637 | 1,038 | ~/.codex/sessions (wt-keeper) |
| 2026-10-25 | #80 Set pieces | pi | write | nan/mimo-v2.6-flash | default | 3 | 7,680,903 | 395,143 | 189,440 | ~/.pi/agent/sessions (wt-setpieces) |
| 2026-10-25 | #80 Set pieces | pi | write | nan/glm5.3-flash | default | 3 | 1,422,514 | 199,397 | 44,877 | ~/.pi/agent/sessions (wt-setpieces) |
| 2026-10-25 | #80 Set pieces | Codex CLI | write | gpt-6.1-sol | medium | 2 | ~299,001 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-25 | #80 Set pieces | Codex CLI | review | gpt-6.1-sol | medium | 3 | ~126,445 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-25 | Set-piece e2e (#80) | pi | write | nan/mimo-v2.6-flash | default | 2 | 514,367 | 59,808 | 22,175 | ~/.pi/agent/sessions (wt-setpieces) |
| 2026-10-25 | Set-piece e2e (#80) | Codex CLI | review | gpt-6.1-sol | medium | 1 | ~24,681 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-26 | Touch L2 (#82) | pi | write | nan/mimo-v2.6-flash | default | 2 | 2,375,085 | 140,310 | 44,567 | ~/.pi/agent/sessions (wt-touch-l2) |
| 2026-10-26 | Touch L2 (#82) | pi | write | nan/glm5.3-flash | default | 1 | 10,552 | 6,333 | 443 | ~/.pi/agent/sessions (wt-touch-l2) |
| 2026-10-26 | Touch L2 (#82) | Codex CLI | review | gpt-6.1-sol | medium | 2 | ~58,139 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-28 | #84 Defense | pi | write | nan/mimo-v2.6-flash | default | 2 | 3,211,144 | 2,983,552 | 69,791 | ~/.pi/agent/sessions (wt-defense) |
| 2026-10-28 | #84 Defense | pi | write | nan/glm5.3-flash | default | 1 | 1,381,893 | 1,239,104 | 24,821 | ~/.pi/agent/sessions (wt-defense) |
| 2026-10-28 | #84 Defense | pi | write | nan/deepseek-v4-flash | default | 3 | 7,082,470 | 6,811,648 | 81,049 | ~/.pi/agent/sessions (wt-defense) |
| 2026-10-28 | #84 Defense | Codex CLI | test | gpt-6.1-terra | default | 2 | ~37,597 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-28 | #84 Defense | Codex CLI | review | gpt-6.1-sol | medium | 3 | ~161,994 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-29 | #84 Defense update (main merge) | pi | write | nan/deepseek-v4-flash | default | 3 | 491,084 | 409,344 | 14,775 | ~/.pi/agent/sessions (wt-defense) |
| 2026-10-29 | #84 Defense update (main merge) | Codex CLI | test | gpt-6.1-terra | default | 1 | ~9,934 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-29 | #84 Defense update (main merge) | Codex CLI | review | gpt-6.1-sol | medium | 3 | ~217,229 | — | — | codex exec "tokens used" (approximate) |
| 2026-10-25 | #81 PS touch pad | pi | write | nan/mimo-v2.6-flash | default | 8 | 9,645,377 | 537,814 | 222,315 | ~/.pi/agent/sessions (wt-touchpad) |
| 2026-10-25 | #81 PS touch pad | pi | write | nan/glm5.3-flash | default | 5 | 4,795,561 | 270,446 | 101,435 | ~/.pi/agent/sessions (wt-touchpad) |
| 2026-10-25 | #81 PS touch pad | Codex CLI | write | gpt-6.1-sol | medium | 3 | ~37,781,770 | ~315,052 | ~66,993 | ~/.codex/sessions mentioning wt-touchpad (approximate) |
| 2026-10-25 | #81 PS touch pad | Codex CLI | review | gpt-6.1-sol | medium | 3 | ~1,324,235 | ~207,415 | ~8,288 | ~/.codex/sessions mentioning wt-touchpad (approximate) |
| 2026-10-25 | Touch HUD overlap (#81) | pi | write | nan/mimo-v2.6-flash | default | 2 | 56,528 | 17,014 | 4,058 | ~/.pi/agent/sessions (wt-touchpad) |
| 2026-10-25 | Touch HUD overlap (#81) | Codex CLI | review | gpt-6.1-sol | medium | 1 | ~87,438 | ~14,904 | ~342 | ~/.codex/sessions (wt-touchpad, approximate) |
| 2026-10-29 | #83 UI declutter | pi | write | nan/deepseek-v4-flash | default | 4 | 4,055,812 | 289,102 | 52,534 | ~/.pi/agent/sessions (wt-declutter) |
| 2026-10-29 | #83 UI declutter | Codex CLI | review | gpt-6.1-sol | medium | 2 | ~360,091 | ~69,582 | ~1,871 | ~/.codex/sessions (wt-declutter, approximate) |
| 2026-10-29 | #83 UI declutter | Codex CLI | test | gpt-6.1-terra | default | 2 | ~120,000 | — | — | screenshot review + verify read-out (approximate) |
| 2026-10-29 | CI no browser e2e (#86) | pi | write | nan/deepseek-v4-flash | default | 3 | ~360,000 | ~40,000 | ~13,000 | ~/.pi/agent/sessions (wt-ci-lite, approximate) |
| 2026-10-29 | CI no browser e2e (#86) | Codex CLI | review | gpt-6.1-sol | medium | 1 | ~26,000 | — | — | codex exec tokens used (wt-ci-lite) |
| 2026-10-29 | #87 Fix defense e2e under load | pi | write | nan/deepseek-v4-flash | default | 15 | 3,590,456 | 505,718 | 115,650 | ~/.pi/agent/sessions (wt-fix-defense) |
| 2026-10-29 | #87 Fix defense e2e under load | pi | write | nan/glm5.3-flash | default | 14 | 1,000,758 | 453,535 | 50,647 | ~/.pi/agent/sessions (wt-fix-defense) |
| 2026-10-29 | #87 Fix defense e2e under load | Codex CLI | review | gpt-6.1-sol | medium | 7 | 240,066 | — | — | codex exec tokens used (wt-fix-defense) |
| 2026-10-29 | Menu scroll cue (#85) | pi | write | nan/deepseek-v4-flash | default | 8 | 5,391,271 | 351,623 | 144,800 | ~/.pi/agent/sessions (wt-scroll-cue) |
| 2026-10-29 | Menu scroll cue (#85) | Codex CLI | review | gpt-6.1-sol | medium | 5 | ~218,241 | — | — | codex "tokens used" (wt-scroll-cue) |
| 2026-10-29 | Menu scroll cue (#85) | Codex CLI | test | gpt-6.1-terra | default | 5 | ~121,716 | — | — | codex "tokens used", screenshot review (wt-scroll-cue) |
| 2026-10-29 | Menu scroll cue CI fix (#85) | pi | write | nan/deepseek-v4-flash | default | 2 | 513,416 | — | — | ~/.pi/agent/sessions (wt-scroll-cue, CI fix) |
| 2026-10-29 | Menu scroll cue CI fix (#85) | Codex CLI | review | gpt-6.1-sol | medium | 1 | ~9,069 | — | — | codex "tokens used" (CI fix) |
| 2026-10-29 | Menu scroll cue CI fix (#85) | Codex CLI | test | gpt-6.1-terra | default | 1 | ~7,747 | — | — | codex "tokens used", screenshot review (CI fix) |
| 2026-10-30 | PR pendiente Audit PR B docs and process | Claude Code | plan | claude-opus-5-5 | high | 1 | 1,852,962 | 38 | 52,535 | claude -p JSON modelUsage (prB/plan.json; cache read 1,681,934; cache create 118,455; cost $2.33) |
| 2026-10-30 | PR pendiente Audit PR B docs and process | Codex CLI | write | gpt-6-luna | none | 1 | 124,679 | n/a | n/a | codex exec total tokens used (wt-audit-b) |
| 2026-10-30 | PR pendiente Audit PR B docs and process round 2 | Codex CLI | write | gpt-6-luna | none | 1 | 45,819 | n/a | n/a | codex exec total tokens used (wt-audit-b) |
| 2026-10-30 | PR pendiente Audit PR B docs and process | Codex CLI | verify | gpt-6.1-sol | medium | 1 | 115,558 | n/a | n/a | codex exec total tokens used (wt-audit-b) |
| 2026-10-30 | PR pendiente Audit PR B docs and process loop 2 | Codex CLI | verify | gpt-6.1-sol | medium | 1 | 89,670 | n/a | n/a | codex exec total tokens used (prB/sol2.log) |
| 2026-10-30 | PR pendiente Audit PR B docs and process round 3 | Codex CLI | write | gpt-6-luna | none | 1 | 13,087 | n/a | n/a | codex exec total tokens used (wt-audit-b) |
| 2026-10-30 | PR pendiente Audit PR B docs and process round 4 | Codex CLI | write | gpt-6-luna | none | 1 | 20,781 | n/a | n/a | codex exec total tokens used (wt-audit-b) |
| 2026-10-30 | PR pendiente Audit PR B docs and process review 1 | Claude Code | review | claude-opus-5-5 | high | 1 | 3,166,946 | 80 | 18,174 | claude -p JSON modelUsage (prB/review; cache read 3,037,427; cache create 111,265; cost $1.86) |
| 2026-10-30 | PR pendiente Audit PR B docs and process review 2 | Claude Code | review | claude-opus-5-5 | high | 1 | 273,533 | 12 | 3,692 | claude -p JSON modelUsage (prB/review3.json; cache read 210,895; cache create 58,934; cost $0.59) |
| 2026-10-30 | PR pendiente Audit PR B docs and process round 5 | Codex CLI | write | gpt-6-luna | none | 1 | 12,215 | n/a | n/a | codex exec total tokens used (wt-audit-b) |
| 2026-10-30 | PR pendiente Audit PR B docs and process review 3 | Claude Code | review | claude-opus-5-5 | high | 1 | 332,180 | 18 | 4,111 | claude -p JSON modelUsage (prB/review4.json; cache read 295,358; cache create 32,693; cost $0.40) |
| 2026-10-31 | PR pendiente Audit PR B remove pr-body workflow | Codex CLI | write | gpt-6-luna | default | 2 | 43,121 | n/a | n/a | codex exec total tokens used (33,155 + 9,966) |
| 2026-10-31 | PR pendiente Audit PR B remove pr-body workflow review | Codex CLI | review | gpt-6.1-sol | medium | 1 | 14,952 | n/a | n/a | codex exec total tokens used; APPROVE |

Luna used 5 rounds, Sol used 2 verify loops, and Opus reviewed 3 times.

Values at 2026-10-25 01:20 Lima; quick play values at 02:40 Lima; CPU difficulty values at 03:16 Lima; PS4 pad preset values at 03:08 Lima; C7 part 3 values at 07:21 Lima; #76 values at 08:10 Lima; pad-smoke fix (#78) values at 08:33 Lima; keeper controls values at 11:33 Lima; keeper e2e values at 13:30 Lima (two mimo sessions gave no code, one hung 27 min; glm wrote the script); set-piece e2e values at 15:15 Lima (mimo wrote the hooks and the script; glm and Sol did not write) (pi total includes cached input; one pi session was stopped before it wrote code). touch HUD overlap fix values at 20:56 Lima (mimo wrote both files in 2 sessions; glm and Sol did not write). Touch L2 values at 10:50 Lima on 2026-10-26 (mimo session 1 hit the 900 s timeout with a partial diff; mimo session 2 finished; glm fixed the review finding). Defense values at 00:17 Lima on 2026-10-29 (mimo 2 sessions, the second hit the 900 s timeout; glm 1 session wrote preset rows and tests; deepseek wrote the e2e and fixed 5 review findings; Terra reviewed the screenshots; the executor ran the e2e because the Terra sandbox cannot start the preview server). Defense update values at 07:12 Lima on 2026-10-29 (merge of main after #83; deepseek wrote the Controls rows and fixed 3 review findings; Sol reviewed 3 times; Terra reviewed the screenshots). C10 (#68), C5 (#69), static build (#70) and sound (#71) values are final.

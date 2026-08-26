# SMALL-SIDED-LADDER-MENU-COMPLETION — Evidence Result

## Objective
Complete the in-browser setup-menu ladder: add 5v5 human-vs-CPU, 3v3 human-vs-CPU, and 1v1 human-vs-CPU entries to the MATCH_MODES registry, index.html mode-select, scenario-selector, and hintMap so the full small-sided ladder (1v1/2v2/3v3/5v5 × human-vs-CPU and CPU-vs-CPU) is selectable from the browser setup menu.

## Evidence Class
BROWSER_VISIBLE

## Result
PASS — all acceptance criteria met.

## Full Ladder Mapping

| Menu Label | mode-select value | MATCH_MODES modeId | Scenario |
|---|---|---|---|
| 5v5 AI vs AI | ai-match-5v5 | ai-match-5v5 | FOUNDATION_SCENARIO_5V5 |
| 5v5 Human vs CPU | human-vs-ai-5v5 | human-vs-ai-5v5 | FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V5 |
| 5v3 Human vs CPU | human-vs-ai-5v3 | human-vs-ai-5v3 | FOUNDATION_SCENARIO_HUMAN_VS_CPU_5V3 |
| 3v3 AI vs AI | ai-match-3v3 | ai-match-3v3 | FOUNDATION_SCENARIO_3V3 |
| 3v3 Human vs CPU | human-vs-ai-3v3 | human-vs-ai-3v3 | FOUNDATION_SCENARIO_HUMAN_VS_CPU_3V3 |
| 2v2 Human vs CPU | human-vs-ai | human-vs-ai | FOUNDATION_SCENARIO_HUMAN_VS_CPU |
| 2v2 AI vs AI | 2v2-ai | 2v2-ai | FOUNDATION_SCENARIO_2V2 |
| 1v1 Human vs CPU | human-vs-ai-1v1 | human-vs-ai-1v1 | FOUNDATION_SCENARIO_HUMAN_VS_CPU_1V1 |
| 1v1 AI vs AI | ai-match | ai-match | FOUNDATION_SCENARIO_AI_VS_AI |

9 menu options, 9 MATCH_MODES entries, 9 scenario-selector mappings — full parity.

## Screenshots

| File | Depicts | SHA-256 |
|---|---|---|
| menu-full-ladder.png | Completed setup menu with all 9 options | 6e15aabfa8b1d7a7ad08b252e05f342794a7c7d6362bddd9914849a5f789f067 |
| match-5v5-human-vs-cpu.png | Launched 5v5 human-vs-CPU match | 491cbcf91705fa4b5c324b0e8ff9b6c6d256872fd59e63bfd3e16f4802cc6790 |
| match-3v3-human-vs-cpu.png | Launched 3v3 human-vs-CPU match | f5bf651f267bd2b9dac401d5fd0ea5d45fc2574882b5d6b8e2e858bb8853a1f1 |

All screenshots are 800×600 RGB PNGs, byte-distinct (unique SHA-256), captured via Playwright with Chromium over a live Vite dev server.

## Claims Not Made
- No PROMOTION overclaim — this is a menu-completion objective, not a milestone acceptance.
- No PES fidelity claim — no PES 2017 constants or envelopes were invented.
- No FOUNDATION_LAB_PASS claim — the executable evaluator registries and policies are not part of this objective.
- No invented rubric or perceptual evaluation — the parity guard is a structural binding test.
- No GK/regulation/full-match/11v11 work.
- No manual player switching reintroduced — core-native SWITCH_PLAYER_BIT remains the sole mechanism.
